// ──────────────────────────────────────────────────────────────────────────
// Stage 1 — Story (episode-first layout, Sprint 2.2 v2)
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ chassis header                                                    │
//   ├──────────┬───────────────────────────────────────────────────────┤
//   │ sidebar  │  preview / per-episode editor                         │
//   │  EP01    │                                                       │
//   │  EP02    │  ## EP01 引子 · 雨夜邂逅                              │
//   │  EP03    │  > Logline: ...                                       │
//   │  ...     │  <prose textarea>                                     │
//   │  + add   │                                                       │
//   ├──────────┴───────────────────────────────────────────────────────┤
//   │ idea input + [generate] (sticky bottom)                          │
//   └───────────────────────────────────────────────────────────────────┘
//
// Persistence: writes per-episode 剧本.md and a top-level index. Web
// preview keeps everything in component state. See HANDOFF.md §1.5.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useScriptStore } from '@/store/scriptStore';
import { useProjectStore } from '@/store/projectStore';
import {
  isTauriEnv,
  loadStoryProject,
  writeStoryProject,
} from '@/shared/lib/tauri-fs';
import { Key, Panel } from '@/shared/ui/te';
import { LlmConfigDrawer } from '@/shared/ui/LlmConfigDrawer';
import {
  countWords,
  generateEpisodeId,
  totalWordCount,
  type Episode,
  type StoryProject,
} from '@/core/types/story';

interface GenerateResponse {
  ok: boolean;
  story?: StoryProject;
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
  const [story, setStory] = useState<StoryProject | null>(null);
  const [originalStory, setOriginalStory] = useState<StoryProject | null>(null); // for revert
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No project loaded → bounce to landing
  useEffect(() => {
    if (!projectMeta) router.replace('/');
  }, [projectMeta, router]);

  // Hydrate story from disk (Tauri only — web starts empty)
  useEffect(() => {
    if (!projectRoot) return;
    let cancel = false;
    (async () => {
      const loaded = await loadStoryProject(projectRoot);
      if (cancel || !loaded) return;
      setStory(loaded);
      setOriginalStory(loaded);
      if (loaded.idea) setIdea(loaded.idea);
      if (loaded.episodes.length > 0) setActiveEpisodeId(loaded.episodes[0].id);
    })();
    return () => {
      cancel = true;
    };
  }, [projectRoot]);

  if (!projectMeta) return null;

  const apiReady = !!apiKey && !!baseUrl && !!customModelId;
  const dirty = JSON.stringify(story) !== JSON.stringify(originalStory);
  const canGenerate = apiReady && !!idea.trim() && !isGenerating;
  const activeEpisode =
    story?.episodes.find((e) => e.id === activeEpisodeId) ?? null;

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
      if (!json.ok || !json.story) {
        setError(json.error ?? 'unknown error');
        return;
      }
      setStory(json.story);
      // not setOriginalStory — generated content is unsaved
      if (json.story.episodes.length > 0) {
        setActiveEpisodeId(json.story.episodes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!projectRoot || !story) return;
    setIsSaving(true);
    try {
      const stamped: StoryProject = {
        ...story,
        updatedAt: new Date().toISOString(),
      };
      const ok = await writeStoryProject(projectRoot, stamped);
      if (!ok && tauri) {
        setError('保存到磁盘失败 · 看 dev server log');
        return;
      }
      setStory(stamped);
      setOriginalStory(stamped);
      setLastSavedAt(stamped.updatedAt);
      setError(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setStory(originalStory);
  };

  const handleEpisodeContentChange = (epId: string, content: string) => {
    if (!story) return;
    setStory({
      ...story,
      episodes: story.episodes.map((ep) =>
        ep.id === epId
          ? { ...ep, content, updatedAt: new Date().toISOString() }
          : ep
      ),
    });
  };

  const handleEpisodeTitleChange = (epId: string, title: string) => {
    if (!story) return;
    setStory({
      ...story,
      episodes: story.episodes.map((ep) =>
        ep.id === epId
          ? { ...ep, title, updatedAt: new Date().toISOString() }
          : ep
      ),
    });
  };

  const handleEpisodeLoglineChange = (epId: string, logline: string) => {
    if (!story) return;
    setStory({
      ...story,
      episodes: story.episodes.map((ep) =>
        ep.id === epId
          ? {
              ...ep,
              logline: logline || undefined,
              updatedAt: new Date().toISOString(),
            }
          : ep
      ),
    });
  };

  const handleAddEpisode = () => {
    if (!story) return;
    const nextNum = story.episodes.length
      ? Math.max(...story.episodes.map((e) => e.number)) + 1
      : 1;
    const newEp: Episode = {
      id: generateEpisodeId(),
      number: nextNum,
      title: `新分集 ${nextNum}`,
      content: '',
      updatedAt: new Date().toISOString(),
    };
    const next: StoryProject = {
      ...story,
      episodes: [...story.episodes, newEp],
    };
    setStory(next);
    setActiveEpisodeId(newEp.id);
  };

  const handleDeleteEpisode = (epId: string) => {
    if (!story) return;
    const next: StoryProject = {
      ...story,
      episodes: story.episodes
        .filter((e) => e.id !== epId)
        .map((e, i) => ({ ...e, number: i + 1 })), // renumber 1..N
    };
    setStory(next);
    if (activeEpisodeId === epId) {
      setActiveEpisodeId(next.episodes[0]?.id ?? null);
    }
  };

  // ── render ──────────────────────────────────────────────────────────

  return (
    <main className="h-screen flex flex-col bg-te-bone font-te text-te-charcoal">
      {/* ── chassis header ────────────────────────────────────────── */}
      <header className="px-8 pt-6 pb-4 flex items-end justify-between border-b border-te-bone-edge/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)]" />
          <h1 className="text-[22px] font-semibold lowercase tracking-tight">
            ai director · stage 1 · story
          </h1>
          <span className="text-[12px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
            episode draft
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

      {/* ── body: sidebar + preview ─────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* sidebar */}
        <aside className="w-[260px] shrink-0 border-r border-te-bone-edge/40 flex flex-col bg-te-bone-dim/40">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-te-bone-edge/40">
            <span className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-te-knob-blue" />
              episodes {story ? `· ${story.episodes.length}` : ''}
            </span>
            {story && (
              <button
                type="button"
                onClick={handleAddEpisode}
                className="text-[11px] font-te-mono lowercase tracking-[0.12em] text-te-charcoal/55 hover:text-te-charcoal transition-colors"
                title="add episode"
              >
                + new
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {!story && (
              <p className="px-2 py-6 text-[12px] font-te-mono lowercase text-te-charcoal/45 leading-relaxed">
                no episodes yet. type an idea below and press [generate] to
                draft a multi-episode script.
              </p>
            )}
            {story?.episodes.map((ep) => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                active={ep.id === activeEpisodeId}
                onClick={() => setActiveEpisodeId(ep.id)}
                onDelete={() => handleDeleteEpisode(ep.id)}
              />
            ))}
          </div>
        </aside>

        {/* preview */}
        <section className="flex-1 overflow-y-auto p-6">
          {!apiReady && (
            <div className="mb-4 px-4 py-3 rounded-md bg-te-warn/15 border border-te-warn/40 text-[13px] font-te-mono lowercase leading-relaxed text-te-charcoal/80">
              llm backbone not configured — open{' '}
              <span className="font-semibold">[● config]</span> in the header.
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-md bg-te-err/10 border border-te-err/40 text-[13px] font-te-mono lowercase leading-relaxed text-te-err">
              error · {error}
            </div>
          )}

          {!story ? (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <p className="text-[14px] font-te-mono lowercase text-te-charcoal/45 text-center max-w-[420px] leading-relaxed">
                {isGenerating
                  ? '✦ writing your episodes…'
                  : 'no story yet. type a one-line idea in the bottom bar and press [generate].'}
              </p>
            </div>
          ) : !activeEpisode ? (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <p className="text-[14px] font-te-mono lowercase text-te-charcoal/45">
                select an episode in the sidebar
              </p>
            </div>
          ) : (
            <EpisodeEditor
              episode={activeEpisode}
              onTitleChange={(t) => handleEpisodeTitleChange(activeEpisode.id, t)}
              onLoglineChange={(l) =>
                handleEpisodeLoglineChange(activeEpisode.id, l)
              }
              onContentChange={(c) =>
                handleEpisodeContentChange(activeEpisode.id, c)
              }
            />
          )}
        </section>
      </div>

      {/* ── bottom bar: idea + actions ─────────────────────────── */}
      <footer className="shrink-0 border-t border-te-bone-edge/40 bg-te-bone-dim/60 px-6 py-4">
        <Panel title="idea · seed" meta="stage 1 input" variant="flat">
          <div className="flex flex-col gap-3">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="一句话灵感 · 比如「一个失忆的赛博朋克侦探追查偷走自己记忆的黑客」"
              spellCheck={false}
              data-gramm="false"
              data-gramm_editor="false"
              rows={2}
              className="te-input resize-none"
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/50 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-te-knob-orange" />
                format · {projectMeta.format}
                <span className="w-1 h-1 rounded-full bg-te-charcoal/30 mx-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-te-knob-blue" />
                aspect · {projectMeta.aspectRatio}
                <span className="w-1 h-1 rounded-full bg-te-charcoal/30 mx-1" />
                style · {projectMeta.style.preset}
                {story && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-te-charcoal/30 mx-1" />
                    {totalWordCount(story)} words
                  </>
                )}
                {dirty && story && (
                  <span className="text-te-warn ml-2 normal-case tracking-tight">
                    · unsaved
                  </span>
                )}
                {lastSavedAt && !dirty && (
                  <span className="text-te-ok ml-2 normal-case tracking-tight">
                    · saved {new Date(lastSavedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {story && dirty && (
                  <Key
                    variant="wide"
                    disabled={isSaving || !originalStory}
                    onClick={handleRevert}
                  >
                    revert
                  </Key>
                )}
                {story && (
                  <Key
                    variant="wide"
                    active
                    disabled={!dirty || isSaving}
                    onClick={handleSave}
                  >
                    {isSaving ? 'saving…' : 'save'}
                  </Key>
                )}
                <Key
                  variant="wide"
                  active={isGenerating}
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  {isGenerating ? 'writing…' : story ? 'regenerate' : 'generate'}
                </Key>
              </div>
            </div>
          </div>
        </Panel>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-[11px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/55 hover:text-te-charcoal transition-colors"
          >
            ← back to entry
          </button>
          <button
            type="button"
            onClick={() => router.push('/agent-lab')}
            disabled={!story}
            className="text-[11px] font-te-mono lowercase tracking-[0.18em] text-te-charcoal/55 hover:text-te-charcoal transition-colors disabled:opacity-30 disabled:hover:text-te-charcoal/55"
            title={story ? 'agent lab — current stage 2 prototype' : 'generate a story first'}
          >
            stage 2 (agent lab) →
          </button>
        </div>
      </footer>

      {/* page-local — title input is special (no border, oversized) */}
      <style jsx>{`
        :global(.te-title-input) {
          width: 100%;
          background: transparent;
          color: #161616;
          font-family: 'Inter', sans-serif;
          font-size: 24px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.01em;
          border: none;
          outline: none;
          padding: 0;
        }
        :global(.te-title-input::placeholder) {
          color: rgba(22, 22, 22, 0.3);
        }
      `}</style>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components — kept inline to avoid splitting the page until we have
// a second consumer.
// ──────────────────────────────────────────────────────────────────────────

interface EpisodeCardProps {
  episode: Episode;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function EpisodeCard({ episode, active, onClick, onDelete }: EpisodeCardProps) {
  const wc = countWords(episode.content);
  // Tactile button treatment — same family as DeviceCard on landing page:
  // raised polymer panel with shadow-te-key, depresses on active.
  return (
    <div
      className={`relative group rounded-md cursor-pointer
        transition-[transform,box-shadow,background] duration-100
        ${
          active
            ? 'bg-te-charcoal text-te-bone shadow-te-key-active translate-y-[1px]'
            : 'bg-te-bone-dim text-te-charcoal shadow-te-key hover:bg-te-bone-deep active:translate-y-[1px] active:shadow-te-key-active'
        }`}
      onClick={onClick}
    >
      <div className="flex items-baseline gap-2 px-3 pt-2.5">
        <span
          className={`text-[11px] uppercase tracking-[0.18em] ${
            active ? 'text-te-bone/60' : 'text-te-charcoal/55'
          }`}
        >
          ep{String(episode.number).padStart(2, '0')}
        </span>
        <span className="text-[14px] font-semibold leading-snug truncate">
          {episode.title || '(untitled)'}
        </span>
      </div>
      {episode.logline && (
        <p
          className={`px-3 pt-1 text-[12px] leading-snug line-clamp-2 ${
            active ? 'text-te-bone/65' : 'text-te-charcoal/65'
          }`}
        >
          {episode.logline}
        </p>
      )}
      <div
        className={`px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.15em] ${
          active ? 'text-te-bone/40' : 'text-te-charcoal/40'
        }`}
      >
        {wc} words
      </div>

      {/* delete affordance — appears on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`delete ep${episode.number}?`)) onDelete();
        }}
        className={`absolute top-1 right-1 w-5 h-5 rounded text-[12px] leading-none opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity
          ${active ? 'text-te-bone hover:bg-te-bone/10' : 'text-te-charcoal hover:bg-te-charcoal/10'}`}
        title="delete episode"
      >
        ×
      </button>
    </div>
  );
}

interface EpisodeEditorProps {
  episode: Episode;
  onTitleChange: (t: string) => void;
  onLoglineChange: (l: string) => void;
  onContentChange: (c: string) => void;
}

function EpisodeEditor({
  episode,
  onTitleChange,
  onLoglineChange,
  onContentChange,
}: EpisodeEditorProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* episode chip */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
          ep{String(episode.number).padStart(2, '0')}
        </span>
        <span className="w-1 h-1 rounded-full bg-te-charcoal/30" />
        <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
          {countWords(episode.content)} words
        </span>
      </div>

      {/* title */}
      <input
        value={episode.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="episode title"
        className="te-title-input"
        spellCheck={false}
      />

      {/* logline */}
      <input
        value={episode.logline ?? ''}
        onChange={(e) => onLoglineChange(e.target.value)}
        placeholder="logline · one-or-two-sentence hook (optional)"
        className="te-input"
        style={{ fontSize: '14px', padding: '10px 12px' }}
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
      />

      {/* prose body */}
      <textarea
        value={episode.content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="episode prose · markdown supported"
        rows={20}
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        className="te-input resize-y leading-relaxed"
        style={{ minHeight: '360px' }}
      />
    </div>
  );
}
