# Project: AI Storyboard Director (Multimodal AI Orchestration Hub)

- Tech Stack: Next.js (App Router), TypeScript (Strict Mode), TailwindCSS, Shadcn/ui, Zustand, Framer Motion, Tauri (Rust backend).
- Architecture Paradigm: Strictly enforce Feature-Sliced Design (FSD). Isolate business logic into the `/features` directory. Zero monolithic files allowed.
- Contract-First Development: Always define and export complete TypeScript Interfaces/Types before writing implementation logic. No types, no logic.
- State Management: Keep Zustand stores extremely flat. Physically isolate stores like `ScriptStore`, `AssetStore`, and `BoardStore`.
- Visual Identity: Enforce a "Dark Industrial-Cyber" aesthetic (Base background: `#0A0A0A`). Heavily utilize backdrop-blur (glassmorphism) and subtle glowing effects (cyan/red accents) to establish visual hierarchy.
- never change the code immediately. when I send you error messages, review the project structure and code quality and generate a bug report under bug-report file.
