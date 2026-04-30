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

  const body = {
    model: backbone.modelId,
    messages,
    temperature: options.temperature ?? backbone.temperature ?? 0.7,
    ...(options.maxTokens || backbone.maxTokens
      ? { max_tokens: options.maxTokens ?? backbone.maxTokens }
      : {}),
  };

  const res = await fetch(backbone.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backbone.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`llm http ${res.status}: ${text.slice(0, 240)}`);
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
