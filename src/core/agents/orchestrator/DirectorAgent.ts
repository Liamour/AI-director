// ──────────────────────────────────────────────────────────────────────────
// DirectorAgent — the orchestrator.
//
// Unlike the workers, the Director itself does not call an LLM directly
// (in this milestone). It builds a fixed plan and dispatches sub-agents in
// the right order, writing each result back to the shared Engram blackboard.
//
// In M2 we'll add an LLM-driven planner so the Director can dynamically
// pick which agent to call next based on engram state. For M1 a fixed
// pipeline (writer → cinematographer for every shot) gives us the full
// shape of the system without that complexity.
//
// Lifecycle:
//   plan(input) → returns the steps it intends to run
//   run(input)  → executes the plan, streaming events
// ──────────────────────────────────────────────────────────────────────────

import type {
  AgentError,
  AgentEventSink,
  AgentResult,
  Backbone,
} from '../base/types';
import { Engram } from '../blackboard/Engram';
import {
  createScreenwriterAgent,
  type ScreenwriterInput,
  type ScreenwriterOutput,
} from '../workers/ScreenwriterAgent';
import {
  createCinematographerAgent,
  type CinematographerOutput,
} from '../workers/CinematographerAgent';

export interface DirectorInput {
  /** the raw user idea — what the prompt textarea collects */
  idea: string;
  /** UI knob hints — passed through to every agent that cares */
  parameters?: ScreenwriterInput['parameters'];
  /** target aspect ratio for image prompts */
  aspectRatio?: '9:16' | '4:5' | '16:9' | '1:1';
  /** how many shot prompts to generate — null/undefined means "all of them" */
  cinematographerShotLimit?: number;
}

export interface DirectorPlanStep {
  agent: string;
  description: string;
}

export interface DirectorOutput {
  engram: ReturnType<Engram['snapshot']>;
  imagePrompts: CinematographerOutput[];
  /** ordered list of per-step results — useful for UI timeline */
  trace: DirectorTraceEntry[];
}

export interface DirectorTraceEntry {
  step: number;
  agent: string;
  ok: boolean;
  attempts: number;
  durationMs: number;
  error?: AgentError;
}

export interface DirectorBackbones {
  /** backbone for ScreenwriterAgent */
  writer: Backbone;
  /** backbone for CinematographerAgent — defaults to writer if omitted */
  cinematographer?: Backbone;
}

export class DirectorAgent {
  readonly name = 'director';
  readonly role = 'orchestrator';

  private backbones: DirectorBackbones;

  constructor(backbones: DirectorBackbones) {
    this.backbones = backbones;
  }

  /** Pure: returns the steps that run() *would* execute. UI can preview. */
  plan(input: DirectorInput): DirectorPlanStep[] {
    return [
      {
        agent: 'screenwriter',
        description: 'turn idea into title + logline + cast + scenes + shots',
      },
      {
        agent: 'cinematographer',
        description:
          input.cinematographerShotLimit !== undefined
            ? `generate image prompt for first ${input.cinematographerShotLimit} shots`
            : 'generate image prompt for every shot in parallel',
      },
    ];
  }

  async run(
    input: DirectorInput,
    options: { signal?: AbortSignal; onEvent?: AgentEventSink; engram?: Engram } = {}
  ): Promise<AgentResult<DirectorOutput>> {
    const started = Date.now();
    const onEvent = options.onEvent ?? (() => {});
    const engram = options.engram ?? new Engram();
    const trace: DirectorTraceEntry[] = [];

    onEvent({ type: 'agent:start', agent: this.name, input });

    // ── step 1: screenwriter ────────────────────────────────────────────
    onEvent({ type: 'agent:thinking', agent: this.name, attempt: 1 });
    const writer = createScreenwriterAgent(this.backbones.writer);
    const writerInput: ScreenwriterInput = {
      idea: input.idea,
      parameters: input.parameters,
    };
    const writerResult = await writer.run(writerInput, {
      signal: options.signal,
      onEvent,
    });
    trace.push({
      step: 1,
      agent: writer.name,
      ok: writerResult.ok,
      attempts: writerResult.meta.attempts,
      durationMs: writerResult.meta.durationMs,
      error: writerResult.ok ? undefined : writerResult.error,
    });
    if (!writerResult.ok) {
      const meta = {
        agentName: this.name,
        backbone: this.backbones.writer.name,
        attempts: 1,
        durationMs: Date.now() - started,
      };
      onEvent({ type: 'agent:error', agent: this.name, error: writerResult.error });
      return { ok: false, error: writerResult.error, meta };
    }
    engram.replaceAll(writer.name, writerResult.value as ScreenwriterOutput);
    onEvent({
      type: 'engram:patch',
      path: '*',
      revision: engram.getRevision(),
    });

    // ── step 2: cinematographer (in parallel) ───────────────────────────
    const cinema = createCinematographerAgent(
      this.backbones.cinematographer ?? this.backbones.writer
    );
    const allShots = engram.allShots();
    const limit =
      input.cinematographerShotLimit !== undefined
        ? Math.min(input.cinematographerShotLimit, allShots.length)
        : allShots.length;
    const targetShots = allShots.slice(0, limit);

    const imagePromptResults = await Promise.all(
      targetShots.map(({ scene, shot }) =>
        cinema.run(
          {
            scene,
            shot,
            characters: engram.snapshot().characters,
            parameters: input.parameters,
            aspectRatio: input.aspectRatio,
          },
          { signal: options.signal, onEvent }
        )
      )
    );

    const imagePrompts: CinematographerOutput[] = [];
    imagePromptResults.forEach((r, i) => {
      trace.push({
        step: 2 + i,
        agent: cinema.name,
        ok: r.ok,
        attempts: r.meta.attempts,
        durationMs: r.meta.durationMs,
        error: r.ok ? undefined : r.error,
      });
      if (r.ok) {
        imagePrompts.push(r.value);
        engram.setImagePrompt(cinema.name, {
          shotId: r.value.shotId,
          imagePrompt: r.value.imagePrompt,
          negativePrompt: r.value.negativePrompt,
          aspectRatio: r.value.aspectRatio,
        });
        onEvent({
          type: 'engram:patch',
          path: `imagePrompts[${r.value.shotId}]`,
          revision: engram.getRevision(),
        });
      }
    });

    // partial success is OK — we don't fail the whole plan if one shot prompt fails
    const meta = {
      agentName: this.name,
      backbone: this.backbones.writer.name,
      attempts: 1,
      durationMs: Date.now() - started,
    };
    const output: DirectorOutput = {
      engram: engram.snapshot(),
      imagePrompts,
      trace,
    };
    onEvent({ type: 'agent:output', agent: this.name, output });
    onEvent({ type: 'agent:done', agent: this.name, meta });
    return { ok: true, value: output, meta };
  }
}
