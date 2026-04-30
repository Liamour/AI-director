// ──────────────────────────────────────────────────────────────────────────
// Engram — the multi-agent blackboard.
//
// All agents read from / write to the same ScriptEngram. The blackboard
// records every patch (path + revision + timestamp + author) so we can replay
// the agent execution graph later.
//
// Why "engram"? It's the existing project term for the structured script
// (see src/core/types/script.ts). We're keeping it.
// ──────────────────────────────────────────────────────────────────────────

import type { ScriptEngram, Scene, Character, Shot } from '@/core/types/script';

export interface EngramPatch {
  /** dot path, e.g. "title", "scenes[2].shots[0].imagePrompt" */
  path: string;
  /** monotonic revision counter — incremented on every successful write */
  revision: number;
  /** wall-clock milliseconds */
  timestamp: number;
  /** agent name that produced the patch */
  author: string;
}

export type EngramListener = (patch: EngramPatch, snapshot: Readonly<ScriptEngram>) => void;

/** image-prompt slot we tack on per shot — kept separate so we don't fork ScriptEngram */
export interface ShotImagePrompt {
  shotId: string;
  imagePrompt: string;
  negativePrompt?: string;
  aspectRatio?: '9:16' | '4:5' | '16:9' | '1:1';
}

export class Engram {
  private state: ScriptEngram;
  private revision = 0;
  private history: EngramPatch[] = [];
  private listeners = new Set<EngramListener>();
  /** image prompts indexed by shotId — produced by Cinematographer */
  private imagePrompts = new Map<string, ShotImagePrompt>();

  constructor(initial?: Partial<ScriptEngram>) {
    this.state = {
      title: initial?.title ?? '',
      logline: initial?.logline ?? '',
      characters: initial?.characters ?? [],
      scenes: initial?.scenes ?? [],
    };
  }

  // ── read ────────────────────────────────────────────────────────────────

  snapshot(): Readonly<ScriptEngram> {
    return this.state;
  }

  getRevision(): number {
    return this.revision;
  }

  getHistory(): ReadonlyArray<EngramPatch> {
    return this.history;
  }

  getImagePrompt(shotId: string): ShotImagePrompt | undefined {
    return this.imagePrompts.get(shotId);
  }

  getAllImagePrompts(): ShotImagePrompt[] {
    return Array.from(this.imagePrompts.values());
  }

  /** flat shot list across all scenes — used by orchestrator dispatch */
  allShots(): Array<{ scene: Scene; shot: Shot; sceneIndex: number; shotIndex: number }> {
    const out: Array<{ scene: Scene; shot: Shot; sceneIndex: number; shotIndex: number }> = [];
    this.state.scenes.forEach((scene, sceneIndex) => {
      scene.shots.forEach((shot, shotIndex) => {
        out.push({ scene, shot, sceneIndex, shotIndex });
      });
    });
    return out;
  }

  // ── write (each path = one method, type-safe) ───────────────────────────

  setHeader(
    author: string,
    header: { title: string; logline: string }
  ): EngramPatch {
    this.state = { ...this.state, title: header.title, logline: header.logline };
    return this.commit('header', author);
  }

  setCharacters(author: string, characters: Character[]): EngramPatch {
    this.state = { ...this.state, characters: [...characters] };
    return this.commit('characters', author);
  }

  setScenes(author: string, scenes: Scene[]): EngramPatch {
    this.state = { ...this.state, scenes: scenes.map((s) => ({ ...s, shots: [...s.shots] })) };
    return this.commit('scenes', author);
  }

  /** wholesale replace — used when a single agent produces the whole engram */
  replaceAll(author: string, next: ScriptEngram): EngramPatch {
    this.state = {
      title: next.title,
      logline: next.logline,
      characters: [...next.characters],
      scenes: next.scenes.map((s) => ({ ...s, shots: [...s.shots] })),
    };
    return this.commit('*', author);
  }

  setImagePrompt(author: string, prompt: ShotImagePrompt): EngramPatch {
    this.imagePrompts.set(prompt.shotId, prompt);
    return this.commit(`imagePrompts[${prompt.shotId}]`, author);
  }

  // ── observability ───────────────────────────────────────────────────────

  subscribe(listener: EngramListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private commit(path: string, author: string): EngramPatch {
    this.revision += 1;
    const patch: EngramPatch = {
      path,
      revision: this.revision,
      timestamp: Date.now(),
      author,
    };
    this.history.push(patch);
    Array.from(this.listeners).forEach((listener) => {
      try {
        listener(patch, this.state);
      } catch {
        // a misbehaving listener shouldn't break the agent run
      }
    });
    return patch;
  }
}
