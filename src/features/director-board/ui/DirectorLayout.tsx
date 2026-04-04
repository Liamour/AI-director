"use client";

import { motion } from "framer-motion";
import { 
  Brain, 
  FileText, 
  Plus, 
  Send, 
  Layers, 
  FolderTree, 
  Video
} from "lucide-react";
import ShotCard from "./ShotCard";
import { Shot } from "@/core/types";
import { useState } from "react";

type ModelType = 'DeepSeek' | '豆包 (Doubao)' | 'Gemini' | 'GPT-4o';

interface DirectorLayoutProps {}

export default function DirectorLayout({}: DirectorLayoutProps) {
  const [selectedModel, setSelectedModel] = useState<ModelType>('DeepSeek');
  const [userPrompt, setUserPrompt] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const models: ModelType[] = ['DeepSeek', '豆包 (Doubao)', 'Gemini', 'GPT-4o'];

  const mockShots: Shot[] = [
    { id: 'shot_1', sceneId: 'scene_1', dialogue: '', action: 'Wide establishing shot of a cyberpunk city street in the rain. Neon reflections.', status: 'completed', characters: [], cameraMovement: 'Pan right' },
    { id: 'shot_2', sceneId: 'scene_1', dialogue: '', action: 'Close up on the protagonist pulling their collar up against the cold.', status: 'generating', characters: [], cameraMovement: 'Static' },
    { id: 'shot_3', sceneId: 'scene_1', dialogue: '', action: 'POV shot looking down a dark alleyway. A shadow moves.', status: 'pending', characters: [], cameraMovement: 'Slow zoom in' },
  ];

  const handleGenerate = async () => {
    if (!userPrompt.trim() || isGenerating) return;
    
    try {
      setIsGenerating(true);
      setScriptContent(prev => prev ? `${prev}\n\n--- [Connecting to ${selectedModel}] ---` : `--- [Connecting to ${selectedModel}] ---`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setScriptContent(prev => 
        prev ? prev.replace(`--- [Connecting to ${selectedModel}] ---`, `--- [AI Generated - ${selectedModel}] ---\n\nGenerated script content will appear here...`)
        : `--- [AI Generated - ${selectedModel}] ---\n\nGenerated script content will appear here...`
      );
    } catch (error) {
      setScriptContent(prev => 
        prev ? `${prev}\n\n--- [ERROR] Generation failed` : `--- [ERROR] Generation failed`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="min-h-screen bg-[#0A0A0A] text-white font-sans"
    >
      {/* Header */}
      <header className="border-b border-white/10 p-8 backdrop-blur-xl bg-[#1A1A1A]/80">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#FF5000] shadow-[0_0_12px_rgba(255,80,0,0.8)]" />
            <h1 className="text-2xl font-bold tracking-tight">
              DIRECTOR WORKSPACE
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm font-mono text-white/60">
            <FolderTree size={16} />
            <span>PROJECT: UNNAMED</span>
          </div>
        </div>
      </header>

      {/* Main Content - Single Column Vertical Layout */}
      <main className="max-w-5xl mx-auto p-8 flex flex-col gap-8">
        {/* Top Level - Model Selector */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3 text-white/70 text-sm font-medium">
            <Brain size={16} />
            <span>SELECT MODEL</span>
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelType)}
            disabled={isGenerating}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-2xl px-4 py-3 text-white/80 focus:border-[#FF5000] focus:ring-1 focus:ring-[#FF5000] outline-none transition-all font-medium disabled:opacity-50 backdrop-blur-xl"
          >
            {models.map((model) => (
              <option key={model} value={model} className="bg-[#1A1A1A]">
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Strictly Controlled Container - Preview → Input → Button Stack */}
        <div className="flex flex-col w-full gap-4">
          {/* FIRST CHILD: Node B - Script Engram Preview Box */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3 text-white/70 text-sm font-medium">
              <Layers size={16} />
              <span>PREVIEW / OUTPUT</span>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col backdrop-blur-xl">
              <div className="mb-4 font-mono text-white/60 text-sm tracking-wider border-b border-white/5 pb-2">
                SCRIPT PREVIEW
              </div>
              <textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                placeholder="Generated script content will appear here..."
                className="flex-1 w-full min-h-[200px] bg-transparent border-none rounded-xl p-0 text-white resize-vertical focus:outline-none font-mono text-sm placeholder:text-white/30"
              />
            </div>
          </div>

          {/* SECOND CHILD: Node A - Text Input / Textarea */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3 text-white/70 text-sm font-medium">
              <FileText size={16} />
              <span>PROMPT INPUT</span>
            </div>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe your script requirements, shot details, style preferences, etc..."
              className="w-full min-h-[180px] bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 text-white resize-vertical focus:outline-none focus:border-[#FF5000] focus:ring-1 focus:ring-[#FF5000] transition-all font-mono text-base placeholder:text-white/30 disabled:opacity-50 backdrop-blur-xl"
            />
          </div>

          {/* THIRD CHILD: Node C - Compact Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !userPrompt.trim()}
            className={`py-1.5 px-4 text-sm w-fit self-start rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              isGenerating || !userPrompt.trim()
                ? 'bg-[#1A1A1A] text-white/30 cursor-not-allowed border border-white/10'
                : 'bg-[#FF5000] text-white hover:bg-[#FF6A33] hover:shadow-lg hover:shadow-[#FF5000]/20 border border-[#FF5000]/50'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                GENERATING...
              </>
            ) : (
              <>
                <Send size={16} />
                GENERATE
              </>
            )}
          </button>
        </div>

        {/* Shot Sequence Section */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
              <Video size={16} />
              <span>SHOT SEQUENCE</span>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#1A1A1A] border border-white/10 hover:bg-white/5 text-white rounded-2xl text-sm transition-all font-medium flex items-center gap-2 backdrop-blur-xl">
                <Plus size={16} />
                ADD SHOT
              </button>
              <button className="px-4 py-2 bg-[#FF5000] border border-[#FF5000]/50 text-white rounded-2xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-[#FF5000]/20 backdrop-blur-xl">
                GENERATE ALL
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {mockShots.map((shot) => (
              <ShotCard key={shot.id} shot={shot} />
            ))}
          </div>
        </div>
      </main>
    </motion.div>
  );
}
