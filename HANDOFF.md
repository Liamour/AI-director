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

## 14. 推荐的近期路线图（接手后 14 天）

**Week 1 — 稳定与收口**
1. 修技术债 #2（类型合并）、#3（模型下拉联动）
2. `/api/generate` 加超时 + 错误码 UX
3. 删除 DirectorLayout 死代码 / 或重构进新 feature

**Week 2 — 功能扩面**
1. 实现选区悬浮菜单的「✨ AI ENHANCE」回调（局部 prompt + 替换）
2. Asset 模块：把 ScriptEngram 写入项目目录的 `脚本/script.json`
3. 多 Scene 并发生成进度条
4. `keyring` 集成，移除 localStorage API Key

**Week 3+ — 长线**
- 流式 SSE 输出
- 图像生成（Gemini Vision / SD-API）→ Shot 缩略图
- 导出 PDF / Markdown / 分镜图册

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
