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
