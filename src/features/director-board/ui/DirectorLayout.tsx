"use client";

import { motion } from "framer-motion";
import ShotCard from "./ShotCard";
import { Shot } from "@/core/types";

interface DirectorLayoutProps {}

export default function DirectorLayout({}: DirectorLayoutProps) {
  const mockShots: Shot[] = [
    { id: 'shot_1', sceneId: 'scene_1', dialogue: '', action: 'Wide establishing shot of a cyberpunk city street in the rain. Neon reflections.', status: 'completed', characters: [], cameraMovement: 'Pan right' },
    { id: 'shot_2', sceneId: 'scene_1', dialogue: '', action: 'Close up on the protagonist pulling their collar up against the cold.', status: 'generating', characters: [], cameraMovement: 'Static' },
    { id: 'shot_3', sceneId: 'scene_1', dialogue: '', action: 'POV shot looking down a dark alleyway. A shadow moves.', status: 'pending', characters: [], cameraMovement: 'Slow zoom in' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="h-screen w-full bg-[#1A1A1A] text-[#D1D5DB] flex flex-col overflow-hidden"
    >
      {/* Top Header - Global Title */}
      <header className="h-14 border-b border-white/10 flex items-center px-6 shrink-0 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5000] shadow-[0_0_12px_rgba(255,80,0,0.8)] animate-pulse" />
          <h1 className="font-mono tracking-widest text-white font-bold">
            AI 世纪导演 // 控制中心
          </h1>
        </div>
      </header>

      {/* Middle Workspace - Sidebar + Canvas */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Script Tree */}
        <aside className="w-80 border-r border-white/10 flex flex-col bg-black/10 shrink-0">
          <div className="h-14 border-b border-white/10 px-6 flex items-center bg-black/20">
            <h2 className="text-white text-sm font-semibold font-mono">
              剧本结构树
            </h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-[#262626] rounded-xl p-4 mb-3 border border-white/10">
              <div className="text-white text-[14px] font-medium mb-1 font-mono">
                开场场景
              </div>
              <div className="text-[#D1D5DB]/70 text-[12px] font-mono">
                根据输入生成
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-4 mb-3 border border-white/10 hover:bg-[#262626] transition-colors cursor-pointer">
              <div className="text-white/90 text-[14px] font-medium mb-1 font-mono">
                场景 1: 介绍
              </div>
              <div className="text-[#D1D5DB]/50 text-[12px] font-mono">
                3 个镜头 • 0 个素材
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/10 hover:bg-[#262626] transition-colors cursor-pointer">
              <div className="text-white/90 text-[14px] font-medium mb-1 font-mono">
                场景 2: 冲突
              </div>
              <div className="text-[#D1D5DB]/50 text-[12px] font-mono">
                0 个镜头 • 0 个素材
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Canvas - Visual Sequences */}
        <section className="flex-1 overflow-y-auto p-8 relative">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-white text-lg font-semibold font-mono">
              视觉分镜序列
            </h2>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#262626] border border-white/10 hover:bg-white/5 text-white rounded-xl text-sm transition-all font-mono">
                添加镜头
              </button>
              <button className="px-4 py-2 bg-[#FF5000] border border-white/20 text-white rounded-xl text-sm font-medium transition-all hover:shadow-lg font-mono">
                全部生成
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {mockShots.map((shot) => (
              <ShotCard key={shot.id} shot={shot} />
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Command Bar - Chat / Action */}
      <footer className="border-t border-white/10 bg-black/40 p-4 shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] shadow-inner p-2 flex items-center gap-4">
            <input
              type="text"
              placeholder="输入导演指令... 例如：'将镜头 2 替换为赛博朋克风格的雨夜特写'"
              className="bg-transparent border-none focus:ring-0 text-white w-full px-4 py-2 outline-none font-mono"
            />
            <button className="bg-[#FF5000] rounded-full p-3 flex items-center justify-center hover:shadow-[0_0_15px_rgba(255,80,0,0.5)] transition-all">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
