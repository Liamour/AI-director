// ──────────────────────────────────────────────────────────────────────────
// Stage 1 — Story.
//
// User's seed idea → prose script (markdown). MVP for Sprint 2.1: one
// scrollable editor for the whole story. Subsequent sprints add:
//   2.2 · AI auto-split into episodes + draggable boundaries
//   2.3 · per-episode tabs with character/scene/beat sub-panes
//   2.4 · text-selection AI menu (continue / rephrase / tighten / expand)
//
// Persistence: writes `<root>/总剧本.md` via Tauri FS. Web preview keeps
// the draft in Zustand only.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useScriptStore } from '@/store/scriptStore';
import { useProjectStore } from '@/store/projectStore';
import {
  isTauriEnv,
  loadScriptIndex,
  loadStory,
  writeScriptIndex,
  writeStory,
} from '@/shared/lib/tauri-fs';
import { Key, Panel, Divider } from '@/shared/ui/te';
import { LlmConfigDrawer } from '@/shared/ui/LlmConfigDrawer';
import {
  countWords,
  extractTitle,
  offsetToLine,
  type EpisodeBoundary,
  type ScriptIndex,
} from '@/core/types/story';

interface GenerateResponse {
  ok: boolean;
  content?: string;
  error?: string;
  durationMs?: number;
}

interface AnalyzeResponse {
  ok: boolean;
  index?: ScriptIndex;
  error?: string;
  durationMs?: number;
}

export default function Stage1Page() {
  const router = useRouter();
  const { apiKey, baseUrl, customModelId } = useScriptStore();
  const projectMeta = useProjectStore((s) => s.meta);
  const projectRoot = useProjectStore((s) => s.rootPath);

  const [tauri, setTauri] = useState(false);
  useEffect(() => setTauri(isTauriEnv()), []);

  // ── form state ──
  const [idea, setIdea] = useState('');
  const [draft, setDraft] = useState('');
  const [originalDraft, setOriginalDraft] = useState(''); // for revert
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sprint 2.2 — episode boundary index
  const [scriptIndex, setScriptIndex] = useState<ScriptIndex | null>(null);
  /** Episode currently in focus (for chip highlight). Tracks textarea caret. */
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState<number>(-1);

  // textarea ref so chip clicks can scroll/move the caret
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // No project loaded → bounce to landing
  useEffect(() => {
    if (!projectMeta) router.replace('/');
  }, [projectMeta, router]);

  // Hydrate draft + index from disk on mount (Tauri only — web starts empty)
  useEffect(() => {
    if (!projectRoot) return;
    let cancel = false;
    (async () => {
      const [content, index] = await Promise.all([
        loadStory(projectRoot),
        loadScriptIndex(projectRoot),
      ]);
      if (cancel) return;
      if (content) {
        setDraft(content);
        setOriginalDraft(content);
      }
      if (index) setScriptIndex(index);
    })();
    return () => {
      cancel = true;
    };
  }, [projectRoot]);

  if (!projectMeta) return null;

  const dirty = draft !== originalDraft;
  const canGenerate =
    !!apiKey && !!baseUrl && !!customModelId && !!idea.trim() && !isGenerating;

  // ── handlers ─────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/stage1/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          project: {
            format: projectMeta.format,
            style: { preset: projectMeta.style.preset },
          },
          apiKey,
          baseUrl,
          modelId: customModelId,
        }),
      });
      const json = (await res.json()) as GenerateResponse;
      if (!json.ok || !json.content) {
        setError(json.error ?? 'unknown error');
        return;
      }
      setDraft(json.content);
      // New content invalidates any prior episode split — make user re-analyze.
      setScriptIndex(null);
      // Note: not setting originalDraft — generated content is not yet "saved"
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!projectRoot) return;
    setIsSaving(true);
    try {
      // Save story; if we have an index, save that too.
      const [storyOk, indexOk] = await Promise.all([
        writeStory(projectRoot, draft),
        scriptIndex
          ? writeScriptIndex(projectRoot, scriptIndex)
          : Promise.resolve(true),
      ]);
      if ((!storyOk || !indexOk) && tauri) {
        setError('保存到磁盘失败 · 看 dev server log');
        return;
      }
      setOriginalDraft(draft);
      setLastSavedAt(new Date().toISOString());
      setError(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setDraft(originalDraft);
  };

  /** Ask LLM to propose episode boundaries for the current draft. */
  const handleAnalyzeEpisodes = async () => {
    if (!apiReady || !draft.trim() || isAnalyzing) return;
    setError(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/stage1/analyze-episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draft,
          project: { format: projectMeta.format },
          apiKey,
          baseUrl,
          modelId: customModelId,
        }),
      });
      const json = (await res.json()) as AnalyzeResponse;
      if (!json.ok || !json.index) {
        setError(json.error ?? 'analyze failed');
        return;
      }
      setScriptIndex(json.index);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Move the textarea caret to a character offset and scroll that line into
   * view. Browsers don't have a native "scroll to selection" for textarea,
   * so we estimate via line-count × line-height. Good enough for jumping
   * between episodes; no need for sub-pixel accuracy.
   */
  const scrollToOffset = (offset: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(offset, offset);
    const lineNum = offsetToLine(ta.value, offset) - 1;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    // Scroll so the target line appears about 1/4 down the visible area
    const target = Math.max(0, lineNum * lineHeight - ta.clientHeight * 0.25);
    ta.scrollTop = target;
  };

  /** When user types in the editor, recompute which episode the caret is in. */
  const refreshActiveEpisode = (caretOffset: number) => {
    if (!scriptIndex || scriptIndex.episodes.length === 0) {
      setActiveEpisodeIdx(-1);
      return;
    }
    let idx = -1;
    for (let i = 0; i < scriptIndex.episodes.length; i++) {
      if (scriptIndex.episodes[i].offset <= caretOffset) idx = i;
      else break;
    }
    setActiveEpisodeIdx(idx);
  };

  // ── derived ──────────────────────────────────────────────────────────

  const wordCount = countWords(draft);
  const title = extractTitle(draft) ?? projectMeta.name;
  const apiReady = !!apiKey && !!baseUrl && !!customModelId;

  // ── render ───────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-te-bone font-te text-te-charcoal">
      {/* chassis header */}
      <header className="px-8 pt-6 pb-4 flex items-end justify-between border-b border-te-bone-edge/40">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)]" />
          <h1 className="text-[22px] font-semibold lowercase tracking-tight">
            ai director · stage 1 · story
          </h1>
          <span className="text-[12px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
            prose draft
          </span>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
          <LlmConfigDrawer />
          <span>project · {projectMeta.name}</span>
          <span>format · {projectMeta.format}</span>
          <span>aspect · {projectMeta.aspectRatio}</span>
          <span className={tauri ? 'text-te-ok' : 'text-te-charcoal/40'}>
            runtime · {tauri ? 'tauri' : 'web preview'}
          </span>
        </div>
      </header>

      <section className="px-8 py-6 max-w-[1100px] mx-auto flex flex-col gap-5">
        {/* ── api ready hint ────────────────────────────────────────── */}
        {!apiReady && (
          <div className="px-4 py-3 rounded-md bg-te-warn/15 border border-te-warn/40 text-[13px] font-te-mono lowercase leading-relaxed text-te-charcoal/80">
            llm backbone not configured. open{' '}
            <a className="underline" href="/agent-lab">
              /agent-lab
            </a>{' '}
            to set api key / base url / model id, then come back here.
          </div>
        )}

        {/* ── idea pane ─────────────────────────────────────────────── */}
        <Panel title="idea · seed" meta="stage 1 input">
          <div className="flex flex-col gap-3">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="一句话灵感 · 比如「一个失忆的赛博朋克侦探追查偷走自己记忆的黑客」"
              spellCheck={false}
              rows={3}
              className="te-input resize-none"
              disabled={isGenerating}
            />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/50">
                <span className="w-1.5 h-1.5 rounded-full bg-te-knob-orange" />
                format · {projectMeta.format}
                <span className="w-1 h-1 rounded-full bg-te-charcoal/30 mx-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-te-knob-blue" />
                aspect · {projectMeta.aspectRatio}
                <span className="w-1 h-1 rounded-full bg-te-charcoal/30 mx-1" />
                style · {projectMeta.style.preset}
              </div>
              <Key
                variant="wide"
                active={isGenerating}
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {isGenerating ? 'writing…' : draft ? 'regenerate' : 'generate'}
              </Key>
            </div>
          </div>
        </Panel>

        {/* ── error banner ──────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-md bg-te-err/10 border border-te-err/40 text-[13px] font-te-mono lowercase leading-relaxed text-te-err">
            error · {error}
          </div>
        )}

        {/* ── draft pane ────────────────────────────────────────────── */}
        <Panel
          title="draft · 总剧本.md"
          meta={
            draft
              ? `${wordCount} words${dirty ? ' · unsaved' : ''}`
              : 'empty'
          }
        >
          {draft ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-[12px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/55">
                <span>title · {title}</span>
                <span>
                  {lastSavedAt
                    ? `saved · ${new Date(lastSavedAt).toLocaleTimeString()}`
                    : 'not saved yet'}
                </span>
              </div>

              {/* ── episode chips ──────────────────────────────────── */}
              <EpisodeChips
                index={scriptIndex}
                contentLength={draft.length}
                draftContent={draft}
                activeIdx={activeEpisodeIdx}
                isAnalyzing={isAnalyzing}
                canAnalyze={apiReady && !isGenerating}
                onAnalyze={handleAnalyzeEpisodes}
                onJumpToEpisode={(ep, idx) => {
                  setActiveEpisodeIdx(idx);
                  scrollToOffset(ep.offset);
                }}
              />

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onSelect={(e) =>
                  refreshActiveEpisode(
                    (e.target as HTMLTextAreaElement).selectionStart
                  )
                }
                onKeyUp={(e) =>
                  refreshActiveEpisode(
                    (e.target as HTMLTextAreaElement).selectionStart
                  )
                }
                onClick={(e) =>
                  refreshActiveEpisode(
                    (e.target as HTMLTextAreaElement).selectionStart
                  )
                }
                spellCheck={false}
                rows={28}
                className="te-input resize-y leading-relaxed"
                style={{ minHeight: '420px' }}
              />

              <div className="flex items-center justify-end gap-2">
                <Key
                  variant="wide"
                  disabled={!dirty || isSaving}
                  onClick={handleRevert}
                >
                  revert
                </Key>
                <Key
                  variant="wide"
                  active
                  disabled={!dirty || isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? 'saving…' : 'save'}
                </Key>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-[13px] font-te-mono lowercase tracking-wide text-te-charcoal/45">
              {isGenerating
                ? '✦ writing your story…'
                : 'no draft yet · type an idea above and press generate'}
            </div>
          )}
        </Panel>

        <Divider className="my-4" />

        {/* ── nav ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-[12px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/55 hover:text-te-charcoal transition-colors"
          >
            ← back to entry
          </button>
          <button
            type="button"
            onClick={() => router.push('/agent-lab')}
            disabled={!draft}
            className="text-[12px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/55 hover:text-te-charcoal transition-colors disabled:opacity-30 disabled:hover:text-te-charcoal/55"
            title={
              draft
                ? 'agent lab — current stage 2 prototype'
                : 'generate a draft first'
            }
          >
            stage 2 (agent lab) →
          </button>
        </div>
      </section>

      {/* local utility classes — same as landing modal */}
      <style jsx>{`
        :global(.te-input) {
          width: 100%;
          background: #1f2418;
          color: #b8c77a;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 14px;
          padding: 12px 14px;
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4) inset, 0 0 12px rgba(0, 0, 0, 0.5) inset;
          letter-spacing: 0.02em;
          outline: none;
          line-height: 1.6;
        }
        :global(.te-input::placeholder) {
          color: #7a8a4a;
        }
        :global(.te-input:focus) {
          box-shadow: 0 0 0 1px rgba(184, 199, 122, 0.5) inset, 0 0 12px rgba(0, 0, 0, 0.5) inset;
        }
      `}</style>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// EpisodeChips — horizontal strip above the editor.
//
// Renders one chip per episode, with click-to-jump. Also doubles as the
// "analyze" launcher when no index exists yet, and surfaces a "stale"
// warning when the script has changed since the last analyze.
// ──────────────────────────────────────────────────────────────────────────

interface EpisodeChipsProps {
  index: ScriptIndex | null;
  contentLength: number;
  draftContent: string;
  activeIdx: number;
  isAnalyzing: boolean;
  canAnalyze: boolean;
  onAnalyze: () => void;
  onJumpToEpisode: (ep: EpisodeBoundary, idx: number) => void;
}

function EpisodeChips({
  index,
  contentLength,
  draftContent,
  activeIdx,
  isAnalyzing,
  canAnalyze,
  onAnalyze,
  onJumpToEpisode,
}: EpisodeChipsProps) {
  const empty = !index || index.episodes.length === 0;
  const stale =
    index &&
    Math.abs(index.analyzedContentLength - contentLength) >
      Math.max(20, contentLength * 0.05);

  return (
    <div className="flex flex-col gap-2 px-3 py-3 rounded-md bg-te-bone-deep/60 border border-te-bone-edge/40">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-te-knob-blue" />
          episodes {index ? `· ${index.episodes.length}` : ''}
          {stale && (
            <span className="ml-2 text-te-warn normal-case tracking-tight">
              · stale (剧本已改，建议重抽)
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze || isAnalyzing}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md
            bg-te-bone-dim text-te-charcoal/80 shadow-te-key
            hover:bg-te-bone-deep hover:text-te-charcoal
            active:translate-y-[1px] active:shadow-te-key-active
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0
            text-[11px] font-te-mono uppercase tracking-[0.18em] transition-colors"
          title={canAnalyze ? 'ai 自动分集' : 'configure llm first'}
        >
          <span className="text-te-charcoal/40">[</span>
          <span className="w-1.5 h-1.5 rounded-full bg-te-knob-orange" />
          {isAnalyzing ? 'splitting…' : empty ? 'analyze' : 're-analyze'}
          <span className="text-te-charcoal/40">]</span>
        </button>
      </div>

      {empty ? (
        <p className="text-[12px] font-te-mono lowercase text-te-charcoal/45 italic">
          no episodes yet · click [analyze] to ask the llm to propose cut points
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {index!.episodes.map((ep, i) => {
            const isActive = i === activeIdx;
            const lineNum = offsetToLine(draftContent, ep.offset);
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => onJumpToEpisode(ep, i)}
                title={ep.reason ?? `${ep.title} · line ${lineNum}`}
                className={`flex items-center gap-2 h-8 pl-2 pr-3 rounded-md transition-colors text-[12px] font-te-mono lowercase tracking-tight
                  ${
                    isActive
                      ? 'bg-te-charcoal text-te-bone shadow-te-key-active'
                      : 'bg-te-bone-dim text-te-charcoal/85 shadow-te-key hover:bg-te-bone-deep'
                  }`}
              >
                <span
                  className={`text-[10px] font-te-mono uppercase tracking-[0.15em] ${
                    isActive ? 'text-te-bone/70' : 'text-te-charcoal/45'
                  }`}
                >
                  ep{String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate max-w-[180px]">{ep.title}</span>
                <span
                  className={`text-[10px] font-te-mono ${
                    isActive ? 'text-te-bone/50' : 'text-te-charcoal/35'
                  }`}
                >
                  ·l{lineNum}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
