import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/router";
import { useScriptStore } from "@/store/scriptStore";
import { useProjectStore } from "@/store/projectStore";
import { scaffoldProject } from "@/shared/lib/tauri-fs";
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import {
  ASPECT_RATIO_OPTIONS,
  FORMAT_OPTIONS,
  STYLE_OPTIONS,
  createDefaultProjectMeta,
  type AspectRatio,
  type ArtStylePreset,
  type ProjectFormat,
  type ProjectMeta,
} from '@/core/types/project';

type ActionType = "generate" | "import" | null;

const DEFAULT_FORMAT: ProjectFormat = 'series';
const DEFAULT_ASPECT: AspectRatio = '16:9';
const DEFAULT_STYLE: ArtStylePreset = 'photoreal';

export default function EntryHub() {
  const router = useRouter();
  const { setProjectContext } = useScriptStore();
  const { setProject } = useProjectStore();

  const [actionType, setActionType] = useState<ActionType>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Project creation form
  const [projectName, setProjectName] = useState("");
  const [format, setFormat] = useState<ProjectFormat>(DEFAULT_FORMAT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(DEFAULT_ASPECT);
  const [stylePreset, setStylePreset] = useState<ArtStylePreset>(DEFAULT_STYLE);

  const handleCardClick = (type: ActionType) => {
    setActionType(type);
    setProjectName("");
    setFormat(DEFAULT_FORMAT);
    setAspectRatio(DEFAULT_ASPECT);
    setStylePreset(DEFAULT_STYLE);
  };

  const handleConfirm = async () => {
    if (!projectName.trim() || !actionType) return;

    try {
      setIsLoading(true);

      // 1. Build full ProjectMeta from form fields (Stage 0 lock-in)
      const baseMeta = createDefaultProjectMeta(projectName.trim());
      const meta: ProjectMeta = {
        ...baseMeta,
        format,
        aspectRatio,
        style: { preset: stylePreset, refImages: [] },
      };

      // 2. Scaffold on disk (writes project.json) or fall back to mock
      const projectPath = await scaffoldProject(meta);

      // 3. Sync both stores
      setProject(meta, projectPath);
      setProjectContext(projectName.trim(), projectPath); // legacy compat

      // 4. Optional: read import file
      if (actionType === "import") {
        const selectedPath = await open({
          multiple: false,
          filters: [{ name: 'Text/Markdown', extensions: ['txt', 'md'] }],
        });

        if (!selectedPath) return; // user canceled

        const fileContent = await readTextFile(selectedPath as string);
        sessionStorage.setItem('imported_raw_script', fileContent);
      }

      // 5. Navigate to workspace
      router.push("/workspace");
    } catch (error) {
      console.error("Project initialization failed:", error);
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h1 className="text-5xl font-bold font-mono text-white mb-4">
          <span className="text-[#FF5000]">AI</span> 世纪导演
        </h1>
        <p className="text-[#D1D5DB]/70 font-mono text-lg">
          MULTIMODAL AI STORYBOARD SYNTHESIZER
        </p>
      </motion.div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Generate New Script Card */}
        <motion.button
          whileHover={{ scale: 1.03, boxShadow: "0 0 50px rgba(255, 80, 0, 0.3)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleCardClick("generate")}
          disabled={isLoading}
          className="h-[320px] bg-[#262626] border-2 border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-6 hover:border-[#FF5000]/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-24 h-24 bg-[#FF5000] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-2xl font-mono mb-2">生成剧本</h3>
            <p className="text-[#D1D5DB]/70 font-mono text-sm">
              从零开始生成AI原创剧本与分镜
            </p>
          </div>
        </motion.button>

        {/* Import Existing Script Card */}
        <motion.button
          whileHover={{ scale: 1.03, boxShadow: "0 0 50px rgba(0, 170, 255, 0.3)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleCardClick("import")}
          disabled={isLoading}
          className="h-[320px] bg-[#262626] border-2 border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-6 hover:border-[#00AAFF]/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-24 h-24 bg-[#00AAFF] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-2xl font-mono mb-2">导入剧本</h3>
            <p className="text-[#D1D5DB]/70 font-mono text-sm">
              导入现有剧本文件进行AI增强创作
            </p>
          </div>
        </motion.button>
      </div>

      {/* Project Initialization Modal */}
      <AnimatePresence>
        {actionType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => !isLoading && setActionType(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#1A1A1A] border border-white/10 rounded-3xl shadow-2xl shadow-black/70 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="border-b border-white/10 px-8 py-6 bg-[#262626] shrink-0">
                <h2 className="text-white font-bold text-2xl font-mono">
                  项目初始化
                </h2>
                <p className="text-[#D1D5DB]/70 font-mono text-sm mt-2">
                  {actionType === "generate" ? "生成全新剧本项目" : "导入现有剧本项目"}
                  <span className="text-[#FF5000]/80 ml-2">· 创建后无法修改</span>
                </p>
              </div>

              {/* Modal Content (scrollable) */}
              <div className="px-8 py-6 space-y-6 overflow-y-auto">
                {/* Project Name */}
                <div>
                  <label className="block text-[#D1D5DB] text-xs font-semibold tracking-widest uppercase mb-3 font-mono">
                    项目名称
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="请输入项目名称..."
                    className="w-full bg-[#262626] border border-white/10 rounded-xl p-4 text-white font-mono focus:outline-none focus:border-[#FF5000] transition-all"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                {/* Format */}
                <div>
                  <label className="block text-[#D1D5DB] text-xs font-semibold tracking-widest uppercase mb-3 font-mono">
                    体裁 / format
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {FORMAT_OPTIONS.map((opt) => {
                      const active = format === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormat(opt.value)}
                          disabled={isLoading}
                          className={`px-3 py-3 rounded-lg font-mono text-sm border transition-all ${
                            active
                              ? "bg-[#FF5000] border-[#FF5000] text-white"
                              : "bg-[#262626] border-white/10 text-[#D1D5DB] hover:border-[#FF5000]/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-[#D1D5DB] text-xs font-semibold tracking-widest uppercase mb-3 font-mono">
                    输出比例 / aspect ratio
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ASPECT_RATIO_OPTIONS.map((opt) => {
                      const active = aspectRatio === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAspectRatio(opt.value)}
                          disabled={isLoading}
                          className={`px-3 py-3 rounded-lg font-mono text-xs border transition-all ${
                            active
                              ? "bg-[#00AAFF] border-[#00AAFF] text-white"
                              : "bg-[#262626] border-white/10 text-[#D1D5DB] hover:border-[#00AAFF]/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Art Style Preset */}
                <div>
                  <label className="block text-[#D1D5DB] text-xs font-semibold tracking-widest uppercase mb-3 font-mono">
                    美术风格 / style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLE_OPTIONS.map((opt) => {
                      const active = stylePreset === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStylePreset(opt.value)}
                          disabled={isLoading}
                          className={`px-3 py-3 rounded-lg font-mono text-sm border transition-all ${
                            active
                              ? "bg-white/15 border-white text-white"
                              : "bg-[#262626] border-white/10 text-[#D1D5DB] hover:border-white/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[#D1D5DB]/40 font-mono text-xs mt-2">
                    决定所有图像生成的画面调性。后续可在角色 Bible 阶段进一步定制。
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-white/10 px-8 py-6 bg-[#262626] flex gap-4 shrink-0">
                <button
                  onClick={() => setActionType(null)}
                  disabled={isLoading}
                  className="flex-1 bg-[#1A1A1A] border border-white/10 text-white rounded-xl py-4 font-mono text-sm transition-all hover:bg-white/5 disabled:opacity-50"
                >
                  取消
                </button>
                <motion.button
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                  onClick={handleConfirm}
                  disabled={isLoading || !projectName.trim()}
                  className={`flex-1 ${
                    actionType === "generate" ? "bg-[#FF5000]" : "bg-[#00AAFF]"
                  } border border-white/20 text-white rounded-xl py-4 font-mono text-sm font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      处理中...
                    </>
                  ) : (
                    "确认"
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
