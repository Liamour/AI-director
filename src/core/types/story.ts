// ──────────────────────────────────────────────────────────────────────────
// Stage 1 story model — episode-first.
//
// LLM generates a list of episodes directly (one structured prompt → many
// episodes). Each episode owns its own markdown content and lives in its
// own folder on disk. There is no monolithic 总剧本.md; the "project" is
// just an index file pointing at per-episode files.
//
// Disk layout:
//   <root>/
//   ├── 总剧本.index.json          ← project-level index (this file)
//   └── 剧集分镜/
//       ├── EP01/
//       │   └── 剧本.md            ← episode content (markdown)
//       ├── EP02/
//       │   └── 剧本.md
//       └── ...
// ──────────────────────────────────────────────────────────────────────────

export const STORY_INDEX_FILENAME = '总剧本.index.json';
export const EPISODES_DIR = '剧集分镜';
export const EPISODE_SCRIPT_FILENAME = '剧本.md';
export const STORY_SCHEMA_VERSION = 2;

export interface Episode {
  /** Internal stable id — survives reorder. */
  id: string;
  /** Display order, 1-based. Folder name derives from this: EP01, EP02, ... */
  number: number;
  /** Episode title (e.g. "引子 · 雨夜邂逅"). User-editable. */
  title: string;
  /** One-or-two-sentence hook ("logline"). Optional but encouraged. */
  logline?: string;
  /** Full prose markdown for this episode. Source of truth on disk. */
  content: string;
  /** ISO-8601, set when the episode is created or its content changes. */
  updatedAt: string;
}

export interface StoryProject {
  schemaVersion: number;
  /** The seed idea the user typed. Kept so regenerate doesn't lose it. */
  idea: string;
  /** Title surfaced from the LLM (or user-edited). Falls back to project name. */
  title?: string;
  episodes: Episode[];
  /** ISO-8601 of the last full LLM regenerate; UI shows it as "generated · …". */
  generatedAt: string;
  /** ISO-8601 of the last save (any episode or index). */
  updatedAt: string;
}

// ── Factories ─────────────────────────────────────────────────────────────

export function createEmptyStoryProject(idea: string): StoryProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    idea,
    episodes: [],
    generatedAt: now,
    updatedAt: now,
  };
}

export function generateEpisodeId(): string {
  const ts = Date.now().toString(36).slice(-4);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `ep_${ts}_${rnd}`;
}

/** Folder name on disk for a given 1-based episode number: 1 → "EP01". */
export function episodeFolderName(number: number): string {
  return `EP${String(number).padStart(2, '0')}`;
}

// ── Cheap text utilities ──────────────────────────────────────────────────

export function countWords(content: string): number {
  if (!content) return 0;
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function totalWordCount(project: StoryProject): number {
  return project.episodes.reduce((sum, ep) => sum + countWords(ep.content), 0);
}
