// ──────────────────────────────────────────────────────────────────────────
// useProjectStore — current project's Stage 0 metadata + filesystem root.
//
// Why separate from useScriptStore:
//   - scriptStore holds machine-level concerns (apiKey, default backend)
//     which persist across projects.
//   - projectStore holds project-level concerns (format, aspectRatio, style)
//     which differ per project and live on disk in `<root>/project.json`.
//
// Source of truth: the on-disk project.json. Zustand is a UX cache so a page
// refresh doesn't lose the open project. When the cache disagrees with disk,
// disk wins (caller should re-load via loadProjectMeta).
// ──────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectMeta } from '@/core/types/project';

interface ProjectStore {
  /** Currently-open project metadata. null = no project loaded yet. */
  meta: ProjectMeta | null;
  /** Filesystem path to project root (Tauri) or mock path (Web preview). */
  rootPath: string | null;

  /** Set the active project after creation or open. */
  setProject: (meta: ProjectMeta, rootPath: string) => void;
  /** Patch fields on the active project. Bumps updatedAt automatically. */
  updateMeta: (patch: Partial<Omit<ProjectMeta, 'id' | 'createdAt' | 'schemaVersion'>>) => void;
  /** Drop the active project (e.g. user clicks "back to entry"). */
  clearProject: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      meta: null,
      rootPath: null,

      setProject: (meta, rootPath) => set({ meta, rootPath }),

      updateMeta: (patch) =>
        set((state) =>
          state.meta
            ? {
                meta: {
                  ...state.meta,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                },
              }
            : state
        ),

      clearProject: () => set({ meta: null, rootPath: null }),
    }),
    {
      name: 'ai-director-project',
      // Both fields persist so a refresh restores the open project. Disk
      // remains source of truth — call loadProjectMeta(rootPath) on app
      // boot in Tauri to refresh from project.json.
      partialize: (state) => ({ meta: state.meta, rootPath: state.rootPath }),
    }
  )
);
