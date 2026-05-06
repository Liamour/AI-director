// ──────────────────────────────────────────────────────────────────────────
// POST /api/stage1/analyze-episodes
//
// Sprint 2.2. Given the prose script and project format, ask the LLM to
// propose N coherent episode cut points. Returns offsets into the original
// markdown — the script itself is NOT mutated.
//
// Body:
//   {
//     content: string,                 // full markdown of 总剧本.md
//     project: { format: ProjectFormat },
//     apiKey, baseUrl, modelId
//   }
//
// Response (success):
//   {
//     ok: true,
//     index: ScriptIndex,              // ready to drop into useProjectStore /
//                                      // write to 总剧本.index.json
//     durationMs: number
//   }
// ──────────────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLlm } from '@/core/agents/base/llmClient';
import type { Backbone } from '@/core/agents/base/types';
import type { ProjectFormat } from '@/core/types/project';
import {
  SCRIPT_INDEX_SCHEMA_VERSION,
  generateEpisodeId,
  type EpisodeBoundary,
  type ScriptIndex,
} from '@/core/types/story';

interface RequestBody {
  content?: string;
  project?: { format?: ProjectFormat };
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

const FORMAT_TARGET: Record<ProjectFormat, string> = {
  series:    '4-8 集，每集 1 个完整叙事弧',
  shortform: '1-3 个 act',
  comic:     '按页切，每页 1 个 boundary（如果总剧本里有 `## Page N` 就直接用它们的位置）',
  animation: '4-8 个 sequence',
};

function buildSystemPrompt(format: ProjectFormat): string {
  return [
    '你是一位资深影视剧组「场记 / story editor」。给定一篇散文体剧本（markdown），',
    '你需要提出"分集 / 分段"切割点。每个切点对应输出物里的一个 episode。',
    '',
    '## 切点格式',
    '',
    '每个 episode 由三个字段组成：',
    '- `offset`: 该集起点在 markdown 字符串中的字符下标（0-based，UTF-16 codeunit）',
    '- `title`: 4-12 字的小标题（中文，简洁有力，不要"第 N 集"前缀）',
    '- `reason`: 1-2 句话说明为什么从这里断开',
    '',
    '## 硬性约束',
    '',
    '1. 第一个 episode 的 `offset` 必须是 `0`',
    '2. `offset` 严格递增，不能重复',
    '3. 切点必须落在自然断点上（段落首、`##` 标题首等），不能从一句话中间切',
    '4. 不能切在 `# 标题` 之前 —— 第一个集必须包含正文起点',
    `5. 数量目标：${FORMAT_TARGET[format]}`,
    '',
    '## 输出格式',
    '',
    '严格的 JSON，无 markdown 围栏，无前言：',
    '',
    '```',
    '{',
    '  "episodes": [',
    '    { "offset": 0, "title": "<标题>", "reason": "<理由>" },',
    '    { "offset": 432, "title": "...", "reason": "..." }',
    '  ]',
    '}',
    '```',
    '',
    '只输出这个 JSON 对象，不要任何其他文本。',
  ].join('\n');
}

interface RawEpisode {
  offset?: unknown;
  title?: unknown;
  reason?: unknown;
}

interface RawAnalyzeResult {
  episodes?: RawEpisode[];
}

/**
 * Strip markdown fencing the LLM sometimes wraps JSON in, then JSON.parse.
 * Returns null if no recoverable JSON found.
 */
function extractJson(raw: string): RawAnalyzeResult | null {
  if (!raw) return null;
  // 1. try direct parse
  try {
    return JSON.parse(raw.trim()) as RawAnalyzeResult;
  } catch {
    /* fall through */
  }
  // 2. try ```json ... ``` block
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as RawAnalyzeResult;
    } catch {
      /* fall through */
    }
  }
  // 3. try first { ... last }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1)) as RawAnalyzeResult;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Coerce + sanitize raw LLM output into proper EpisodeBoundary[]:
 * - clamp offsets to [0, contentLength]
 * - dedupe and sort
 * - guarantee first offset == 0
 * - drop entries with no title
 */
function sanitizeEpisodes(
  raw: RawEpisode[] | undefined,
  contentLength: number
): EpisodeBoundary[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: EpisodeBoundary[] = [];
  for (const r of raw) {
    const offsetNum = Number(r?.offset);
    const title = typeof r?.title === 'string' ? r.title.trim() : '';
    if (!Number.isFinite(offsetNum) || !title) continue;
    const offset = Math.min(Math.max(0, Math.floor(offsetNum)), contentLength);
    cleaned.push({
      id: generateEpisodeId(),
      offset,
      title,
      reason: typeof r?.reason === 'string' ? r.reason.trim() : undefined,
    });
  }
  // Sort, dedupe by offset
  cleaned.sort((a, b) => a.offset - b.offset);
  const dedup: EpisodeBoundary[] = [];
  for (const ep of cleaned) {
    if (dedup.length === 0 || dedup[dedup.length - 1].offset !== ep.offset) {
      dedup.push(ep);
    }
  }
  // Guarantee first offset is 0 (LLM sometimes drops it).
  if (dedup.length > 0 && dedup[0].offset !== 0) {
    dedup.unshift({
      id: generateEpisodeId(),
      offset: 0,
      title: dedup[0].title === 'Pilot' ? 'Cold Open' : '开篇',
      reason: '自动补齐 offset=0 的首集',
    });
  }
  return dedup;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body ?? {}) as RequestBody;
  const t0 = Date.now();

  if (!body.content || !body.content.trim()) {
    return res.status(400).json({ ok: false, error: 'content is required' });
  }
  if (!body.apiKey || !body.baseUrl || !body.modelId) {
    return res.status(400).json({
      ok: false,
      error: 'apiKey, baseUrl, modelId are required',
    });
  }

  const format: ProjectFormat = body.project?.format ?? 'series';
  const content = body.content;

  const backbone: Backbone = {
    name: body.modelId,
    baseUrl: body.baseUrl,
    modelId: body.modelId,
    apiKey: body.apiKey,
  };

  try {
    const result = await callLlm(
      backbone,
      [
        { role: 'system', content: buildSystemPrompt(format) },
        {
          role: 'user',
          content: `剧本内容（${content.length} 字符）：\n\n${content}`,
        },
      ],
      {
        // analyze response is small structured JSON
        maxTokens: 2048,
        temperature: 0.3,
      }
    );

    const parsed = extractJson(result.content ?? '');
    if (!parsed) {
      // eslint-disable-next-line no-console
      console.error(
        '[analyze-episodes] could not extract json from llm response. raw:',
        (result.content ?? '').slice(0, 600)
      );
      return res.status(502).json({
        ok: false,
        error: 'llm returned non-json',
        durationMs: Date.now() - t0,
      });
    }

    const episodes = sanitizeEpisodes(parsed.episodes, content.length);
    if (episodes.length === 0) {
      return res.status(502).json({
        ok: false,
        error: 'llm produced zero usable episodes',
        durationMs: Date.now() - t0,
      });
    }

    const index: ScriptIndex = {
      schemaVersion: SCRIPT_INDEX_SCHEMA_VERSION,
      episodes,
      analyzedAt: new Date().toISOString(),
      analyzedContentLength: content.length,
    };

    return res.status(200).json({
      ok: true,
      index,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[analyze-episodes] failed:', message);
    return res.status(502).json({
      ok: false,
      error: message,
      durationMs: Date.now() - t0,
    });
  }
}
