// ──────────────────────────────────────────────────────────────────────────
// comfyClient — ComfyUI HTTP client.
//
// ComfyUI's API surface (default port 8188):
//   POST /prompt              submit workflow → { prompt_id, node_errors }
//   GET  /history/{prompt_id} poll outputs    → { outputs: { node: { images } } }
//   GET  /view?filename=...   fetch image     → binary PNG
//
// We submit a Flux schnell text-to-image workflow with the cinematographer's
// prompt injected into a CLIPTextEncode node. Schnell only needs 4 steps,
// cfg=1.0, sampler=euler, scheduler=simple — same as ComfyUI's bundled example.
//
// IMPORTANT: this backend assumes the *server* (Next.js api route) can reach
// the user's ComfyUI URL. That works in:
//   - dev mode (localhost talks to localhost)
//   - Tauri desktop bundle (everything runs on user machine)
//   - NOT a hosted SaaS — there the user's browser would have to talk to
//     comfy directly (ComfyUI does have CORS open by default).
// ──────────────────────────────────────────────────────────────────────────

import type { RenderAspectRatio } from './renderClient';

export interface ComfyConfig {
  /** ComfyUI base url — typically http://localhost:8188 */
  url: string;
  /** Checkpoint filename as it appears under ComfyUI/models/checkpoints/ */
  checkpoint: string;
  /** Optional bearer token — most local installs don't need this */
  apiKey?: string;
}

export interface ComfyRenderRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: RenderAspectRatio;
  /** Flux schnell sweet spot is 4. Flux dev wants 20-30. */
  steps?: number;
  /** Flux uses cfg=1.0 in the KSampler path. */
  cfg?: number;
  seed?: number;
}

export interface ComfyRenderResult {
  imageUrl: string;
  raw: unknown;
}

/** Flux-friendly width/height per aspect — multiples of 64, ~1MP total */
const DIM_BY_ASPECT: Record<RenderAspectRatio, [number, number]> = {
  '1:1':  [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '4:5':  [1024, 1280],
};

export async function renderViaComfy(
  config: ComfyConfig,
  request: ComfyRenderRequest,
  options: { signal?: AbortSignal; pollIntervalMs?: number; maxWaitMs?: number } = {}
): Promise<ComfyRenderResult> {
  if (!config.url) throw new Error('comfy: no url');
  if (!config.checkpoint) throw new Error('comfy: no checkpoint');

  const baseUrl = config.url.trim().replace(/\/+$/, '');
  const [width, height] = DIM_BY_ASPECT[request.aspectRatio ?? '1:1'];
  const seed = request.seed ?? Math.floor(Math.random() * 2 ** 31);
  const steps = request.steps ?? 4;
  const cfg = request.cfg ?? 1.0;

  const workflow = buildFluxSchnellWorkflow({
    checkpoint: config.checkpoint,
    positivePrompt: request.prompt,
    negativePrompt: request.negativePrompt ?? '',
    width,
    height,
    seed,
    steps,
    cfg,
  });

  // ── 1. submit workflow ──────────────────────────────────────────────
  const submitHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) submitHeaders.Authorization = `Bearer ${config.apiKey}`;

  let submitRes: Response;
  try {
    submitRes = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify({ prompt: workflow }),
      signal: options.signal,
    });
  } catch (err) {
    const cause = err instanceof Error && 'cause' in err ? (err as { cause?: unknown }).cause : null;
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : '';
    const baseMsg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `fetch failed → ${baseUrl}/prompt${causeMsg ? ` · ${causeMsg}` : ` · ${baseMsg}`}`
    );
  }

  if (!submitRes.ok) {
    const text = await safeText(submitRes);
    throw new Error(
      `comfy submit http ${submitRes.status} → ${baseUrl}/prompt · ${text.slice(0, 240)}`
    );
  }

  const submitJson = await submitRes.json();
  const promptId = submitJson?.prompt_id;
  if (typeof promptId !== 'string') {
    throw new Error(
      `comfy submit response missing prompt_id · ${JSON.stringify(submitJson).slice(0, 240)}`
    );
  }
  const nodeErrors = submitJson?.node_errors;
  if (nodeErrors && typeof nodeErrors === 'object' && Object.keys(nodeErrors).length > 0) {
    // most common: ckpt_name not found in models/checkpoints/
    throw new Error(`comfy workflow errors · ${JSON.stringify(nodeErrors).slice(0, 240)}`);
  }

  // ── 2. poll history ─────────────────────────────────────────────────
  const pollIntervalMs = options.pollIntervalMs ?? 1500;
  const maxWaitMs = options.maxWaitMs ?? 5 * 60 * 1000; // 5 min hard cap
  const startTs = Date.now();

  while (Date.now() - startTs < maxWaitMs) {
    if (options.signal?.aborted) throw new Error('comfy: aborted');

    let historyRes: Response;
    try {
      historyRes = await fetch(`${baseUrl}/history/${promptId}`, { signal: options.signal });
    } catch {
      // transient — retry next tick
      await sleep(pollIntervalMs);
      continue;
    }
    if (!historyRes.ok) {
      // history is briefly absent right after submit — retry
      await sleep(pollIntervalMs);
      continue;
    }
    const historyJson = await historyRes.json();
    const entry = historyJson?.[promptId];
    if (entry?.outputs) {
      // Look for any node output containing images. We use SaveImage at node id "9"
      // in our default workflow, but be lenient if user customizes.
      const images = findImageOutput(entry.outputs);
      if (images && images.length > 0) {
        const image = images[0];
        const params = new URLSearchParams({
          filename: image.filename,
          subfolder: image.subfolder ?? '',
          type: image.type ?? 'output',
        });
        return {
          imageUrl: `${baseUrl}/view?${params.toString()}`,
          raw: historyJson,
        };
      }
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`comfy: timed out after ${maxWaitMs}ms · prompt_id=${promptId}`);
}

interface ComfyImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

function findImageOutput(
  outputs: Record<string, { images?: ComfyImage[] }>
): ComfyImage[] | null {
  // try the conventional SaveImage node first
  if (outputs['9']?.images?.length) return outputs['9'].images;
  // otherwise scan for any node with images
  for (const node of Object.values(outputs)) {
    if (node?.images && node.images.length > 0) return node.images;
  }
  return null;
}

interface FluxWorkflowParams {
  checkpoint: string;
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
}

/**
 * Minimal Flux text-to-image workflow using CheckpointLoaderSimple.
 * Assumes the user has Flux as a single merged .safetensors checkpoint
 * (most common case for "downloaded flux model from civitai/HF").
 *
 * For separated UNet+CLIP+VAE setups we'll need a v2 workflow with
 * UNETLoader + DualCLIPLoader + VAELoader nodes — todo.
 */
function buildFluxSchnellWorkflow(p: FluxWorkflowParams): unknown {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: p.seed,
        steps: p.steps,
        cfg: p.cfg,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: p.checkpoint,
      },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: p.width,
        height: p.height,
        batch_size: 1,
      },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: p.positivePrompt,
        clip: ['4', 1],
      },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: p.negativePrompt,
        clip: ['4', 1],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'ai_director',
        images: ['8', 0],
      },
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable response body>';
  }
}
