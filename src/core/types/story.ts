// ──────────────────────────────────────────────────────────────────────────
// StoryDraft — Stage 1 prose script. See HANDOFF.md §1.5.
//
// One per project. Lives on disk as `<root>/总剧本.md`. The `.index.json`
// sibling (added in Sprint 2.2) holds the structured episode-boundary
// metadata so we don't have to re-parse markdown every time.
//
// Stage 1 stays at the *storytelling layer*. We deliberately avoid baking
// shot decisions (camera moves, focal lengths) into the prose — those are
// Stage 2 concerns. Keeping the layers clean means a single LLM pass can
// later replace the screenwriter without invalidating the storyboard work.
// ──────────────────────────────────────────────────────────────────────────

export interface StoryDraft {
  /** Markdown prose content. Source of truth on disk: `<root>/总剧本.md`. */
  content: string;
  /** The original user idea that seeded this draft. Kept for context. */
  idea: string;
  /** ISO-8601, set every time the user edits or regenerates. */
  updatedAt: string;
  /** Optional title surfaced from the markdown's first H1 — UI cache only. */
  title?: string;
  /** Cheap word count for the status bar. UTF-16 codeunits / 5, ish. */
  wordCount: number;
}

export const STORY_FILENAME = '总剧本.md';
export const SCRIPT_INDEX_FILENAME = '总剧本.index.json';
export const SCRIPT_INDEX_SCHEMA_VERSION = 1;

// ──────────────────────────────────────────────────────────────────────────
// Episode boundaries (Sprint 2.2)
//
// The prose script is one long markdown document. Episodes are LLM-proposed
// "cut points" expressed as character offsets into that markdown — keeping
// the script as one source of truth instead of N split files. Persistence:
// `<root>/总剧本.index.json` sits next to 总剧本.md.
//
// Why offsets and not headings? Because the LLM may decide a natural break
// is mid-paragraph in some genres (短视频 / 漫画), and we don't want to
// mutate the user's prose just to mark a boundary.
// ──────────────────────────────────────────────────────────────────────────

export interface EpisodeBoundary {
  /** Stable id within this index — episodes can be added/removed/reordered. */
  id: string;
  /** Character offset in 总剧本.md where this episode starts. 0 for the first one. */
  offset: number;
  /** AI-suggested title; user-editable. */
  title: string;
  /** Optional 1-2 sentence rationale from the LLM ("why split here"). */
  reason?: string;
}

export interface ScriptIndex {
  schemaVersion: number;
  /** Ordered list of cut points. The first should always have offset=0. */
  episodes: EpisodeBoundary[];
  /** ISO-8601 of the last analyze-episodes run; used to flag staleness. */
  analyzedAt: string;
  /** Length of 总剧本.md when analyze ran — diverging means the script changed. */
  analyzedContentLength: number;
}

export function createEmptyIndex(contentLength: number): ScriptIndex {
  return {
    schemaVersion: SCRIPT_INDEX_SCHEMA_VERSION,
    episodes: [],
    analyzedAt: new Date().toISOString(),
    analyzedContentLength: contentLength,
  };
}

/** Generate a short readable id like `ep_lt12_xq` for new boundaries. */
export function generateEpisodeId(): string {
  const ts = Date.now().toString(36).slice(-4);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `ep_${ts}_${rnd}`;
}

/**
 * Find which episode contains a given character offset. Returns the episode
 * index (0-based) or -1 if no episodes are defined.
 */
export function findEpisodeAt(index: ScriptIndex, offset: number): number {
  if (index.episodes.length === 0) return -1;
  let lastIdx = -1;
  for (let i = 0; i < index.episodes.length; i++) {
    if (index.episodes[i].offset <= offset) lastIdx = i;
    else break;
  }
  return lastIdx;
}

/** Compute 1-based line number for an offset. Cheap, runs O(n) on offset. */
export function offsetToLine(content: string, offset: number): number {
  if (offset <= 0) return 1;
  let line = 1;
  const cap = Math.min(offset, content.length);
  for (let i = 0; i < cap; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Build an empty draft as a starting point. The `idea` field is preserved
 * so a regenerate flow can re-seed without re-prompting the user.
 */
export function createEmptyDraft(idea: string): StoryDraft {
  return {
    content: '',
    idea,
    updatedAt: new Date().toISOString(),
    wordCount: 0,
  };
}

/**
 * Cheap word count — counts whitespace-delimited tokens. Good enough for a
 * status badge; not for billing or sentence-level analysis.
 */
export function countWords(content: string): number {
  if (!content) return 0;
  return content.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Pull the document title from the first H1 in the markdown. Returns
 * undefined if there's none — caller falls back to project name.
 */
export function extractTitle(content: string): string | undefined {
  const m = content.match(/^\s*#\s+(.+?)\s*$/m);
  return m?.[1]?.trim() || undefined;
}
