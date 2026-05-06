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

/**
 * Detect whether we're running inside the Tauri runtime. We check both the
 * official `isTauri()` predicate and the legacy `__TAURI_INTERNALS__` window
 * symbol because the predicate occasionally races on Next.js hydration.
 */
const isTauriEnv = (): boolean =>
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
