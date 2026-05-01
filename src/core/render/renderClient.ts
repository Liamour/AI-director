// ──────────────────────────────────────────────────────────────────────────
// renderClient — OpenAI-compatible image generation client.
//
// Mirrors src/core/agents/base/llmClient.ts but for /v1/images/generations.
// Designed to work transparently with:
//   - OpenAI proper                 (dall-e-3 / gpt-image-1)
//   - Aipro / OpenRouter / 一八 etc. (third-party proxies aggregating providers)
//   - Any backend that speaks the same request/response shape
//
// We accept either form of base url:
//   - sdk-style:  https://api.openai.com/v1
//   - full path:  https://api.openai.com/v1/images/generations
// If the user pasted /v1/chat/completions by mistake we swap the verb.
// ──────────────────────────────────────────────────────────────────────────

export type RenderAspectRatio = '9:16' | '4:5' | '16:9' | '1:1';

export interface RenderConfig {
  /** OpenAI-style base url OR full /v1/images/generations endpoint */
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

export interface RenderRequest {
  prompt: string;
  aspectRatio?: RenderAspectRatio;
  /** if the upstream model supports it — most OpenAI-style endpoints ignore this */
  negativePrompt?: string;
}

export interface RenderResult {
  /** absolute remote url, OR data: url if the server returned b64_json */
  imageUrl: string;
  raw: unknown;
}

/** strip trailing slashes, normalize action verb */
export function resolveImagesGenerationsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (/\/images\/generations$/i.test(trimmed)) return trimmed;
  // user pasted chat completions endpoint by mistake — swap verb instead of double-appending
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/i, '/images/generations');
  }
  return `${trimmed}/images/generations`;
}

const SIZE_BY_ASPECT: Record<RenderAspectRatio, string> = {
  '1:1':  '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  // dall-e doesn't have native 4:5; fall back to square. flux/sd-style models
  // that accept arbitrary sizes will just use 1024×1024 here too.
  '4:5':  '1024x1024',
};

export async function renderImage(
  config: RenderConfig,
  request: RenderRequest,
  options: { signal?: AbortSignal } = {}
): Promise<RenderResult> {
  if (!config.apiKey)  throw new Error('render: no apiKey');
  if (!config.baseUrl) throw new Error('render: no baseUrl');
  if (!config.modelId) throw new Error('render: no modelId');

  const url = resolveImagesGenerationsUrl(config.baseUrl);
  const size = SIZE_BY_ASPECT[request.aspectRatio ?? '1:1'];

  const body: Record<string, unknown> = {
    model: config.modelId,
    prompt: request.prompt,
    n: 1,
    size,
    response_format: 'url',
  };
  // some providers (sd/flux backends behind aipro) honor this; openai ignores it silently
  if (request.negativePrompt) {
    body.negative_prompt = request.negativePrompt;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err ? (err as { cause?: unknown }).cause : null;
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : '';
    const baseMsg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `fetch failed → ${url}${causeMsg ? ` · ${causeMsg}` : ` · ${baseMsg}`}`
    );
  }

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`image http ${res.status} → ${url} · ${text.slice(0, 240)}`);
  }

  const json = await res.json();
  const item = json?.data?.[0];
  const imageUrl =
    typeof item?.url === 'string'
      ? item.url
      : typeof item?.b64_json === 'string'
        ? `data:image/png;base64,${item.b64_json}`
        : null;
  if (!imageUrl) {
    throw new Error('image response missing data[0].url or data[0].b64_json');
  }
  return { imageUrl, raw: json };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable response body>';
  }
}
