// ──────────────────────────────────────────────────────────────────────────
// ScreenwriterAgent — turns a raw user idea into a structured ScriptEngram.
//
// Department: writing.
// Backbone : prefers a model strong at long-form structured prose
//             (DeepSeek / Doubao / GPT-4o / Gemini). Configurable.
// Output   : full ScriptEngram (title, logline, characters, scenes, shots).
//
// This agent currently does the "do everything in one shot" work that the
// old /api/generate endpoint did. The win is:
//   - schema enforcement + self-healing
//   - emits structured events
//   - swappable backbone
//   - readable boundary for splitting later (we'll factor out CharacterAgent
//     and StoryboardAgent in a follow-up)
// ──────────────────────────────────────────────────────────────────────────

import { BaseAgent, withSchemaPostamble, type BaseAgentDef } from '../base/BaseAgent';
import type { Backbone, SchemaNode } from '../base/types';
import type { ScriptEngram } from '@/core/types/script';

export interface ScreenwriterInput {
  idea: string;
  /** optional knob-style hints from UI (style/motion/lens/mood pct strings) */
  parameters?: {
    style?: string;
    motion?: string;
    lens?: string;
    mood?: string;
  };
  /** optional shot count target — defaults to 8-12 */
  shotCountHint?: number;
}

export type ScreenwriterOutput = ScriptEngram;

const SCREENWRITER_OUTPUT_SCHEMA: SchemaNode = {
  type: 'object',
  required: ['title', 'logline', 'characters', 'scenes'],
  properties: {
    title: { type: 'string', minLength: 1 },
    logline: { type: 'string', minLength: 1 },
    characters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'appearance', 'role'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          appearance: { type: 'string', minLength: 1 },
          role: { type: 'string', minLength: 1 },
        },
      },
    },
    scenes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['sceneId', 'location', 'timeOfDay', 'environment', 'shots'],
        properties: {
          sceneId: { type: 'string', minLength: 1 },
          location: { type: 'string', minLength: 1 },
          timeOfDay: { type: 'string', minLength: 1 },
          environment: { type: 'string', minLength: 1 },
          shots: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['shotId', 'type', 'visualDescription'],
              properties: {
                shotId: { type: 'string', minLength: 1 },
                type: { type: 'string', minLength: 1 },
                visualDescription: { type: 'string', minLength: 1 },
                dialogue: { type: 'string' },
                action: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

const SCREENWRITER_PERSONA = `
You are an elite cinematic screenwriter and storyboard architect.
Given a single concept from the user, you produce a fully realised ScriptEngram:
a title, a one-sentence logline, a small cast bible, and 1-3 scenes broken into shots.

Style guidance:
- Lean, visual prose. Every shot's visualDescription should read like a director's notebook.
- Shot.type uses cinematic vocabulary: "wide", "medium", "close", "extreme close",
  "pov", "aerial", "tracking", "handheld", etc.
- Cast 1-4 characters max. Give each a distinctive appearance line.
- Aim for 8-12 shots total across all scenes.
- Honour any parameters block the user provides — treat style/motion/lens/mood
  as creative direction, not flavour text.
`.trim();

export function createScreenwriterAgent(backbone: Backbone): ScreenwriterAgent {
  const def: BaseAgentDef<ScreenwriterInput, ScreenwriterOutput> = {
    name: 'screenwriter',
    role: 'writer',
    defaultBackbone: backbone,
    outputSchema: SCREENWRITER_OUTPUT_SCHEMA,
    temperature: 0.8,
    buildSystemPrompt: () =>
      withSchemaPostamble(SCREENWRITER_PERSONA, SCREENWRITER_OUTPUT_SCHEMA),
    buildUserPrompt: (input) => buildUserMessage(input),
  };
  return new ScreenwriterAgent(def);
}

export class ScreenwriterAgent extends BaseAgent<ScreenwriterInput, ScreenwriterOutput> {}

function buildUserMessage(input: ScreenwriterInput): string {
  const lines: string[] = [];
  if (input.parameters) {
    const p = input.parameters;
    const params = [
      p.style && `style ${p.style}`,
      p.motion && `motion ${p.motion}`,
      p.lens && `lens ${p.lens}`,
      p.mood && `mood ${p.mood}`,
    ]
      .filter(Boolean)
      .join(', ');
    if (params) lines.push(`[parameters: ${params}]`);
  }
  if (input.shotCountHint) {
    lines.push(`[target shot count: ~${input.shotCountHint}]`);
  }
  if (lines.length) lines.push('');
  lines.push(input.idea.trim());
  return lines.join('\n');
}
