// ──────────────────────────────────────────────────────────────────────────
// ProjectMeta — Stage 0 metadata locked at project creation.
// See HANDOFF.md §1.5 "产品五阶段架构 / Stage 0".
//
// Lifecycle:
//   1. User picks fields in the creation modal (pages/index.tsx)
//   2. Meta written to <root>/project.json by scaffoldProject (tauri-fs.ts)
//   3. useProjectStore caches meta during the session for fast UI access
//   4. Downstream agents/renderers (Stage 1+) read from projectStore for
//      aspect / style / refs — not from the chat/render scriptStore which
//      holds purely user-machine concerns (apiKey, default backend).
//
// Fields are LOCK-ON-CREATE: changing them mid-project may yield inconsistent
// outputs across episodes. Future sprints can offer a guided migration tool.
// ──────────────────────────────────────────────────────────────────────────

export type ProjectFormat = 'series' | 'shortform' | 'comic' | 'animation';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

/**
 * Visual style preset. The preset string is what gets injected into image
 * generation prompts at Stage 2; it's also what we hash to pick a default
 * style LoRA in the future.
 */
export type ArtStylePreset =
  | 'photoreal'    // 写实
  | 'cyberpunk'    // 赛博朋克
  | 'anime'        // 二次元
  | 'oil-painting' // 油画
  | 'comic'        // 漫画分格
  | 'pixar';       // 三维卡通

export interface ProjectStyle {
  preset: ArtStylePreset;
  /** User-uploaded reference image paths (relative to project root). */
  refImages: string[];
  /** Optional LoRA tags to inject into all prompts (e.g. "<lora:cyber:0.7>"). */
  loraTags?: string[];
}

export interface ProjectMeta {
  /** Stable id, used for cross-references (e.g. character bible → project). */
  id: string;
  /** Human name. Also used as the on-disk folder name. */
  name: string;
  format: ProjectFormat;
  aspectRatio: AspectRatio;
  style: ProjectStyle;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
  /** Bumps when ProjectMeta shape changes — for future migrations. */
  schemaVersion: number;
}

export const PROJECT_SCHEMA_VERSION = 1;

// ── Display labels (Chinese first, since UI is Chinese) ───────────────────

const FORMAT_LABELS: Record<ProjectFormat, string> = {
  series: '剧集',
  shortform: '短视频',
  comic: '漫画',
  animation: '动画',
};

const STYLE_LABELS: Record<ArtStylePreset, string> = {
  photoreal: '写实',
  cyberpunk: '赛博朋克',
  anime: '二次元',
  'oil-painting': '油画',
  comic: '漫画分格',
  pixar: '三维卡通',
};

const ASPECT_LABELS: Record<AspectRatio, string> = {
  '16:9': '16:9 横屏',
  '9:16': '9:16 竖屏',
  '1:1':  '1:1 方形',
  '4:5':  '4:5 立式',
};

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export const FORMAT_OPTIONS: SelectOption<ProjectFormat>[] = (
  Object.keys(FORMAT_LABELS) as ProjectFormat[]
).map((value) => ({ value, label: FORMAT_LABELS[value] }));

export const STYLE_OPTIONS: SelectOption<ArtStylePreset>[] = (
  Object.keys(STYLE_LABELS) as ArtStylePreset[]
).map((value) => ({ value, label: STYLE_LABELS[value] }));

export const ASPECT_RATIO_OPTIONS: SelectOption<AspectRatio>[] = (
  Object.keys(ASPECT_LABELS) as AspectRatio[]
).map((value) => ({ value, label: ASPECT_LABELS[value] }));

// ── Factories ─────────────────────────────────────────────────────────────

/**
 * Build a ProjectMeta with sensible defaults given just a name.
 * Caller mutates fields based on user input before persisting.
 */
export function createDefaultProjectMeta(name: string): ProjectMeta {
  const now = new Date().toISOString();
  return {
    id: generateProjectId(),
    name: name.trim(),
    format: 'series',
    aspectRatio: '16:9',
    style: {
      preset: 'photoreal',
      refImages: [],
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: PROJECT_SCHEMA_VERSION,
  };
}

function generateProjectId(): string {
  // Not cryptographically unique — collision resistance only across one user's
  // machine is enough. ts (millis, base36) + 6 random base36 chars.
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `proj_${ts}_${rnd}`;
}

// ── Type guards ───────────────────────────────────────────────────────────

export function isAspectRatio(v: string): v is AspectRatio {
  return v === '16:9' || v === '9:16' || v === '1:1' || v === '4:5';
}

export function isProjectFormat(v: string): v is ProjectFormat {
  return v === 'series' || v === 'shortform' || v === 'comic' || v === 'animation';
}

export function isArtStylePreset(v: string): v is ArtStylePreset {
  return (
    v === 'photoreal' ||
    v === 'cyberpunk' ||
    v === 'anime' ||
    v === 'oil-painting' ||
    v === 'comic' ||
    v === 'pixar'
  );
}
