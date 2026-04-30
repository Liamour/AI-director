// ──────────────────────────────────────────────────────────────────────────
// Agent base types — the contract every Agent / Backbone / Orchestrator obeys
// ──────────────────────────────────────────────────────────────────────────

/**
 * A "backbone" is the LLM that powers an agent.
 * Each agent picks (or inherits) one — this is what enables per-agent hot-swap.
 */
export interface Backbone {
  /** display name, e.g. "deepseek-chat" */
  name: string;
  /** OpenAI-compatible chat completions endpoint */
  baseUrl: string;
  /** model id sent in the request body */
  modelId: string;
  /** bearer token */
  apiKey: string;
  /** optional sampling defaults — agents can override per-call */
  temperature?: number;
  maxTokens?: number;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ── Schema (minimalist, no Zod dep) ────────────────────────────────────────

/**
 * A tiny JSON-Schema-shaped descriptor. Just enough to validate agent output.
 * Supported keywords: type, required, properties, items, enum, minLength.
 */
export type SchemaNode =
  | { type: 'string'; minLength?: number; enum?: string[] }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'array'; items: SchemaNode; minItems?: number }
  | { type: 'object'; required?: string[]; properties: Record<string, SchemaNode> };

// ── Result envelope ────────────────────────────────────────────────────────

export type AgentResult<T> =
  | { ok: true; value: T; meta: AgentRunMeta }
  | { ok: false; error: AgentError; meta: AgentRunMeta };

export interface AgentRunMeta {
  agentName: string;
  backbone: string;
  attempts: number;
  durationMs: number;
}

export type AgentErrorKind =
  | 'network'           // fetch failed / non-2xx
  | 'parse'             // could not extract JSON
  | 'schema'            // JSON parsed but failed schema validation
  | 'exhausted'         // all retries used
  | 'aborted'           // caller cancelled
  | 'tool'              // a tool the agent invoked failed (reserved for M2)
  | 'unknown';

export interface AgentError {
  kind: AgentErrorKind;
  message: string;
  /** raw LLM output that triggered the failure, when relevant */
  raw?: string;
  /** schema validation issues, when kind === 'schema' */
  issues?: string[];
}

// ── Events (observability — what the UI subscribes to) ─────────────────────

export type AgentEvent =
  | { type: 'agent:start'; agent: string; input: unknown }
  | { type: 'agent:thinking'; agent: string; attempt: number }
  | { type: 'agent:retry'; agent: string; attempt: number; reason: string }
  | { type: 'agent:output'; agent: string; output: unknown }
  | { type: 'agent:error'; agent: string; error: AgentError }
  | { type: 'agent:done'; agent: string; meta: AgentRunMeta }
  | { type: 'engram:patch'; path: string; revision: number };

export type AgentEventSink = (event: AgentEvent) => void;

// ── Run options ────────────────────────────────────────────────────────────

export interface AgentRunOptions {
  /** override the agent's default backbone */
  backbone?: Backbone;
  /** how many self-healing attempts to allow (default 3) */
  maxRetries?: number;
  /** cancellation */
  signal?: AbortSignal;
  /** event sink — orchestrator passes one in to multiplex */
  onEvent?: AgentEventSink;
}
