// ──────────────────────────────────────────────────────────────────────────
// tauri-fs — bridge between the Web UI and Tauri's native FS plugin.
// All functions degrade gracefully when running in plain browser (`npm run
// dev` outside Tauri) so the UI is testable without a desktop runtime.
// ──────────────────────────────────────────────────────────────────────────

import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { PROJECT_SCHEMA_VERSION, type ProjectMeta } from '@/core/types/project';
import {
  EPISODES_DIR,
  EPISODE_SCRIPT_FILENAME,
  STORY_INDEX_FILENAME,
  STORY_SCHEMA_VERSION,
  episodeFolderName,
  type Episode,
  type StoryProject,
} from '@/core/types/story';

/**
 * Detect whether we're running inside the Tauri runtime. We check both the
 * official `isTauri()` predicate and the legacy `__TAURI_INTERNALS__` window
 * symbol because the predicate occasionally races on Next.js hydration.
 *
 * Exposed so UI can render different affordances (e.g. show "web preview"
 * badge, gate folder-picker buttons) without having to know about the Tauri
 * internals.
 */
export const isTauriEnv = (): boolean =>
  isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);

/**
 * Scaffold a new project on disk using the given metadata.
 *
 * In Tauri:
 *   1. Pop the directory picker so the user chooses a parent folder
 *   2. Create `<picked>/<name>/` and the canonical subfolders
 *      (剧集分镜 / 人物 / 场景 / .ai-director/{version-history,llm-traces})
 *   3. Write `project.json` containing the full ProjectMeta
 *   4. Return the absolute project root path
 *
 * In Web preview (no Tauri runtime):
 *   - Returns a mock path. project.json is NOT written, but the caller
 *     should still place meta in the Zustand store so the rest of the app
 *     behaves identically.
 */
export const scaffoldProject = async (meta: ProjectMeta): Promise<string> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview mode: project scaffolding simulated');
      return `/mock/local/projects/${meta.name}`;
    }

    console.log('[Tauri V2] Triggering native plugin dialog...');

    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Select Project Root Directory',
    });

    if (!selectedPath) {
      throw new Error('User canceled folder selection');
    }

    const basePath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
    const projectRoot = await join(basePath, meta.name);

    console.log(`[Tauri V2] Creating physical directories at: ${projectRoot}`);

    // Top-level folders — see HANDOFF.md §1.5 directory tree.
    await mkdir(projectRoot, { recursive: true });
    await mkdir(await join(projectRoot, '剧集分镜'), { recursive: true });
    await mkdir(await join(projectRoot, '人物'), { recursive: true });
    await mkdir(await join(projectRoot, '场景'), { recursive: true });
    await mkdir(await join(projectRoot, '.ai-director'), { recursive: true });
    await mkdir(await join(projectRoot, '.ai-director', 'version-history'), {
      recursive: true,
    });
    await mkdir(await join(projectRoot, '.ai-director', 'llm-traces'), {
      recursive: true,
    });

    // Write project.json — single source of truth for project metadata.
    const projectJsonPath = await join(projectRoot, 'project.json');
    await writeTextFile(projectJsonPath, JSON.stringify(meta, null, 2));

    return projectRoot;
  } catch (error) {
    console.error('[CRITICAL] Tauri Native API Failed. Reason:', error);
    return `/mock/local/projects/${meta.name}`;
  }
};

/**
 * Result of `pickAndLoadProject` — discriminated so callers can render
 * different UX for each failure mode (canceled / wrong folder / web mode).
 */
export type OpenProjectResult =
  /** Success — meta loaded from project.json. */
  | { kind: 'ok'; meta: ProjectMeta; rootPath: string }
  /** User dismissed the directory picker. No-op for the caller. */
  | { kind: 'canceled' }
  /** Running in browser (no Tauri). Caller should fall back to last persisted project or show a message. */
  | { kind: 'web-mock' }
  /** A folder was picked but it has no readable project.json. */
  | { kind: 'no-meta'; rootPath: string }
  /** Something else went wrong (FS error, JSON parse fail, etc). */
  | { kind: 'error'; message: string };

/**
 * Pop the native directory picker and load that folder's project.json.
 * Use this for the "open existing project" flow on the landing page.
 */
export const pickAndLoadProject = async (): Promise<OpenProjectResult> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview: pickAndLoadProject requires Tauri desktop');
      return { kind: 'web-mock' };
    }
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: '选择已有项目根目录',
    });
    if (!selectedPath) return { kind: 'canceled' };
    const rootPath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
    const meta = await loadProjectMeta(rootPath);
    if (!meta) return { kind: 'no-meta', rootPath };
    return { kind: 'ok', meta, rootPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pickAndLoadProject] failed:', error);
    return { kind: 'error', message };
  }
};

/**
 * Read & parse `<rootPath>/project.json`. Returns null when the file is
 * missing, unreadable, or its schemaVersion doesn't match. Schema mismatch
 * logs a warning so the caller can decide whether to migrate or refuse.
 */
export const loadProjectMeta = async (rootPath: string): Promise<ProjectMeta | null> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview: project.json not read from disk');
      return null;
    }
    const path = await join(rootPath, 'project.json');
    const content = await readTextFile(path);
    const parsed = JSON.parse(content) as ProjectMeta;
    if (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
      console.warn(
        `[loadProjectMeta] schemaVersion mismatch: file=${parsed.schemaVersion} expected=${PROJECT_SCHEMA_VERSION}`
      );
    }
    return parsed;
  } catch (error) {
    console.error('[loadProjectMeta] failed:', error);
    return null;
  }
};

/**
 * Persist updated meta back to `<rootPath>/project.json`. Use after
 * `useProjectStore.updateMeta` if you want changes to survive reboot.
 */
export const writeProjectMeta = async (
  rootPath: string,
  meta: ProjectMeta
): Promise<boolean> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview: project.json not written to disk');
      return false;
    }
    const path = await join(rootPath, 'project.json');
    await writeTextFile(path, JSON.stringify(meta, null, 2));
    return true;
  } catch (error) {
    console.error('[writeProjectMeta] failed:', error);
    return false;
  }
};

// ── Stage 1 story FS helpers (episode-first) ─────────────────────────────

/**
 * Shape we serialize as `总剧本.index.json`. We strip per-episode `content`
 * here because content lives in each `EPxx/剧本.md` file — keeping it out
 * of the index avoids huge JSON and double-source-of-truth pain.
 */
interface IndexFile {
  schemaVersion: number;
  idea: string;
  title?: string;
  generatedAt: string;
  updatedAt: string;
  episodes: Array<Pick<Episode, 'id' | 'number' | 'title' | 'logline' | 'updatedAt'>>;
}

/**
 * Write the entire story project to disk:
 *   1. `<root>/总剧本.index.json`     — episode list (no content)
 *   2. `<root>/剧集分镜/EPxx/剧本.md` — one file per episode (content)
 *
 * Web preview mode is a no-op — the caller keeps state in Zustand only.
 *
 * NOTE: this is "write what's in memory" — old episode folders are NOT
 * pruned. After a regenerate the user might end up with stale EPxx folders
 * past the new max number; we'll add a prune step in a follow-up.
 */
export const writeStoryProject = async (
  rootPath: string,
  story: StoryProject
): Promise<boolean> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview: story project not written to disk');
      return false;
    }

    // ensure 剧集分镜 dir exists
    await mkdir(await join(rootPath, EPISODES_DIR), { recursive: true });

    // write each episode's 剧本.md
    for (const ep of story.episodes) {
      const folder = await join(rootPath, EPISODES_DIR, episodeFolderName(ep.number));
      await mkdir(folder, { recursive: true });
      await writeTextFile(await join(folder, EPISODE_SCRIPT_FILENAME), ep.content);
    }

    // write the slim index
    const indexPath = await join(rootPath, STORY_INDEX_FILENAME);
    const indexFile: IndexFile = {
      schemaVersion: STORY_SCHEMA_VERSION,
      idea: story.idea,
      title: story.title,
      generatedAt: story.generatedAt,
      updatedAt: story.updatedAt,
      episodes: story.episodes.map(({ id, number, title, logline, updatedAt }) => ({
        id,
        number,
        title,
        logline,
        updatedAt,
      })),
    };
    await writeTextFile(indexPath, JSON.stringify(indexFile, null, 2));
    return true;
  } catch (error) {
    console.error('[writeStoryProject] failed:', error);
    return false;
  }
};

/**
 * Read the full story project from disk: parse the index, then read each
 * episode's 剧本.md. Returns null if the index is missing or unreadable.
 * Individual episode read failures fall back to empty content (so the
 * sidebar still shows the slot — user can re-enter the prose).
 */
export const loadStoryProject = async (
  rootPath: string
): Promise<StoryProject | null> => {
  try {
    if (!isTauriEnv()) return null;
    const indexPath = await join(rootPath, STORY_INDEX_FILENAME);
    const indexRaw = await readTextFile(indexPath);
    const idx = JSON.parse(indexRaw) as IndexFile;
    if (idx.schemaVersion !== STORY_SCHEMA_VERSION) {
      console.warn(
        `[loadStoryProject] schema mismatch: file=${idx.schemaVersion} expected=${STORY_SCHEMA_VERSION}`
      );
    }

    const episodes: Episode[] = [];
    for (const ep of idx.episodes ?? []) {
      let content = '';
      try {
        const epFile = await join(
          rootPath,
          EPISODES_DIR,
          episodeFolderName(ep.number),
          EPISODE_SCRIPT_FILENAME
        );
        content = await readTextFile(epFile);
      } catch (err) {
        console.warn(`[loadStoryProject] episode ${ep.number} 剧本.md not readable:`, err);
      }
      episodes.push({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        logline: ep.logline,
        content,
        updatedAt: ep.updatedAt,
      });
    }

    return {
      schemaVersion: idx.schemaVersion,
      idea: idx.idea ?? '',
      title: idx.title,
      episodes,
      generatedAt: idx.generatedAt ?? new Date().toISOString(),
      updatedAt: idx.updatedAt ?? new Date().toISOString(),
    };
  } catch (error) {
    // Missing index is the common case on fresh projects — warn only
    console.warn('[loadStoryProject] not readable:', error);
    return null;
  }
};

/**
 * Open a script file picker and return the file's text contents. Returns an
 * empty string on cancel or read error.
 */
export const importScriptFile = async (): Promise<string> => {
  try {
    if (!isTauriEnv()) {
      console.warn('[Mock] Web preview mode: Script import simulated');
      return [
        '// Mock imported script content',
        '',
        'This is a sample script imported in web preview mode.',
        '',
        'In Tauri desktop mode, this will allow you to select a local script',
        'file (.txt/.md/.json) and import its contents.',
      ].join('\n');
    }

    const selectedFile = await open({
      multiple: false,
      filters: [
        {
          name: 'Script Files',
          extensions: ['txt', 'md', 'json', 'docx'],
        },
      ],
      title: 'Select Script File to Import',
    });

    if (!selectedFile || Array.isArray(selectedFile)) {
      throw new Error('No file selected or invalid selection');
    }

    return await readTextFile(selectedFile);
  } catch (error) {
    console.error('[CRITICAL] Script import failed. Reason:', error);
    return '';
  }
};
