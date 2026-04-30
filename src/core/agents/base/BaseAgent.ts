// ──────────────────────────────────────────────────────────────────────────
// BaseAgent — the abstract that every concrete worker extends.
//
// Lifecycle of one run():
//   1. build messages (system + user) from input
//   2. attempt up to maxRetries:
//        a. call llm
//        b. extract JSON
//        c. validate against schema
//        d. if failure: append correction message and retry
//   3. emit events at each transition (start / thinking / retry / output / error / done)
//
// Self-healing happens in step 2d — we don't throw, we *teach the model*
// what was wrong and ask it to try again. This is the loop that turns
// "LLM call" into "Agent".
// ──────────────────────────────────────────────────────────────────────────

import { callLlm } from './llmClient';
import { extractJson } from './jsonExtract';
import { schemaToTs, validate } from './schema';
import type {
  AgentError,
  AgentResult,
  AgentRunMeta,
  AgentRunOptions,
  Backbone,
  ChatMessage,
  SchemaNode,
} from './types';

export interface BaseAgentDef<TInput, TOutput> {
  /** stable identifier — used in events and logs */
  name: string;
  /** which "department" this agent belongs to (matches AgentRole) */
  role: string;
  /** the LLM that powers it by default */
  defaultBackbone: Backbone;
  /** required output shape */
  outputSchema: SchemaNode;
  /** how the agent introduces itself to the LLM */
  buildSystemPrompt: (def: BaseAgentDef<TInput, TOutput>) => string;
  /** how the input becomes the first user message */
  buildUserPrompt: (input: TInput) => string;
  /** tweak default sampling for this agent */
  temperature?: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected def: BaseAgentDef<TInput, TOutput>;

  constructor(def: BaseAgentDef<TInput, TOutput>) {
    this.def = def;
  }

  get name(): string {
    return this.def.name;
  }

  get role(): string {
    return this.def.role;
  }

  async run(input: TInput, options: AgentRunOptions = {}): Promise<AgentResult<TOutput>> {
    const started = Date.now();
    const backbone = options.backbone ?? this.def.defaultBackbone;
    const maxRetries = Math.max(1, options.maxRetries ?? 3);
    const onEvent = options.onEvent ?? (() => {});

    onEvent({ type: 'agent:start', agent: this.name, input });

    const messages: ChatMessage[] = [
      { role: 'system', content: this.def.buildSystemPrompt(this.def) },
      { role: 'user', content: this.def.buildUserPrompt(input) },
    ];

    let lastError: AgentError | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      onEvent({ type: 'agent:thinking', agent: this.name, attempt });

      // 1. call llm
      let raw: string;
      try {
        const res = await callLlm(backbone, messages, {
          signal: options.signal,
          temperature: this.def.temperature,
        });
        raw = res.content;
      } catch (e) {
        // network errors are not self-healable — bail.
        const err: AgentError = {
          kind: e instanceof Error && e.name === 'AbortError' ? 'aborted' : 'network',
          message: e instanceof Error ? e.message : String(e),
        };
        onEvent({ type: 'agent:error', agent: this.name, error: err });
        return failure(this.name, backbone.name, attempts, started, err);
      }

      // 2. extract JSON
      const extracted = extractJson(raw);
      if (!extracted.ok) {
        lastError = { kind: 'parse', message: extracted.error ?? 'parse failed', raw };
        if (attempt === maxRetries) break;
        onEvent({
          type: 'agent:retry',
          agent: this.name,
          attempt,
          reason: `parse: ${lastError.message}`,
        });
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: parseCorrection(lastError.message),
        });
        continue;
      }

      // 3. validate schema
      const validated = validate<TOutput>(this.def.outputSchema, extracted.value);
      if (!validated.ok) {
        lastError = {
          kind: 'schema',
          message: 'schema validation failed',
          raw,
          issues: validated.issues,
        };
        if (attempt === maxRetries) break;
        onEvent({
          type: 'agent:retry',
          agent: this.name,
          attempt,
          reason: `schema: ${(validated.issues ?? []).slice(0, 3).join('; ')}`,
        });
        messages.push({ role: 'assistant', content: extracted.cleaned ?? raw });
        messages.push({
          role: 'user',
          content: schemaCorrection(validated.issues ?? [], this.def.outputSchema),
        });
        continue;
      }

      // ✅ success
      const meta: AgentRunMeta = {
        agentName: this.name,
        backbone: backbone.name,
        attempts,
        durationMs: Date.now() - started,
      };
      onEvent({ type: 'agent:output', agent: this.name, output: validated.value });
      onEvent({ type: 'agent:done', agent: this.name, meta });
      return { ok: true, value: validated.value as TOutput, meta };
    }

    // exhausted
    const finalError: AgentError = lastError ?? {
      kind: 'exhausted',
      message: `agent ${this.name} exhausted ${maxRetries} attempts`,
    };
    onEvent({ type: 'agent:error', agent: this.name, error: finalError });
    return failure(this.name, backbone.name, attempts, started, finalError);
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function failure<T>(
  agentName: string,
  backbone: string,
  attempts: number,
  startedAt: number,
  error: AgentError
): AgentResult<T> {
  return {
    ok: false,
    error,
    meta: {
      agentName,
      backbone,
      attempts,
      durationMs: Date.now() - startedAt,
    },
  };
}

function parseCorrection(reason: string): string {
  return [
    `Your previous response could not be parsed as JSON.`,
    `Reason: ${reason}.`,
    `Reply ONLY with valid JSON. No prose. No markdown fences. No commentary.`,
  ].join(' ');
}

function schemaCorrection(issues: string[], schema: SchemaNode): string {
  return [
    `Your previous JSON failed schema validation.`,
    `Issues:`,
    ...issues.slice(0, 8).map((i) => `  - ${i}`),
    ``,
    `The required schema is:`,
    schemaToTs(schema),
    ``,
    `Reply ONLY with corrected JSON that fully satisfies the schema.`,
  ].join('\n');
}

/**
 * Default system-prompt builder that injects the schema as TS interface text.
 * Concrete agents call this from their buildSystemPrompt and prepend their persona.
 */
export function withSchemaPostamble(persona: string, schema: SchemaNode): string {
  return [
    persona.trim(),
    ``,
    `Your output MUST be a JSON object matching exactly this TypeScript interface:`,
    schemaToTs(schema),
    ``,
    `Strict rules:`,
    `- Reply with raw JSON only. No prose, no markdown fences, no commentary.`,
    `- All required fields must be present.`,
    `- String fields must be non-empty.`,
    `- IDs must be stable, lowercase, kebab-case.`,
  ].join('\n');
}
