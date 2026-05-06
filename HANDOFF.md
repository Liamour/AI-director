# AI 世纪导演 · 项目交接手册 (Project Handoff Manual)

> **Project**: AI Storyboard Director · Multimodal AI Storyboard Synthesizer
> **Version**: 0.1.0 (MVP / 早期开发阶段)
> **Manual Date**: 2026-04-30
> **Branch**: `claude/infallible-lumiere-7f0045` (worktree) / `main`

---

## 0. 一句话项目介绍

**AI 世纪导演** 是一款面向影视创作者的「多模态 AI 故事板编排中枢」——用户输入一段创意文本（或导入既有剧本），由 LLM 输出严格结构化的 `ScriptEngram`（剧本工程化对象，包含角色、场景、分镜），最终在三栏工作区中可视化、编辑、并按本地项目目录组织资产。前端为 Next.js Web 应用，桌面端通过 Tauri 2 + Rust 后端获得本地文件系统能力。

---

## 1. 产品定位与核心价值

| 维度 | 说明 |
|------|------|
| 目标用户 | 影视编剧、导演、独立创作者、内容工作室 |
| 核心场景 | 从一句创意 → 成型剧本 + 分镜列表 + 角色卡 + 场景卡 |
| 核心差异 | ① 桌面级文件系统集成（项目即本地文件夹）；② 统一的 OpenAI 兼容网关，可一键切换 DeepSeek / 豆包 / Gemini / GPT-4o；③ 严格的 JSON Schema 输出 (ScriptEngram) 而非散文式回答 |
| 视觉调性 | Dark Industrial-Cyber：`#0A0A0A` 基色 + 玻璃拟态 + 青/红霓虹辉光（实际实现以 `#FF5000` 橙红为主调） |

---

## 1.5 产品五阶段架构（v0.2 设计目标）

> 本节描述**产品最终形态**。当前 MVP（见第 5 节）实现的是 Stage 1 的简化版（一次 LLM 调用直出 ScriptEngram），后续按下述阶段拓展。
>
> 设计原则：① 每阶段输出**结构化资产 + 落地文件**，跨阶段以 JSON 契约通信；② 每阶段都是 "AI 先提议 → 用户编辑确认" 的双步流程；③ 所有耗费算力的产出（图、视频）必须可复现（保留 prompt / seed / model / ref 元数据）。

### Stage 0 — 项目初始化

用户创建项目时**一次性锁定**全局参数（中途修改成本极高）：

| 字段 | 示例 | 影响范围 |
|---|---|---|
| 体裁 / format | 剧集 / 短视频 / 漫画 / 动画 | 决定剧本结构（集数、单集时长） |
| 输出比例 | 16:9 / 9:16 / 1:1 / 4:5 | 全部图像与视频画幅 |
| 美术风格 | 写实 / 赛博 / 二次元 / 油画 | 全局 prompt 注入 + style LoRA |
| 风格参考图 | 0-3 张用户上传 | IP-Adapter style 注入 |
| LLM 后端 | OpenAI 兼容网关 URL + key + model | Stage 1/1.5 |
| 渲染后端 | 云端图 API / 本地 ComfyUI | Stage 1.5 / 2 |

**项目目录（落地）**：

```
<project-root>/
├── project.json                # Stage 0 元数据
├── 总剧本.md                    # Stage 1 主剧本（散文 + 对白）
├── 总剧本.index.json           # Stage 1 结构化索引（分集边界、角色/场景索引）
├── 剧集分镜/
│   ├── EP01/
│   │   ├── 剧本.md             # 单集散文剧本
│   │   ├── 脚本.json           # 单集 beat list（分镜脚本）
│   │   ├── 关键帧/             # Stage 2 输出
│   │   │   ├── beat-01.png
│   │   │   ├── beat-01.meta.json
│   │   │   └── ...
│   │   └── 视频/               # Stage 3 输出
│   │       └── beat-01.mp4
│   └── EP02/...
├── 人物/                        # Stage 1.5 输出
│   ├── Vex/
│   │   ├── bible.json          # 角色设定（外貌 prompt / 性格 / 关系网）
│   │   ├── ref/                # 用户确认的锁定参考图（1-3 张）
│   │   ├── candidates/         # AI 生成的备选图（用户从中挑）
│   │   └── lora.safetensors    # （可选）训练得到的角色 LoRA
│   └── ...
├── 场景/
│   ├── 摩天大楼顶层/
│   │   ├── bible.json
│   │   └── ref/
│   └── ...
└── .ai-director/                # 工具元数据（不展示给用户）
    ├── version-history/         # 每次保存自动 snapshot
    └── llm-traces/              # 调试用 LLM 调用日志
```

### Stage 1 — 故事（Story）

输入：用户一句话 idea  
输出：总剧本 + 分集 + 每集分镜脚本

**子流程**：

1. **Idea → 总剧本草稿**：LLM 一次输出整个故事概要（散文 + 对白，不分集）
2. **AI 自动分集**：按叙事节奏切 N 集，每集附"为何在此断"的说明
3. **用户调整分集**：拖拽集边界 / 合并 / 拆分 / 重命名
4. **进入单集编辑**（每集独立选项卡）：
   - 主区：单集剧本编辑器（划选文字 → 悬浮 AI 续写 / 改写 / 加紧 / 加长）
   - 右上：本集出场角色 / 场景列表（结构化抽取，自动同步到 Stage 1.5）
   - 右下：单集分镜脚本（按 **beat 节拍**切分，不是 shot）
5. **保存 → 落地到 `剧集分镜/EP**`**

**关键决策**：分镜脚本的颗粒度是 **beat（叙事节拍）**而非 shot（镜头）。一个 beat 对应 Stage 2 的一张关键帧；具体运镜留到 Stage 3 在 beat 内扩展。这避免 Stage 1 被迫陷入摄影决策。

### Stage 1.5 — 角色 & 场景 Bible（**关键插入点**）

> ⚠ **缺这个阶段，Stage 2 的角色一致性会全部崩溃**。原因见 §10 "技术债与风险清单"。

**为什么必须有**：FLUX / SDXL 等 t2i 模型**无法仅凭文字描述跨张生出"同一个人"**。每张图的角色长相会漂移。必须在 Stage 2 之前锁死参考图（ref）。

**子流程**：

1. **AI 抽取角色清单**：扫总剧本，对每个具名角色生成结构化 `bible.json`（外貌 / 服装 / 性格 / 关系网）
2. **AI 候选图生成**：每角色生 4-8 张候选肖像
3. **用户选定 / 换抽**：从候选挑 1-3 张确认为 ref → 落 `人物/<name>/ref/`
4. **场景同理**：抽场景清单 → 生候选 → 用户确认 ref
5. **可选 · 角色 LoRA 训练**：用户确认的 ref 图跑 5-10 分钟训练轻量 LoRA（FLUX 生态有开源方案）。一致性强于 IP-Adapter。

完成后，所有后续生图通过 IP-Adapter 或 LoRA 注入这些 ref，实现跨镜头同一张脸 / 同一个场景。

### Stage 2 — 关键帧（Visual）

输入：单集分镜脚本（beat list）+ Bible refs  
输出：每 beat 一张确认的关键帧图 + meta

**子流程**：

1. **AI 关键帧分析**：扫单集脚本，给每 beat 自动生 image prompt（融合 beat 描述 + 出场角色 ref + 场景 ref + 项目级风格令牌）
2. **用户调整**：可编辑每 beat 的 prompt / 增删 beat / 重排序
3. **批量出图**：当前已实现的 `/api/render` + ComfyUI 路径（见第 5 节）
4. **单帧迭代**：点任一帧 → 重抽 / 微调 prompt / 换 seed / 换比例
5. **确认锁定**：满意后落 `剧集分镜/EP/关键帧/`

**关键工程要求**：每张关键帧附 `meta.json`（prompt / seed / model / refsUsed / width / height / generatedAt），**确保可复现**。Stage 3 必须能反查这张图怎么来的。

### Stage 3 — 动态（Motion，规划中）

> 项目当前 ComfyUI 已装 WAN 2.2 i2v 模型（`smoothMixWan2214BI2V_t2vHighV30`、`DasiwaWAN22I2V14BLightspeed_*`）—— Stage 3a 直接复用。

| 子阶段 | 输入 | 输出 | 实现 |
|---|---|---|---|
| 3a · 单帧动起来 | 关键帧 + 4-8 词运镜描述 | 4-6 秒 i2v 片段 | 本地 WAN 2.2 i2v / 可选云端 Kling, Runway Gen-3 |
| 3b · 配音 & 字幕 | 单集脚本台词 | TTS 音轨（按角色音色）+ SRT | 云端 TTS（豆包 / GPT-4o-tts / ElevenLabs） |
| 3c · 时间线合成 | 全部 i2v 片段 + 音轨 | 单集 mp4 | ffmpeg 命令链 / 内嵌轻量 NLE |
| 3d · 导出 | 整片 / 故事板 | mp4 / pitch deck pptx / PDF | 复用 docx/pptx skill |

**3a 走通即得 animatic**（动态故事板），对剧本审片已经够用。3b/3c/3d 后续。

### 跨阶段数据契约（最小必需，待落 `src/core/types/`）

```ts
// project.json
interface ProjectMeta {
  id: string;
  name: string;
  format: 'series' | 'shortform' | 'comic' | 'animation';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  style: { preset: string; refImages: string[]; loraTags?: string[] };
  llmBackend: { baseUrl: string; modelId: string };
  renderBackend: { kind: 'cloud' | 'comfyui'; ...config };
  createdAt: string;
  schemaVersion: number;
}

// 总剧本.index.json（伴随总剧本.md）
interface ScriptIndex {
  episodes: Array<{ id: string; title: string; charSpan: [number, number]; charactersInEpisode: string[]; scenesInEpisode: string[]; }>;
  characters: string[];   // 角色 id 全集
  scenes: string[];       // 场景 id 全集
}

// 单集脚本.json
interface EpisodeScript {
  id: string;
  title: string;
  beats: Beat[];
}
interface Beat {
  id: string;
  summary: string;                 // 一句话节拍描述
  characters: Array<{ id: string; role: 'protagonist' | 'supporting' | 'extra' }>;
  scene: { id: string };
  dialog?: Array<{ char: string; line: string }>;
  imagePromptDraft?: string;       // Stage 2 输入候选
}

// 角色 bible.json
interface CharacterBible {
  id: string;
  name: string;
  appearance: string;              // 外貌 prompt（用于 t2i）
  personality: string;             // 性格（用于剧本一致性）
  relations: Array<{ to: string; type: string }>;
  refs: Array<{ path: string; isPrimary: boolean }>;
  loraPath?: string;
}

// 关键帧 meta.json
interface KeyframeMeta {
  beatId: string;
  prompt: string;
  negativePrompt?: string;
  seed: number;
  model: string;
  refsUsed: string[];              // 用了哪些 character/scene ref（路径）
  width: number;
  height: number;
  generatedAt: string;
  durationMs: number;
}
```

### 与早期方案的差异

| 早期方案 | v0.2 修订 | 原因 |
|---|---|---|
| Stage 1 直接做剧本 + 脚本 | 加 Stage 0（项目元数据） | 风格 / 比例 / 格式必须项目级锁定 |
| Stage 1 → Stage 2 直连 | 中间插 Stage 1.5（Bible） | t2i 跨张一致性的工程必经之路 |
| 关键帧 = 镜头 | 关键帧 = beat | Stage 1 不需要决定运镜 |
| Stage 3 未定 | 切 3a/b/c/d 四步 | 用户已有 WAN i2v 资产，3a 是"白嫖" |
| 数据格式未指 | 强契约：每阶段 JSON + 资产文件 | 跨阶段引用 / 可复现 / 协作可能 |

---

## 2. 技术栈

| 层 | 技术 | 版本 | 关键说明 |
|----|------|------|----------|
| 前端框架 | Next.js (Pages Router) | 14.1.0 | 已从 App Router 迁回 Pages Router，规避 hydration 与 static export 冲突 |
| UI 库 | React | 18.2.0 | — |
| 语言 | TypeScript | 5.3.0 | `strict: false`，但 `strictNullChecks: true` |
| 样式 | TailwindCSS | 3.4.0 | content 仅扫描 `pages/`、`features/`、`shared/` |
| 动效 | Framer Motion | 10.18.0 | `next.config.js` 中 `transpilePackages: ['framer-motion']` 必须保留 |
| 状态 | Zustand | 4.5.0 | 启用 `persist` 中间件，仅持久化 API 配置与项目上下文 |
| 桌面 Runtime | Tauri | 2.10.1 | 启用 `dialog`、`fs`、`log` 三个官方插件 |
| 后端 | Rust (Tauri Host) | edition 2021 / rust 1.77+ | 当前几乎为空壳，仅插件初始化 |
| 图标 | lucide-react | 1.7.0 | — |

**设计令牌（实测）**：背景 `#1A1A1A` / `#0A0A0A` / `#050505`，主色 `#FF5000`，副色 `#00AAFF`，状态色 `#00E5FF`（completed）/ `#FF5000`（generating），等宽字体优先。

---

## 3. 仓库总览

```
ai-director/
├── src/
│   ├── pages/                      Next.js Pages Router（路由层）
│   │   ├── index.tsx               入口页：选择「生成 / 导入」+ 项目初始化弹窗
│   │   ├── workspace.tsx           三栏主工作区：Navigator / Canvas / Commander
│   │   ├── api/generate.ts         AI 生成网关 (BFF)，OpenAI 兼容协议透传
│   │   ├── _app.tsx                全局 App 包装
│   │   └── _document.tsx           HTML 容器
│   ├── features/                   FSD 业务切片
│   │   ├── director-board/ui/      DirectorLayout.tsx（旧版工作区，单列 mock）+ ShotCard.tsx
│   │   ├── idea-generator/         占位（仅 README）
│   │   └── script-importer/        占位（仅 README）
│   ├── core/
│   │   └── types/
│   │       ├── index.ts            旧版/通用类型 (Project / Scene / Shot)
│   │       └── script.ts           当前生效的 ScriptEngram 契约 ★
│   ├── shared/
│   │   ├── lib/tauri-fs.ts         Tauri FS 封装 + Web 端降级 mock
│   │   └── ui/                     占位
│   ├── store/scriptStore.ts        Zustand 全局状态（持久化）
│   └── styles/globals.css          全局样式（仅基础重置）
├── src-tauri/                      Tauri Rust 后端
│   ├── src/{main.rs, lib.rs}       仅注册插件，无自定义 command
│   ├── Cargo.toml                  依赖 tauri 2.10.3 + dialog/fs/log 插件
│   ├── tauri.conf.json             窗口 800×600 / devUrl 3000 / dist 目录
│   └── capabilities/default.json   FS 权限放开 ** 全路径
├── bug-reports/                    19 份历史 Bug 报告（Tauri / Next / Tailwind / Framer）
├── Gemini vision/                  Gemini 协作交付物（含 v0.1.0 交付报告）
├── .trae/rules/project-rule.md     项目硬性规则（FSD / Contract-First / Bug Report 流程）
├── next.config.js                  生产 static export → dist / 开发动态模式
├── tsconfig.json                   path alias: @/* → src/*
├── tailwind.config.ts              JIT scan 范围
├── package.json
├── start-dev.bat                   Windows 直调 Node 启动 next dev（绕过 PATH 问题）
└── sync.sh                         自动化双路径推送：archive/v-<ts> + main -f
```

> **重要**：`src/core/types/index.ts` 与 `src/core/types/script.ts` 是**两套不同的类型**，前者是早期 Director Board mock 使用的 Shot 形态，后者是当前 `/api/generate` 与 `workspace.tsx` 使用的 `ScriptEngram` 契约。**接手后建议合并为单一权威源**（见 §10 技术债）。

---

## 4. 核心数据契约 (ScriptEngram)

定义位置：[src/core/types/script.ts](src/core/types/script.ts)

```ts
interface Character { id: string; name: string; appearance: string; role: string; }
interface Shot      { shotId: string; type: string; visualDescription: string;
                      dialogue?: string; action?: string; }
interface Scene     { sceneId: string; location: string; timeOfDay: string;
                      environment: string; shots: Shot[]; }
interface ScriptEngram {
  title: string;
  logline: string;
  characters: Character[];
  scenes: Scene[];
}
```

整个 LLM 输出、Workspace 渲染、Sidebar 列表、Active Scene 切换全部围绕该契约。**修改此文件等同于修改产品核心数据模型，需同步更新 `pages/api/generate.ts` 中的 system prompt。**

---

## 5. 用户旅程 & 数据流

```
[index.tsx] 用户选择 生成 / 导入 + 输入项目名
        │
        ├──▶ scaffoldProject(projectName)            ← shared/lib/tauri-fs.ts
        │     └─ Tauri 环境：弹出原生目录选择器，物理创建：
        │         <root>/<projectName>/{剧本,脚本,角色,场景,视频素材}
        │     └─ Web 环境：返回 mock 路径 /mock/local/projects/<name>
        │
        ├──▶ 若为「导入」：plugin-dialog.open() + plugin-fs.readTextFile()
        │     └─ 原始文本暂存 sessionStorage['imported_raw_script']
        │
        └──▶ router.push('/workspace')
              │
              └─ workspace.tsx 挂载
                    │
                    ├─ useEffect 拉取 sessionStorage 注入到 userPrompt
                    ├─ 用户在 Commander 面板输入 prompt + 配置 API
                    └─ handleGenerate() → POST /api/generate
                                              │
                                              └─ pages/api/generate.ts (BFF)
                                                    │
                                                    └─ fetch(baseUrl, Bearer apiKey, model)
                                                          ↓
                                                    LLM 返回原始字符串
                                                          ↓
                                                    Markdown 剥离 → JSON.parse
                                                          ↓
                                                    返回 ScriptEngram
                                              │
                                              └─ setScriptData() → Zustand
                                                    │
                                                    └─ Workspace 三栏渲染
                                                          ├─ 左：Scenes / Characters
                                                          ├─ 中：Active Scene 的 Shot 列表
                                                          └─ 右：Commander（Model / API / Prompt / Generate）
```

---

## 6. 状态管理（Zustand）

文件：[src/store/scriptStore.ts](src/store/scriptStore.ts)

| 字段 | 类型 | 持久化？ | 说明 |
|------|------|---------|------|
| `projectName` | `string \| null` | ✅ | 当前项目名 |
| `projectPath` | `string \| null` | ✅ | scaffold 返回的物理路径 |
| `apiKey` | `string` | ✅ | Bearer Token，存 localStorage（**安全风险**，见 §10）|
| `baseUrl` | `string` | ✅ | 默认火山引擎 ARK 地址 |
| `customModelId` | `string` | ✅ | 默认 `deepseek-chat` |
| `scriptData` | `ScriptEngram \| null` | ❌ | 生成结果，刷新即丢 |
| `isGenerating` | `boolean` | ❌ | UI loading flag |
| `rawIdea` / `selectedTags` / `currentPhase` | — | ❌ | 早期遗留，目前未在 UI 中使用 |

**持久化键**：`localStorage['ai-director-storage']`，仅白名单字段（`partialize`）。

---

## 7. AI 生成网关

文件：[src/pages/api/generate.ts](src/pages/api/generate.ts)

- 协议：OpenAI 兼容 `/chat/completions`
- 默认目标：火山引擎 ARK（`https://ark.cn-beijing.volces.com/api/v3/chat/completions`），模型 `deepseek-chat`
- System Prompt：硬编码 `JSON_SCHEMA_PROMPT`，强制 LLM 输出严格 JSON
- 防御性处理：
  1. 剥离 ```` ```json ... ``` ```` 包裹
  2. 若仍非 `{` 起首，定位首个 `{` 与末个 `}` 截取
  3. `JSON.parse` 失败抛 500
- **未实现**：流式输出、超时控制、重试、token 计费、prompt 缓存

UI 侧选择器写死了 4 个候选（`DeepSeek / 豆包 / Gemini / GPT-4o`），但**实际生效的只有「Advanced Neural API Config」面板里手填的 `baseUrl + customModelId + apiKey`**。下拉选择目前只是装饰，未与请求联动——这是当前最显眼的产品缺口（见 §10）。

---

## 8. Tauri 集成

| 项 | 状态 |
|----|------|
| 启用插件 | `tauri-plugin-dialog`、`tauri-plugin-fs`、`tauri-plugin-log`（仅 debug） |
| 自定义 Rust command | ❌ 暂无，所有逻辑跑在 JS 端 |
| FS 权限 | `capabilities/default.json` 全开 `**`（**生产前必须收窄**） |
| 窗口配置 | 800×600，无固定坐标，无 `visible: true` 显式声明 |
| 环境检测 | `tauri-fs.ts` 中 `isTauri || '__TAURI_INTERNALS__' in window` 双重保险 |
| Web 降级 | 所有 FS 操作在浏览器返回 mock，不抛错 |

---

## 9. 模块完成度

| 模块 | 状态 | 文件 / 备注 |
|------|------|------------|
| 项目脚手架 | ✅ | 所有 config 齐备 |
| 入口页（生成 / 导入） | ✅ | [index.tsx](src/pages/index.tsx) |
| Tauri 项目目录 scaffold | ✅ | 创建 5 个中文子目录 |
| Workspace 三栏 UI | ✅ | [workspace.tsx](src/pages/workspace.tsx) |
| `/api/generate` 网关 | ✅ | OpenAI 兼容 |
| Zustand 持久化 | ✅ | localStorage |
| 文本选区悬浮菜单 | 🟡 半成品 | UI 已实现，无回调逻辑 |
| 整体 AI 增强按钮 | 🟡 占位 | UI 存在，无 onClick |
| 模型下拉选择 → API | 🔴 未联动 | 只能改 Advanced 面板才生效 |
| Director Board (旧) | 🟡 已废弃 | [DirectorLayout.tsx](src/features/director-board/ui/DirectorLayout.tsx) 仍含 mock，路由未挂载 |
| idea-generator | 🔴 占位 | 仅 README |
| script-importer | 🔴 占位 | 仅 README（导入逻辑实际在 index.tsx 内） |
| 资产/视频导出 | 🔴 未规划落地 | — |
| 实时协作 | 🔴 远期 | — |

---

## 10. 技术债与风险清单（接手必读）

| # | 问题 | 严重度 | 建议处置 |
|---|------|-------|---------|
| 1 | **API Key 存 localStorage** | 🔴 高 | 至少加密；理想方案：Tauri 端用 `keyring` crate 存系统凭据库，Rust command 暴露 |
| 2 | **两套 Shot/Scene 类型并存** (`core/types/index.ts` vs `core/types/script.ts`) | 🟠 中 | 删除 `index.ts` 中重复定义，统一指向 `script.ts`；同时清理引用 `index.ts` 的 [DirectorLayout.tsx](src/features/director-board/ui/DirectorLayout.tsx)、[ShotCard.tsx](src/features/director-board/ui/ShotCard.tsx) |
| 3 | **模型下拉与请求未联动** | 🟠 中 | 将四个模型预设映射到 `{baseUrl, modelId}` 字典，selectedModel 改变时同步 setApiConfig |
| 4 | **`/api/generate` 无超时/重试/速率保护** | 🟠 中 | 引入 `AbortController` + 60s 超时；429/5xx 指数退避 |
| 5 | **FS capabilities 全开 `**`** | 🟠 中 | 收敛到 `$APP/projects/**` 等具名 scope |
| 6 | **未实现流式输出** | 🟡 低 | LLM 返回耗时长，UI 仅 spinner 体验差。可改 SSE / fetch-stream |
| 7 | **DirectorLayout.tsx 死代码** | 🟡 低 | 已不在路由中，建议删除或迁移 ShotCard 复用 |
| 8 | **`sync.sh` 使用 `git push -f` 到 main** | 🟠 中 | 多人协作前必改；改为 PR 流程 |
| 9 | **bug-reports 中 4 起未关闭问题**（Tauri dialog 未弹、cargo missing、layout reorder、blank page）| 🟡 低 | 多数与 Windows 环境相关，建议在 README 加 "Troubleshooting" 章节 |
| 10 | **TypeScript `strict: false`** | 🟡 低 | 渐进式打开，先开 `noImplicitAny` |
| 11 | **`generate.ts` 凭据通过 POST body 透传** | 🟠 中 | 改为 server-side env 注入或 Tauri 凭据通道，避免明文走网络日志 |

---

## 11. 开发工作流

### 启动

```bash
# 仅 Web 预览（无桌面能力，FS 走 mock）
npm run dev                    # http://localhost:3000

# Tauri 桌面端（推荐）
npm run tauri dev              # 自动拉起 next dev + cargo run

# Windows 备用启动（绕过 npm/PATH 问题）
start-dev.bat
```

### 构建

```bash
npm run build                  # next build → dist/  (output: 'export')
npm run tauri build            # 打包为 .exe / .app / .deb
```

### 同步（自动化脚本）

```bash
./sync.sh                      # 自动 commit + 推送 archive/v-<ts> + 强推 main
```
> ⚠️ 该脚本会 `git push -f origin main`，**多人协作前禁用或改为 PR**。

### 项目硬性规则（来自 [.trae/rules/project-rule.md](.trae/rules/project-rule.md)）

1. **Feature-Sliced Design**：所有业务逻辑必须在 `/features/<slice>/` 下，禁止跨切片直接 import
2. **Contract-First**：必须先在 `/core/types/` 定义并导出 interface，再写实现
3. **Zustand 扁平**：物理隔离 store（计划中：`ScriptStore` / `AssetStore` / `BoardStore`），禁止巨石 store
4. **视觉一致性**：暗色工业-赛博风，玻璃拟态 + 青/红霓虹辉光
5. **Bug 报告流程**：用户报错时**不要立刻改代码**，先在 `bug-reports/<日期>-<slug>.txt` 生成结构化 Bug 报告（含 Summary / Stack / Env / Code Context / Root Cause Hypothesis / Proposed Solutions / Next Steps）

### Git 历史（前端项目早期，commit 极少）

```
814dddc sync: 自动保存于 20260405_015316
5c4ff72 feat: 初始架构定义 - AI-Director 核心引擎与多语言微服务框架
```

---

## 12. 环境要求

| 依赖 | 最低版本 |
|------|---------|
| Node.js | ≥ 18.17.0 |
| Rust | ≥ 1.77.2（`rust-version` in Cargo.toml） |
| Windows | 10 / 11（主战场，需 WebView2 Runtime） |
| RAM | 16 GB（本地模型推理留余量） |
| 屏幕 | ≥ 1920×1080 |

---

## 13. 接手 Onboarding 检查清单

按顺序执行，每项 ≤ 10 分钟：

- [ ] `npm install` 成功，无 native 编译失败
- [ ] `npm run dev` 启动后访问 `localhost:3000`，看到「AI 世纪导演」入口页
- [ ] 点击「生成剧本」→ 输入项目名 → Web 模式应跳转 workspace（FS 走 mock）
- [ ] 在 Commander 面板「Advanced Neural API Config」填入真实的 `baseUrl + modelId + apiKey`，点 GENERATE，确认能拿到 ScriptEngram 渲染
- [ ] 安装 Rust + WebView2，跑 `npm run tauri dev`，原生窗口能弹目录选择器、能创建 5 个中文子目录
- [ ] 阅读 [.trae/rules/project-rule.md](.trae/rules/project-rule.md) 与本手册 §10 风险清单
- [ ] 浏览 [bug-reports/](bug-reports/) 三份近期报告（`workspace-page-blank-after-layout-sync`、`tauri-app-not-displaying`、`tauri-dialog-not-showing`）以建立故障直觉
- [ ] 在 [src/core/types/script.ts](src/core/types/script.ts) 末尾打印 `console.log` 验证类型注入到 workspace
- [ ] 完成首个 PR：合并双 Shot 类型（技术债 #2）

---

## 14. 推荐的近期路线图（v0.2 设计目标对齐）

> 围绕 §1.5 的五阶段架构展开。已完成项标 ✅。

**Sprint 1 — Stage 0 落地（项目元数据）**
- [ ] `ProjectMeta` 类型定义至 `src/core/types/project.ts`
- [ ] 项目创建弹窗扩展：体裁 / 比例 / 风格 / 风格参考图 / 后端选择
- [ ] `project.json` 物理落盘（替换现有 sessionStorage 暂存）
- [ ] Zustand store 改造：`useProjectStore` 持久化项目元数据

**Sprint 2 — Stage 1 完整化（剧本编辑）**
- [ ] 剧本编辑器：划选悬浮 AI 菜单（续写 / 改写 / 加紧 / 加长）
- [ ] AI 自动分集 + 用户拖拽调整
- [ ] 单集独立选项卡 UI（左剧本 / 右上角色场景列表 / 右下脚本）
- [ ] `EpisodeScript` 结构化 JSON 落盘 + 双向同步（编辑 md 时自动更新 index）

**Sprint 3 — Stage 1.5 角色 Bible（关键里程碑）** 🔥
- [ ] AI 抽角色清单 + 自动生 `bible.json`
- [ ] 候选肖像批量生成 UI（4-8 张缩略图选片）
- [ ] 用户确认 ref → 落 `人物/<name>/ref/`
- [ ] 场景 Bible 同上
- [ ] **关键依赖**：ComfyUI 安装 IP-Adapter 扩展 + 下载权重（约 1GB）
- [ ] 工作流改造：Stage 2 的渲染调用注入对应 ref 图

**Sprint 4 — Stage 2 闭环（关键帧迭代）**
- [x] 多 Agent 编排（Director / Screenwriter / Cinematographer）— 已完成
- [x] 双后端渲染（云端 + 本地 ComfyUI）— 已完成
- [ ] 单帧重抽 / 微调 prompt / 换 seed UI
- [ ] `KeyframeMeta` 元数据落盘（确保可复现）
- [ ] 整集批量出图进度条 + 失败重试

**Sprint 5 — Stage 3a · 单帧动起来（Animatic v1）**
- [ ] 利用已有 WAN 2.2 i2v 模型，加 ComfyUI i2v 工作流
- [ ] 关键帧右键 → "让它动起来"，输出 4-6 秒 mp4
- [ ] 简易时间线 UI（拼起来播放预览）

**Sprint 6+ — Stage 3 完整化（音 / 剪 / 出片）**
- [ ] TTS 配音（按角色音色）+ SRT 字幕
- [ ] ffmpeg 串接整集 mp4
- [ ] 故事板 PDF / pitch deck pptx 导出（复用 docx/pptx skill）

**横切关注点（贯穿所有 Sprint）**
- [ ] 版本历史：每次保存 snapshot 到 `.ai-director/version-history/`
- [ ] `keyring` 集成，移除 localStorage API Key
- [ ] LLM 调用 trace 落 `.ai-director/llm-traces/` 便于复盘
- [ ] 流式 SSE 输出（剧本编辑实时反馈）

---

## 15. 关键文件直链

| 文件 | 角色 |
|------|------|
| [src/pages/index.tsx](src/pages/index.tsx) | 入口页 / 项目初始化 |
| [src/pages/workspace.tsx](src/pages/workspace.tsx) | 三栏主工作区 |
| [src/pages/api/generate.ts](src/pages/api/generate.ts) | LLM BFF 网关 |
| [src/store/scriptStore.ts](src/store/scriptStore.ts) | 全局状态 |
| [src/core/types/script.ts](src/core/types/script.ts) | **核心数据契约** ★ |
| [src/shared/lib/tauri-fs.ts](src/shared/lib/tauri-fs.ts) | Tauri FS 抽象 |
| [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | 窗口 / 构建产物配置 |
| [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) | Tauri 权限清单 |
| [next.config.js](next.config.js) | 静态导出策略（dev/prod 切换）|
| [.trae/rules/project-rule.md](.trae/rules/project-rule.md) | 项目硬性规则 |
| [bug-reports/](bug-reports/) | 历史故障档案（19 份）|
| [Gemini vision/gemini-work-delivery-report.md](Gemini%20vision/gemini-work-delivery-report.md) | v0.1.0 交付报告 |

---

## 16. 联系 / 协作约定

- 项目所有者邮箱（auto memory）：`zyuqi960425@gmail.com`
- Bug 报告流程：**先报告再改码**，路径 `bug-reports/<YYYYMMDD>-<kebab-slug>.txt`
- 同步策略：`sync.sh` 双路径推送（待 PR 化）
- 协作 AI 角色：Trae（实施）/ Gemini Vision（审查与多模态）

---

> **手册结束。** 若发现本手册与代码现状偏差，请优先信任代码并即时回写本文档。
