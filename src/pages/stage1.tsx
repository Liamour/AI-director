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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useScriptStore } from '@/store/scriptStore';
import { useProjectStore } from '@/store/projectStore';
import { isTauriEnv, loadStory, writeStory } from '@/shared/lib/tauri-fs';
import { Key, Panel, Divider } from '@/shared/ui/te';
import { LlmConfigDrawer } from '@/shared/ui/LlmConfigDrawer';
import { countWords, extractTitle } from '@/core/types/story';

interface GenerateResponse {
  ok: boolean;
  content?: string;
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No project loaded → bounce to landing
  useEffect(() => {
    if (!projectMeta) router.replace('/');
  }, [projectMeta, router]);

  // Hydrate draft from disk on mount (Tauri only — web mode starts empty)
  useEffect(() => {
    if (!projectRoot) return;
    let cancel = false;
    (async () => {
      const content = await loadStory(projectRoot);
      if (cancel) return;
      if (content) {
        setDraft(content);
        setOriginalDraft(content);
      }
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
      const ok = await writeStory(projectRoot, draft);
      if (!ok && tauri) {
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

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
          font-size: 12px;
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
