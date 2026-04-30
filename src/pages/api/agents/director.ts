// ──────────────────────────────────────────────────────────────────────────
// POST /api/agents/director
//
// Server-side endpoint that runs the full Director pipeline and returns
// the final ScriptEngram + image prompts + agent execution trace.
//
// Body shape:
//   {
//     idea: string,
//     apiKey: string,                 // bearer token forwarded to backbone
//     baseUrl: string,                // OpenAI-compatible chat endpoint
//     modelId: string,                // model id sent to backbone
//     parameters?: { style, motion, lens, mood }   // UI knob hints
//     aspectRatio?: '9:16' | '4:5' | '16:9' | '1:1'
//     cinematographerShotLimit?: number
//     // optional separate backbone for cinematographer:
//     cinematographer?: { apiKey, baseUrl, modelId }
//   }
//
// Streams nothing for now — single JSON response with the full trace.
// Streaming via SSE is a M2 follow-up so the workspace can show live
// "screenwriter thinking..." → "cinematographer thinking..." progress.
// ──────────────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';
import { DirectorAgent, type Backbone, type DirectorInput } from '@/core/agents';

interface BackbonePayload {
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

interface RequestBody extends DirectorInput, BackbonePayload {
  cinematographer?: BackbonePayload;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = req.body as RequestBody;
  const { idea, apiKey, baseUrl, modelId } = body;

  if (!idea || typeof idea !== 'string' || !idea.trim()) {
    return res.status(400).json({ ok: false, error: 'idea is required' });
  }
  if (!apiKey || !baseUrl || !modelId) {
    return res.status(400).json({ ok: false, error: 'apiKey, baseUrl, modelId are required' });
  }

  const writerBackbone: Backbone = {
    name: modelId,
    baseUrl,
    modelId,
    apiKey,
  };

  const cinemaBackbone: Backbone | undefined = body.cinematographer
    ? {
        name: body.cinematographer.modelId ?? modelId,
        baseUrl: body.cinematographer.baseUrl ?? baseUrl,
        modelId: body.cinematographer.modelId ?? modelId,
        apiKey: body.cinematographer.apiKey ?? apiKey,
      }
    : undefined;

  const director = new DirectorAgent({
    writer: writerBackbone,
    cinematographer: cinemaBackbone,
  });

  // collect events into a flat list — front-end gets the whole trace at once
  const events: unknown[] = [];

  try {
    const result = await director.run(
      {
        idea: body.idea,
        parameters: body.parameters,
        aspectRatio: body.aspectRatio,
        cinematographerShotLimit: body.cinematographerShotLimit,
      },
      {
        onEvent: (event) => {
          // strip large payloads from events so the response stays compact
          if (event.type === 'agent:start' || event.type === 'agent:output') {
            events.push({ type: event.type, agent: event.agent });
          } else {
            events.push(event);
          }
        },
      }
    );

    if (!result.ok) {
      return res.status(502).json({
        ok: false,
        error: result.error,
        meta: result.meta,
        events,
      });
    }

    return res.status(200).json({
      ok: true,
      data: result.value,
      meta: result.meta,
      events,
    });
  } catch (err) {
    console.error('[director] unexpected error', err);
    return res.status(500).json({
      ok: false,
      error: { kind: 'unknown', message: err instanceof Error ? err.message : String(err) },
      events,
    });
  }
}
