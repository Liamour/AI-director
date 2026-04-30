import type { Character, Scene } from './script';

export type AgentRole =
  | 'writer'      // screenwriter — title, logline, synopsis
  | 'character'   // character designer — bible
  | 'board'       // storyboard artist — scenes + shots
  | 'prompt'      // prompt engineer — image-gen prompts per shot
  | 'critic';     // script doctor — validation pass

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'done' | 'error';

export interface WriterOutput {
  title: string;
  logline: string;
  synopsis: string;
  themes: string[];
}

export interface CharacterOutput {
  characters: Character[];
}

export interface BoardOutput {
  scenes: Scene[];
}

export interface ShotPrompt {
  shotId: string;
  imagePrompt: string;
  negativePrompt?: string;
  aspectRatio?: '9:16' | '4:5' | '16:9' | '1:1';
  lora?: string[];
}

export interface PromptOutput {
  shotPrompts: ShotPrompt[];
}

export interface CriticOutput {
  passed: boolean;
  warnings: string[];
  suggestions: string[];
}

export type AgentOutput =
  | WriterOutput
  | CharacterOutput
  | BoardOutput
  | PromptOutput
  | CriticOutput;

export interface AgentState {
  role: AgentRole;
  status: AgentStatus;
  startedAt?: number;
  completedAt?: number;
  output?: AgentOutput;
  log: string[];
  error?: string;
}

export interface AgentCallContext {
  userPrompt?: string;
  writer?: WriterOutput;
  character?: CharacterOutput;
  board?: BoardOutput;
  prompt?: PromptOutput;
}
