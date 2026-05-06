// ──────────────────────────────────────────────────────────────────────────
// POST /api/render
//
// Dispatches to either the cloud OpenAI-compat backend or the local ComfyUI
// backend. The frontend picks the backend kind; we just route.
//
// Body (cloud):
//   {
//     prompt, negativePrompt?, aspectRatio?,
//     backend: { kind: 'cloud', apiKey, baseUrl, modelId }
//   }
//
// Body (comfyui):
//   {
//     prompt, negativePrompt?, aspectRatio?,
//     backend: { kind: 'comfyui', url, checkpoint, apiKey? }
//   }
//
// Legacy (still accepted): top-level apiKey/baseUrl/modelId — treated as cloud.
//
// Response:
//   { ok: true,  imageUrl, durationMs, backend: 'cloud' | 'comfyui' }
//   { ok: false, error: string,        durationMs }
// ──────────────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  renderImage,
  type RenderAspectRatio,
} from '@/core/render/renderClient';
import { renderViaComfy } from '@/core/render/comfyClient';

interface CloudBackendConfig {
  kind: 'cloud';
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

interface ComfyBackendConfig {
  kind: 'comfyui';
  url: string;
  checkpoint: string;
  apiKey?: string;
}

type BackendConfig = CloudBackendConfig | ComfyBackendConfig;

interface RequestBody {
  prompt?: string;
  negativePrompt?: string;
  aspectRatio?: RenderAspectRatio;
  backend?: BackendConfig;
  // legacy / convenience: flat fields → cloud
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

function resolveBackend(body: RequestBody): BackendConfig | { error: string } {
  if (body.backend) {
    if (body.backend.kind === 'cloud') {
      const { apiKey, baseUrl, modelId } = body.backend;
      if (!apiKey || !baseUrl || !modelId) {
        return { error: 'cloud backend requires apiKey, baseUrl, modelId' };
      }
      return { kind: 'cloud', apiKey, baseUrl, modelId };
    }
    if (body.backend.kind === 'comfyui') {
      const { url, checkpoint, apiKey } = body.backend;
      if (!url || !checkpoint) {
        return { error: 'comfyui backend requires url, checkpoint' };
      }
      return { kind: 'comfyui', url, checkpoint, apiKey };
    }
    return { error: `unknown backend kind: ${(body.backend as { kind?: string }).kind}` };
  }
  // legacy flat fields
  if (body.apiKey && body.baseUrl && body.modelId) {
    return { kind: 'cloud', apiKey: body.apiKey, baseUrl: body.baseUrl, modelId: body.modelId };
  }
  return { error: 'backend or (apiKey, baseUrl, modelId) is required' };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body ?? {}) as RequestBody;
  if (!body.prompt || !body.prompt.trim()) {
    return res.status(400).json({ ok: false, error: 'prompt is required' });
  }

  const backend = resolveBackend(body);
  if ('error' in backend) {
    return res.status(400).json({ ok: false, error: backend.error });
  }

  const t0 = Date.now();
  try {
    let imageUrl: string;
    if (backend.kind === 'cloud') {
      const result = await renderImage(
        { apiKey: backend.apiKey, baseUrl: backend.baseUrl, modelId: backend.modelId },
        {
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          aspectRatio: body.aspectRatio,
        }
      );
      imageUrl = result.imageUrl;
    } else {
      const result = await renderViaComfy(
        { url: backend.url, checkpoint: backend.checkpoint, apiKey: backend.apiKey },
        {
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          aspectRatio: body.aspectRatio,
        }
      );
      imageUrl = result.imageUrl;
    }
    return res.status(200).json({
      ok: true,
      imageUrl,
      backend: backend.kind,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[api/render] ${backend.kind} backend failed after ${Date.now() - t0}ms`,
      '\n  prompt   :', (body.prompt ?? '').slice(0, 120),
      '\n  aspect   :', body.aspectRatio,
      '\n  config   :', backend.kind === 'comfyui'
        ? { url: backend.url, checkpoint: backend.checkpoint }
        : { baseUrl: backend.baseUrl, modelId: backend.modelId },
      '\n  error    :', errMsg
    );
    return res.status(502).json({
      ok: false,
      error: errMsg,
      backend: backend.kind,
      durationMs: Date.now() - t0,
    });
  }
}
