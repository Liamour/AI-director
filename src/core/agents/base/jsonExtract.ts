// LLMs love wrapping JSON in markdown fences and prose preamble.
// This extractor is the single defensive surface — change it once, fix everywhere.

export interface ExtractResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  cleaned?: string;
}

export function extractJson(raw: string): ExtractResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, error: 'empty response' };
  }

  let text = raw.trim();

  // strip ```json … ``` and ``` … ``` fences
  text = text.replace(/^\s*```(?:json|JSON)?\s*/i, '').replace(/\s*```\s*$/i, '');

  // sometimes the model still adds preamble — find the first { or [ and last } or ]
  const startIdx = firstStructuralIndex(text);
  const endIdx = lastStructuralIndex(text);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { ok: false, error: 'no JSON object/array found in response', cleaned: text };
  }

  const sliced = text.substring(startIdx, endIdx + 1);

  try {
    const value = JSON.parse(sliced);
    return { ok: true, value, cleaned: sliced };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      cleaned: sliced,
    };
  }
}

function firstStructuralIndex(s: string): number {
  const a = s.indexOf('{');
  const b = s.indexOf('[');
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function lastStructuralIndex(s: string): number {
  return Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
}
