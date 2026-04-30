// public surface of the agent runtime — import from here, not internal paths

export type {
  Backbone,
  ChatMessage,
  ChatRole,
  SchemaNode,
  AgentResult,
  AgentRunMeta,
  AgentError,
  AgentErrorKind,
  AgentEvent,
  AgentEventSink,
  AgentRunOptions,
} from './base/types';

export { BaseAgent, withSchemaPostamble } from './base/BaseAgent';
export type { BaseAgentDef } from './base/BaseAgent';

export { callLlm } from './base/llmClient';
export { extractJson } from './base/jsonExtract';
export { validate, schemaToTs } from './base/schema';

export { Engram } from './blackboard/Engram';
export type { EngramPatch, EngramListener, ShotImagePrompt } from './blackboard/Engram';

export {
  ScreenwriterAgent,
  createScreenwriterAgent,
} from './workers/ScreenwriterAgent';
export type { ScreenwriterInput, ScreenwriterOutput } from './workers/ScreenwriterAgent';

export {
  CinematographerAgent,
  createCinematographerAgent,
} from './workers/CinematographerAgent';
export type {
  CinematographerInput,
  CinematographerOutput,
} from './workers/CinematographerAgent';

export { DirectorAgent } from './orchestrator/DirectorAgent';
export type {
  DirectorInput,
  DirectorOutput,
  DirectorPlanStep,
  DirectorTraceEntry,
  DirectorBackbones,
} from './orchestrator/DirectorAgent';
