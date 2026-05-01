// Thin OpenAI-compatible chat completions client.
// Works in Node (api routes) and the browser — only depends on global fetch.

import type { Backbone, ChatMessage } from './types';

export interface LlmCallOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCallResult {
  content: string;
  /** raw response object — kept for debugging / future tool-use parsing */
  raw: unknown;
}

/**
 * Accept both forms of `base url` users tend to paste:
 *   - full action endpoint:  https://api.openai.com/v1/chat/completions
 *   - sdk-style base:        https://api.openai.com/v1   ← OpenAI SDK convention
 * If the action verb is missing we append `/chat/completions`.
 * Trailing whitespace and slashes are stripped.
 */
export function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function callLlm(
  backbone: Backbone,
  messages: ChatMessage[],
  options: LlmCallOptions = {}
): Promise<LlmCallResult> {
  if (!backbone.apiKey) {
    throw new Error(`backbone "${backbone.name}" has no apiKey`);
  }
  if (!backbone.baseUrl || !backbone.modelId) {
    throw new Error(`backbone "${backbone.name}" missing baseUrl or modelId`);
  }

  const url = resolveChatCompletionsUrl(backbone.baseUrl);

  const body = {
    model: backbone.modelId,
    messages,
    temperature: options.temperature ?? backbone.temperature ?? 0.7,
    ...(options.maxTokens || backbone.maxTokens
      ? { max_tokens: options.maxTokens ?? backbone.maxTokens }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backbone.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    // node's undici reports network/tls/dns failures as a bare "fetch failed";
    // the actual reason is on err.cause. surface both so the user can debug.
    const cause = err instanceof Error && 'cause' in err ? (err as { cause?: unknown }).cause : null;
    const causeMsg =
      cause instanceof Error ? cause.message : cause ? String(cause) : '';
    const baseMsg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `fetch failed → ${url}${causeMsg ? ` · ${causeMsg}` : ` · ${baseMsg}`}`
    );
  }

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`llm http ${res.status} → ${url} · ${text.slice(0, 240)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('llm response missing choices[0].message.content');
  }
  return { content, raw: json };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable response body>';
  }
}
