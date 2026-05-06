// ──────────────────────────────────────────────────────────────────────────
// POST /api/stage1/generate-story  (v2 · episode-first)
//
// LLM produces a single markdown document with `## EP{N}: <title>` section
// headings. Server parses the markdown into a structured Episode[] and
// returns it. Episode content stays markdown — that's the source of truth
// for the per-episode 剧本.md files on disk.
//
// Why markdown delimiters not JSON:
//   Long-form prose in JSON strings is fragile (escape hell, easy to
//   truncate). H2 delimiters survive every model we tested and the diff
//   to plain markdown is tiny.
//
// Body:
//   {
//     idea: string,
//     project: { format: ProjectFormat, style: { preset: ArtStylePreset } },
//     apiKey, baseUrl, modelId
//   }
//
// Response (success):
//   { ok: true, story: StoryProject, durationMs }
// ──────────────────────────────────────────────────────────────────────────

import type { NextApiRequest, NextApiResponse } from 'next';
import { callLlm } from '@/core/agents/base/llmClient';
import type { Backbone } from '@/core/agents/base/types';
import type { ProjectFormat, ArtStylePreset } from '@/core/types/project';
import {
  STORY_SCHEMA_VERSION,
  generateEpisodeId,
  type Episode,
  type StoryProject,
} from '@/core/types/story';

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
    '剧集 — 多集长篇。生成 4-8 集，每集 200-500 字散文，节奏分明，集尾留有钩子。',
  shortform:
    '短视频 — 单条 30 秒到 3 分钟。1-3 个 act，每 act 100-200 字，开头 5 秒抓住注意力。',
  comic:
    '漫画 — 按页组织。生成 4-8 页，每页 100-200 字描述（含分格画面 + 必要对白），用"## EP{N}"代表页号。',
  animation:
    '动画 — 分场景 sequence。生成 4-8 个 sequence，每个 200-400 字，强调视觉化动作描写。',
};

const STYLE_GUIDANCE: Partial<Record<ArtStylePreset, string>> = {
  photoreal: '写实风格 — 自然光线、真实质感、细腻心理描写。',
  cyberpunk: '赛博朋克 — 霓虹、雨夜、机械义体、信息过载、孤独的反英雄。',
  anime: '日系二次元 — 戏剧化构图、青春主题、视觉符号清晰。',
  'oil-painting': '油画质感 — 厚重笔触、戏剧光影、文学性叙述、缓慢节奏。',
  comic: '美式漫画 — 强烈对比、英雄主义、动作戏剧化。',
  pixar: '三维卡通 — 暖色家庭主题、轻盈幽默、双层观看（孩子/大人）。',
};

function buildSystemPrompt(format: ProjectFormat, stylePreset?: ArtStylePreset): string {
  const fmtRule = FORMAT_GUIDANCE[format];
  const styleRule = stylePreset ? STYLE_GUIDANCE[stylePreset] : undefined;
  return [
    '你是一名专业编剧。给定用户的灵感和项目参数，',
    '直接产出一份"分集 markdown"剧本（散文体，不含运镜）。',
    '',
    '## 输出格式（严格遵守）',
    '',
    '```',
    '# <项目标题>',
    '',
    '## EP1: <分集标题>',
    '> Logline: <一两句钩子>',
    '',
    '<这一集的散文正文，可多段，markdown 自由>',
    '',
    '## EP2: <分集标题>',
    '> Logline: <一两句钩子>',
    '',
    '<这一集的散文正文>',
    '',
    '...',
    '```',
    '',
    '## 集数与篇幅',
    '',
    fmtRule,
    '',
    '## 风格基调',
    '',
    styleRule ?? '由用户自由发挥的视觉风格。',
    '',
    '## 硬性禁令',
    '',
    '1. 必须用 `## EP{N}: <标题>` H2 作为分集分隔（数字从 1 开始）',
    '2. H2 紧跟一行 `> Logline: ...` 引用块',
    '3. **不要写镜头语言**（"大全景"、"特写"等是 Stage 2 的事）',
    '4. **不要写格式化对白**（"角色名：『台词』"）— 用散文叙述',
    '5. **不要前言后记** — 直接从 `# 项目标题` 开始',
    '6. 每集都要有实质内容（≥ 100 字），不能空壳',
  ].join('\n');
}

// ── Markdown → Episode[] parser ──────────────────────────────────────────

interface ParseResult {
  title?: string;
  episodes: Episode[];
}

/**
 * Split LLM markdown on `## EP{N}: ...` headings and extract per-episode
 * { number, title, logline, content }. Robust to:
 *  - LLM forgetting the EP prefix sometimes (we accept `## 1: ...` too)
 *  - missing / malformed logline lines
 *  - extra blank lines
 *  - leading prose before the first heading (folded into project title block)
 */
function parseEpisodeMarkdown(raw: string): ParseResult {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  // Project title — first H1 we see before any episode heading
  let projectTitle: string | undefined;

  // Working episode buffer
  let cur: { number: number; title: string; logline?: string; content: string[] } | null = null;
  const out: ParseResult['episodes'] = [];

  const flush = () => {
    if (!cur) return;
    const content = cur.content.join('\n').trim();
    out.push({
      id: generateEpisodeId(),
      number: cur.number,
      title: cur.title,
      logline: cur.logline,
      content,
      updatedAt: new Date().toISOString(),
    });
    cur = null;
  };

  // accept: `## EP1: ...`, `## EP 1: ...`, `## 1. ...`, `## 1: ...`
  const epHeadingRe = /^##\s*(?:EP\s*)?(\d+)\s*[.:、·]\s*(.+?)\s*$/i;
  const loglineRe = /^>\s*(?:logline|钩子|一句话)\s*[:：]\s*(.+?)\s*$/i;

  for (const line of lines) {
    // h1 title (only catches if before any episode)
    if (cur === null && /^#\s+/.test(line)) {
      if (!projectTitle) projectTitle = line.replace(/^#\s+/, '').trim();
      continue;
    }

    const ep = line.match(epHeadingRe);
    if (ep) {
      flush();
      cur = {
        number: parseInt(ep[1], 10),
        title: ep[2].trim(),
        content: [],
      };
      continue;
    }

    if (!cur) continue; // skip prose between H1 and first episode

    // first non-empty line after heading might be logline
    const lg = line.match(loglineRe);
    if (lg && !cur.logline && cur.content.every((l) => l.trim() === '')) {
      cur.logline = lg[1].trim();
      continue;
    }

    cur.content.push(line);
  }
  flush();

  // Sanity pass: sort by number, renumber to be contiguous from 1
  out.sort((a, b) => a.number - b.number);
  out.forEach((ep, i) => {
    ep.number = i + 1;
  });

  return { title: projectTitle, episodes: out };
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
        { role: 'user', content: `灵感：${body.idea.trim()}` },
      ],
      {
        // multi-episode prose — generous budget
        maxTokens: 6144,
        temperature: 0.85,
      }
    );

    const raw = (result.content ?? '').trim();
    if (!raw) {
      // eslint-disable-next-line no-console
      console.error('[generate-story] empty content', result.raw);
      return res.status(502).json({
        ok: false,
        error: 'llm returned empty content',
        durationMs: Date.now() - t0,
      });
    }

    const parsed = parseEpisodeMarkdown(raw);
    if (parsed.episodes.length === 0) {
      // eslint-disable-next-line no-console
      console.error(
        '[generate-story] no episodes parsed. raw head:',
        raw.slice(0, 600)
      );
      return res.status(502).json({
        ok: false,
        error: 'could not parse any episodes from llm output',
        durationMs: Date.now() - t0,
      });
    }

    const now = new Date().toISOString();
    const story: StoryProject = {
      schemaVersion: STORY_SCHEMA_VERSION,
      idea: body.idea.trim(),
      title: parsed.title,
      episodes: parsed.episodes,
      generatedAt: now,
      updatedAt: now,
    };

    return res.status(200).json({
      ok: true,
      story,
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
