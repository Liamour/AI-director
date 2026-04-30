// ──────────────────────────────────────────────────────────────────────────
// CinematographerAgent — turns one shot (within its scene + cast context)
// into a production-grade image-generation prompt suitable for ComfyUI / SD /
// Midjourney etc.
//
// Department: visual.
// Backbone : prefers a model strong at descriptive prose. Smaller/cheaper
//             than the screenwriter is fine — this runs once per shot.
// Output   : { shotId, imagePrompt, negativePrompt, aspectRatio }
//
// This is the agent that will eventually call the `image.generate` MCP tool
// in M3. For now it just produces the prompt text — the tool layer comes
// later. Separating concerns now makes that swap a one-liner.
// ──────────────────────────────────────────────────────────────────────────

import { BaseAgent, withSchemaPostamble, type BaseAgentDef } from '../base/BaseAgent';
import type { Backbone, SchemaNode } from '../base/types';
import type { Character, Scene, Shot } from '@/core/types/script';

export interface CinematographerInput {
  scene: Scene;
  shot: Shot;
  characters: Character[];
  /** UI knob hints — interpreted as creative weights */
  parameters?: {
    style?: string;
    motion?: string;
    lens?: string;
    mood?: string;
  };
  /** target aspect ratio — default 9:16 */
  aspectRatio?: '9:16' | '4:5' | '16:9' | '1:1';
}

export interface CinematographerOutput {
  shotId: string;
  imagePrompt: string;
  negativePrompt: string;
  aspectRatio: '9:16' | '4:5' | '16:9' | '1:1';
}

const CINEMATOGRAPHER_OUTPUT_SCHEMA: SchemaNode = {
  type: 'object',
  required: ['shotId', 'imagePrompt', 'negativePrompt', 'aspectRatio'],
  properties: {
    shotId: { type: 'string', minLength: 1 },
    imagePrompt: { type: 'string', minLength: 20 },
    negativePrompt: { type: 'string', minLength: 1 },
    aspectRatio: {
      type: 'string',
      enum: ['9:16', '4:5', '16:9', '1:1'],
    },
  },
};

const CINEMATOGRAPHER_PERSONA = `
You are a senior cinematographer translating a single storyboard shot into a
diffusion-model image prompt. You think in lenses, lighting, palette, and grain.

Compose the imagePrompt as a comma-separated tag stack in this order:
  1. subject + action (drawn from shot.visualDescription + shot.action)
  2. character anchors (use appearance lines from cast that are present in the shot)
  3. setting (from scene.location + scene.environment + scene.timeOfDay)
  4. shot type (wide / medium / close / pov / aerial / tracking ...)
  5. lens & framing (focal length, depth of field, composition)
  6. lighting & atmosphere
  7. style modifiers (cinematic, film grain, anamorphic, color grade, ratio etc.)

negativePrompt: comma-separated common artefacts to suppress
("blurry, lowres, deformed hands, extra fingers, watermark, text, jpeg artifacts").

Stay descriptive, dense, and concrete. No prose sentences inside imagePrompt —
tags only.
`.trim();

export function createCinematographerAgent(backbone: Backbone): CinematographerAgent {
  const def: BaseAgentDef<CinematographerInput, CinematographerOutput> = {
    name: 'cinematographer',
    role: 'prompt',
    defaultBackbone: backbone,
    outputSchema: CINEMATOGRAPHER_OUTPUT_SCHEMA,
    temperature: 0.5,
    buildSystemPrompt: () =>
      withSchemaPostamble(CINEMATOGRAPHER_PERSONA, CINEMATOGRAPHER_OUTPUT_SCHEMA),
    buildUserPrompt: (input) => buildUserMessage(input),
  };
  return new CinematographerAgent(def);
}

export class CinematographerAgent extends BaseAgent<
  CinematographerInput,
  CinematographerOutput
> {}

function buildUserMessage(input: CinematographerInput): string {
  const { scene, shot, characters, parameters, aspectRatio } = input;
  const castSection = characters.length
    ? characters.map((c) => `  - ${c.name} (${c.role}): ${c.appearance}`).join('\n')
    : '  (none)';

  const paramLine = parameters
    ? [
        parameters.style && `style=${parameters.style}`,
        parameters.motion && `motion=${parameters.motion}`,
        parameters.lens && `lens=${parameters.lens}`,
        parameters.mood && `mood=${parameters.mood}`,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return [
    `[shot]`,
    `  shotId: ${shot.shotId}`,
    `  type: ${shot.type}`,
    `  visual: ${shot.visualDescription}`,
    shot.action ? `  action: ${shot.action}` : null,
    shot.dialogue ? `  dialogue: "${shot.dialogue}"` : null,
    ``,
    `[scene]`,
    `  sceneId: ${scene.sceneId}`,
    `  location: ${scene.location}`,
    `  timeOfDay: ${scene.timeOfDay}`,
    `  environment: ${scene.environment}`,
    ``,
    `[cast in scope]`,
    castSection,
    ``,
    paramLine ? `[parameters] ${paramLine}` : null,
    `[target aspect ratio] ${aspectRatio ?? '9:16'}`,
    ``,
    `Produce the JSON now.`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
