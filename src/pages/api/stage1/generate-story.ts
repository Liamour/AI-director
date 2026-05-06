// ──────────────────────────────────────────────────────────────────────────
// POST /api/stage1/generate-story
//
// Stage 1 entry point. Takes the user's seed idea + project metadata and
// returns a markdown prose draft. Stays at the storytelling layer — does
// NOT bake in shot decisions (those are Stage 2).
//
// Body:
//   {
//     idea: string,                              // user's seed
//     project: {                                 // from useProjectStore.meta
//       format: 'series' | 'shortform' | 'comic' | 'animation',
//       style: { preset: string, ... },
//     },
//     apiKey, baseUrl, modelId                   // OpenAI-compatible backbone
//   }
//
// Response:
//   { ok: true,  content: string, durationMs }   // markdown prose
//   { ok: false, error: string,  durationMs }
// ──────────────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLlm } from '@/core/agents/base/llmClient';
import type { Backbone } from '@/core/agents/base/types';
import type { ProjectFormat, ArtStylePreset } from '@/core/types/project';

interface RequestBody {
  idea?: string;
  project?: {
    format?: ProjectFormat;
    style?: { preset?: ArtStylePreset };
  };
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

const FORMAT_GUIDANCE: Record<ProjectFormat, string> = {
  series:
    '剧集 — 多集长篇故事。请按 4-8 集写出每集的核心节拍，每集 1-3 段散文概要，集与集之间用 `## 第 N 集 · <小标题>` 分隔。整篇 1500-2500 字。',
  shortform:
    '短视频 — 单条 30 秒到 3 分钟。1-3 个 act 即可，节奏紧凑，开头 5 秒抓住注意力。整篇 600-1000 字。',
  comic:
    '漫画 — 按页/分格组织。`## Page 1` `## Page 2` 这样切，每页给 3-6 个分格，每分格用一句话描述画面 + 必要对白。整篇 800-1500 字。',
  animation:
    '动画 — 分场景 sequence。每个 sequence 给一段散文叙述，标注大致时长，注意视觉化的动作描述。整篇 1500-2500 字。',
};

const STYLE_GUIDANCE: Partial<Record<ArtStylePreset, string>> = {
  photoreal: '写实风格 — 自然光线、真实质感、写实角色。文字描写偏重物理细节。',
  cyberpunk: '赛博朋克 — 霓虹、雨夜、机械义体、信息过载、孤独的反英雄。',
  anime: '日系二次元 — 夸张表情、戏剧化构图、青春主题、清晰的视觉符号。',
  'oil-painting': '油画质感 — 厚重笔触、戏剧光影、文学性叙述、缓慢节奏。',
  comic: '美式漫画 — 强烈对比、英雄主义、动作戏剧化、清晰的善恶冲突。',
  pixar: '三维卡通 — 暖色家庭主题、轻盈幽默、双层观看（孩子看故事，大人看寓意）。',
};

function buildSystemPrompt(format: ProjectFormat, stylePreset?: ArtStylePreset): string {
  const fmtRule = FORMAT_GUIDANCE[format];
  const styleRule = stylePreset ? STYLE_GUIDANCE[stylePreset] : undefined;
  return [
    '你是一名专业的影视/漫画编剧。给定用户的一句话灵感和项目参数，',
    '产出一篇 markdown 格式的"剧本草稿"（散文体，不是分镜剧本）。',
    '',
    '## 输出结构（必须遵守）',
    '',
    '```',
    '# <你建议的标题>',
    '',
    '## Logline',
    '<一句话核心钩子>',
    '',
    '## 世界观',
    '<时空背景，2-4 句>',
    '',
    '## 主要角色',
    '- <角色名>: <一两句外貌 + 性格描述>',
    '- ...（3-6 个）',
    '',
    '## 故事',
    '<散文体的故事正文，按下面的格式要求组织>',
    '```',
    '',
    '## 格式要求',
    '',
    fmtRule,
    '',
    '## 风格基调',
    '',
    styleRule ?? '由用户自由发挥的视觉风格。',
    '',
    '## 硬性禁令',
    '',
    '1. **不要写镜头语言**（"大全景"、"特写"、"低角度"等都是 Stage 2 的事）',
    '2. **不要写对白拼写格式**（不是"角色名：『台词』"，而是"她说...."的散文叙述）',
    '3. **不要给出 JSON / 编号列表替代散文**',
    '4. **不要前言或后记** — 直接从 `# 标题` 开始',
    '5. 如果灵感太短或太离谱，自由发挥但保持在用户给的方向上',
  ].join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = (req.body ?? {}) as RequestBody;
  const t0 = Date.now();

  if (!body.idea || !body.idea.trim()) {
    return res.status(400).json({ ok: false, error: 'idea is required' });
  }
  if (!body.apiKey || !body.baseUrl || !body.modelId) {
    return res.status(400).json({
      ok: false,
      error: 'apiKey, baseUrl, modelId are required',
    });
  }

  const format: ProjectFormat = body.project?.format ?? 'series';
  const stylePreset = body.project?.style?.preset;

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
        { role: 'system', content: buildSystemPrompt(format, stylePreset) },
        {
          role: 'user',
          content: `灵感：${body.idea.trim()}`,
        },
      ],
      {
        // long-form prose — generous token budget
        maxTokens: 4096,
        temperature: 0.85,
      }
    );

    const content = (result.content ?? '').trim();
    if (!content) {
      // eslint-disable-next-line no-console
      console.error('[generate-story] empty content from llm', result.raw);
      return res.status(502).json({
        ok: false,
        error: 'llm returned empty content',
        durationMs: Date.now() - t0,
      });
    }

    return res.status(200).json({
      ok: true,
      content,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[generate-story] failed:', message);
    return res.status(502).json({
      ok: false,
      error: message,
      durationMs: Date.now() - t0,
    });
  }
}
