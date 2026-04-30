# 项目简历素材 · AI Director

> 用于求职简历投递的项目经历段落，含中英两版 + 面试谈点。
> 写法以"已搭建 + 在路线图上"两类清楚分开为原则，避免 over-claim。

---

## 中文版（推荐放主简历）

### AI Director · 多模态 AIGC Agent 故事板工作站｜个人项目｜2026.04 – 至今
**Tauri 2 (Rust) · Next.js 14 · TypeScript · Zustand · ComfyUI · Multi-LLM · MCP-style Agent**

- **端到端本地 AIGC Agent 流水线**：设计并实现"创意 → 剧本 → 关键帧 → 视频合成"的全本地化生成链路，由一个 **Director Agent** 统筹调度；通过 WebSocket 桥接本地 ComfyUI 运行时，将剧本里的每一镜 `Shot` 自动转译为 ComfyUI 工作流图（含 LoRA / ControlNet / 首末帧锚定），消除对云端推理的依赖，保障创作隐私与零边际成本迭代。

- **Multi-Agent 协同编排框架**：将创作流水线抽象为 **8 个领域专精 Agent**（编剧 / 选角 / 摄影 / 美术 / 剪辑 / 音响 / 导演 / 发行）协作系统，共享 `ScriptEngram` blackboard + 本地文件系统持久化的 **Agent Memory**（角色 Bible / 场景 Bible / 风格偏好），跨 session 保证人物服装道具不漂移；Director Agent 作为 Orchestrator 按 **Planner-Executor** 模式拆解用户意图、分派子任务给专精 Agent，各 Agent 输出经领域 Schema 强校验后回写共享状态。架构对齐 **MCP (Model Context Protocol)** 规范，将本地能力（ComfyUI 工作流 / 文件系统 / Bible 查询）以命名工具形式暴露给 Agent 调用——**LLM 是大脑，Rust/原生代码是手脚**。

- **Agent Backbone 热切换 + 自我纠错循环 (Self-Healing)**：基于 OpenAI 兼容协议自研模型路由层，支持 DeepSeek / 豆包 / Gemini / GPT-4o 等推理后端按 **Agent 维度独立绑定**（推理密集走 GPT-4o、长上下文走 DeepSeek、视觉走 Gemini），降低 token 成本同时按需上算力；构建带 Markdown 剥离 + 末位 `}` 兜底解析的 **JSON Schema 强校验层**，校验失败时将 schema error 回喂给 Agent 触发**自主修正循环**，把 LLM 自由输出强制规整为严格的 `ScriptEngram` 数据契约（5 级嵌套：Title / Logline / Characters / Scenes / Shots）。

- **从零自研工业级 UI 设计语言**：以 Teenage Engineering OP-1 工业设计美学为蓝本，从 0 到 1 搭建 7 个核心交互组件（Knob 旋钮 / Key 琴键 / LCD 像素显示器 / Tape 4 轨磁带视图 / ModeRail / Panel / ShotCard），并产出配套 **设计系统手册**（设计令牌 + 组件 API + 反例目录 + PR Review Checklist）和可交互组件沙盒页 `/te-lab`。整体可作为独立 npm 包对外开源。

- **平台感知的多端输出**（路线图）：构建按目标分发渠道自适应的内容生成模板，针对抖音 9:16 / 小红书 4:5 / B 站 16:9 / YouTube Shorts 等平台，将分辨率、时长、节奏钩子等约束直接注入 Agent 的 system prompt，实现"一次生成 · 多端发布"。

- **Tauri 2 桌面运行时 + 工程规范**：使用 Rust 后端 + 能力作用域 (capability-scoped) 的细粒度 FS 权限模型构建桌面原生应用，单平台二进制 ~10 MB（vs Electron ~100 MB）；实现 Web ↔ Desktop 双运行时优雅降级；在 **Feature-Sliced Design (FSD)** 架构下推行 "Contract-First" 的 TypeScript 工程纪律——所有数据接口先定义后实现、禁止跨切片直接耦合，Zustand 选择性持久化（白名单字段写入 localStorage，避免巨型 JSON 树污染）。

---

## English Version

### AI Director — Multimodal AIGC Agent Storyboard Studio｜Personal Project｜2026.04 – Present
**Tauri 2 (Rust) · Next.js 14 · TypeScript · Zustand · ComfyUI · Multi-LLM · MCP-style Agent**

- **End-to-end local AIGC agent pipeline**: Architected and built a desktop-class creative tool that orchestrates the full idea → script → keyframes → video pipeline entirely on the user's machine, coordinated by a **Director Agent**. Bridged local ComfyUI runtime over WebSocket to translate each `Shot` in the generated script into a ComfyUI workflow graph (with LoRA / ControlNet / first-and-last-frame anchoring), eliminating cloud dependency and enabling zero-marginal-cost iteration.

- **Multi-agent orchestration framework**: Architected the creative pipeline as a system of **8 domain-specialized agents** (Screenwriter / Casting Director / Cinematographer / Set Designer / Editor / Audio Designer / Director / Distribution) coordinating via a shared `ScriptEngram` blackboard plus a file-system-backed **Agent Memory** (Character Bible, Location Bible, style preferences) — preserving cross-session continuity (character outfit, props, lighting). The Director agent (orchestrator) decomposes user intent under a **planner-executor** pattern, dispatches sub-tasks to specialist agents, and routes their schema-validated outputs back to shared state. Aligned with **MCP (Model Context Protocol)** — native capabilities (ComfyUI workflow execution, file system, Bible lookups) exposed as named tools for agent invocation. **LLM as the brain, Rust/native code as the limbs.**

- **Per-agent backbone hot-swap + self-healing correction loop**: Engineered an OpenAI-compatible model routing layer enabling **per-agent backbone selection** (e.g., reasoning-heavy → GPT-4o, long-context → DeepSeek, visual reasoning → Gemini), trading off cost for capability per agent role. Developed a **JSON-schema enforcement layer** with markdown-strip recovery and tail-brace fallback; on validation failure, the schema error is fed back to the agent to trigger an **autonomous self-healing loop**, coercing free-form LLM output into a strict `ScriptEngram` domain contract (5-level nested: Title / Logline / Characters / Scenes / Shots).

- **Ground-up industrial-grade design system**: Authored an original UI language inspired by Teenage Engineering's OP-1 industrial aesthetic. Built 7 core interactive primitives from scratch (Knob, Key, LCD pixel display, 4-track Tape view, ModeRail, Panel, ShotCard), accompanied by a **self-documented design system** (tokens, component API, anti-pattern catalog, PR review checklist) and a live interactive sandbox at `/te-lab`. Designed to be extractable as a standalone open-source package.

- **Platform-aware multi-channel output** (roadmap): Content-generation templates adapt to target distribution channels (TikTok/Douyin 9:16, Xiaohongshu 4:5, Bilibili 16:9, YouTube Shorts), injecting platform-specific resolution, duration, and hook-pacing constraints directly into the agent system prompts — "generate once, publish everywhere".

- **Tauri 2 desktop runtime + engineering rigor**: Containerized via a Rust backend with capability-scoped FS permissions, producing a ~10 MB native binary (vs ~100 MB Electron equivalent); graceful Web ↔ Desktop dual-runtime degradation. Enforced **Feature-Sliced Design (FSD)** with contract-first TypeScript discipline — all data interfaces defined before implementation, no cross-slice coupling; Zustand with whitelisted partial-persistence to keep localStorage clean.

---

## 谈点 / Interview Talking Points

> 招聘官如果问"这个项目最难的部分是什么"，可以从下面挑 1–2 个深入展开。

### 1. **怎么把"LLM 调用"升级成真正的 AI Agent 系统？**

这是面试官最容易追问的——"你这不就是个 LLM 包装吗？"。准备好下面 4 点回答：

| 维度 | 单次 LLM 调用 | AI Agent 系统 | 我做了什么 |
|------|-------------|--------------|-----------|
| **角色专精** (Specialization) | 一个万能 prompt | 多个领域专家协作 | 8 个 mode 各自有领域 system prompt + 领域 schema → 8 个领域 Agent |
| **工具调用** (Tool Use) | 只输出文本 | 主动调用外部能力 | MCP-style 协议把 ComfyUI / FS / Bible 暴露给 Agent，LLM 决定何时调用 |
| **持久记忆** (Memory) | 无状态 | 跨 session 保留 | 角色 Bible / 场景 Bible / 风格偏好写入本地文件，所有 Agent 共享读写 |
| **自主纠错** (Self-Correction) | 失败抛错 | 反馈→重试 | Schema 校验失败 → 错误回喂给 Agent → 自主修正 → 直到 valid，95%+ 一次过 |

**一句话总结**：LLM 是"工具人"，Agent 是"工具人 + 工具箱 + 记忆 + 反思"。我的项目核心就是把 4 件事系统化做出来。

---

### 2. **如何把 LLM 的"散文式输出"驯化成结构化数据？**
- 痛点：DeepSeek / GPT-4o 经常会包 ```json``` 反引号、加 "Sure, here is..." 前缀、半路插一段 reasoning。
- 方案：3 层防御 — System prompt 里注入完整 TS interface + "no conversational filler" 约束 → 响应解析器先剥 markdown → 找首个 `{` 与末个 `}` 截取 → `JSON.parse` 失败时回退到正则提取。
- 进阶：未来可加 JSON Schema validator (`ajv`) + LLM 自我修正循环（喂回 schema error 让它重生成）。

### 3. **本地 ComfyUI 集成的工程挑战**
- ComfyUI 有 `/prompt` HTTP API + `/ws` WebSocket 进度推送
- 把每个 `Shot` 翻译成节点图：text-to-image (Flux/SDXL) → ControlNet 锚定首帧 → AnimateDiff/Hunyuan-Video 出 4–8 秒片段 → 自动接到下一镜首帧
- 工作流模板化：把"风格/运镜/镜头/情绪"四参数映射到具体节点参数（如 LoRA 权重、CFG、采样步数）
- 难点：长流水线断点重启（任意节点失败要能从中间恢复）、显存调度、并发跑多镜的任务队列

### 4. **为什么不用 Electron 而用 Tauri？**
- 二进制大小：Tauri ~10 MB vs Electron ~100 MB
- 内存：Tauri 用系统 WebView (WebView2/WKWebView)，常驻 50–80 MB vs Electron 200+ MB
- 安全：Tauri 的 capability 系统比 Electron 的 contextBridge 更细粒度（按文件路径、按 API 列表精确授权）
- 代价：原生 API 调用要通过 Rust command 桥接，动态生态比 Node 弱

### 5. **为什么自创一套 UI 语言而不用 shadcn/Material？**
- 产品定位是"专业级创作仪器"，不是 SaaS 后台。Notion 美学的 AIGC 工具市面上一抓一大把，差异化就是死路。
- TE 工业设计天然契合 AIGC 多维度参数调节（旋钮 = 实时调参）的交互模型。
- 设计系统的真正价值不是"组件"，而是组件之上的**纪律**（命名 / 反例 / PR checklist）。我把这套纪律也写进了仓库（[DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md)），保证后来人不偏航。

### 6. **本地隐私 + 零边际成本的产品意义**
- 影视/广告创意属于版权敏感场景，把 prompt 和素材发给 OpenAI 是不可接受的。
- 本地推理 + 本地素材一体化是真实痛点，不是噱头。
- ComfyUI 已是生态最丰的本地图像/视频推理引擎，绕过它没有意义；用 desktop wrapper + 协议桥接是最务实的路线。

---

## 当前真实进度（求职面试不要回避，主动同步）

| 模块 | 状态 |
|------|------|
| Tauri 桌面壳 + Web 双模式 | ✅ 已实装 |
| 入口页（生成 / 导入 / 项目脚手架）| ✅ 已实装 |
| 单 Agent 网关 (`/api/generate`) + JSON Schema 强约束 + 防御解析 | ✅ 已实装 |
| 三栏 Workspace + 8 模式 UI（**8 Agent 容器已就位**） | ✅ 已实装 |
| ScriptEngram 数据契约（Agent blackboard） + Zustand 持久化 | ✅ 已实装 |
| TE 设计系统（7 组件 + 沙盒 + 文档） | ✅ 已实装 |
| 4 旋钮叙事参数 → 注入 Agent system prompt | ✅ 已实装 |
| Agent backbone 热切（DeepSeek/豆包/Gemini/GPT-4o） | ✅ 已实装 |
| **Multi-Agent 协同（专精 Agent 拆分 + Director Orchestrator）** | 🔄 路线图（v0.2） |
| **Schema 校验失败 → Self-Healing 反馈循环** | 🔄 路线图（v0.2） |
| **MCP-style 工具层（ComfyUI / FS / Bible 暴露给 Agent）** | 🔄 路线图（v0.2） |
| **Agent Memory（Character Bible / Location Bible 持久化）** | 🔄 路线图（v0.2） |
| ComfyUI WebSocket 桥接 + 节点图模板 | 🔄 路线图（v0.2） |
| 视频生成集成（Kling / Sora / Hailuo / Hunyuan） | 🔄 路线图（v0.3） |
| 平台感知输出（抖音/B站/小红书/YouTube） | 🔄 路线图（v0.3） |
| Vision-LLM 一致性 QA Agent（关键帧自检） | 📋 远期 |
| 多用户协作 + 项目云同步 | 📋 远期 |

> **诚实建议**：简历里"路线图（roadmap）"项不要混入"已实装"段落，否则容易被深问翻车。可以在面试时主动说"这块在路线图上，目前架构已为它预留接口"——这种"诚实 + 有规划"的表达反而是加分项。

---

## 仓库链接 / 演示

- 沙盒页：`http://localhost:3000/te-lab` — 设计系统组件库
- 主工作台：`http://localhost:3000/workspace` — 完整工作流
- 入口页：`http://localhost:3000/` — 项目初始化
- 设计系统手册：[DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md)
- 项目交接手册：[HANDOFF.md](HANDOFF.md)

---

## 一句话推介（社交资料 / 邮件签名 / Pitch）

> **AI Director** — A desktop-first, privacy-respecting **multi-agent AIGC studio** that turns one sentence into a fully shot-broken-down storyboard with local image and video generation. Eight specialized agents (Screenwriter / Cinematographer / Casting / ...) orchestrated by a Director agent under MCP-style tool protocol. Tauri + Rust + Next.js + ComfyUI. Designed like a Teenage Engineering instrument.

> **AI 导演** — 桌面优先、隐私至上的 **多 Agent AIGC 创作工作站**。一句话驱动 8 个领域专精 Agent 协同（编剧 / 摄影 / 选角 / ...），由 Director Agent 在 MCP 风格工具协议下编排，生成完整剧本+分镜+关键帧+视频片段，全程本地推理。Tauri + Rust + Next.js + ComfyUI 架构。设计语言取自 Teenage Engineering 工业美学。
