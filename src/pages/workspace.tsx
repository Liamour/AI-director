"use client";

import { useState, useEffect, useRef } from 'react';
import { useScriptStore } from '@/store/scriptStore';
import type { ScriptEngram, Scene, Character } from '@/core/types/script';

type ModelType = 'DeepSeek' | '豆包 (Doubao)' | 'Gemini' | 'GPT-4o';

export default function Workspace() {
  // State binding from script store
  const { 
    projectName, 
    scriptData, 
    isGenerating,
    setScriptData,
    setIsGenerating,
    apiKey,
    baseUrl,
    customModelId,
    setApiConfig
  } = useScriptStore();

  // Local state
  const [selectedModel, setSelectedModel] = useState<ModelType>('DeepSeek');
  const [userPrompt, setUserPrompt] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null); 
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });

  const models: ModelType[] = ['DeepSeek', '豆包 (Doubao)', 'Gemini', 'GPT-4o'];

  // Text Selection Handler for Floating AI Enhance Menu
  const handleTextSelection = () => { 
    const selection = window.getSelection(); 
    if (selection && selection.toString().trim().length > 0) { 
      const range = selection.getRangeAt(0); 
      const rect = range.getBoundingClientRect(); 
      setSelectionMenu({ 
        visible: true, 
        x: rect.left + window.scrollX + (rect.width / 2), 
        y: rect.top + window.scrollY - 40, // 40px above selection 
        text: selection.toString().trim() 
      }); 
    } else { 
      setSelectionMenu({ visible: false, x: 0, y: 0, text: '' }); 
    } 
  };

  // Close selection menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (selectionMenu.visible) {
        setSelectionMenu({ visible: false, x: 0, y: 0, text: '' });
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectionMenu.visible]);

  // Hydrate imported raw script from landing page
  useEffect(() => { 
    const importedRaw = sessionStorage.getItem('imported_raw_script'); 
    if (importedRaw) { 
      setUserPrompt(importedRaw); 
      sessionStorage.removeItem('imported_raw_script'); // Clear it after use
    } 
  }, []);

  const handleGenerate = async () => {
    if (!userPrompt || userPrompt.trim() === '' || isGenerating) return;

    try {
      setIsGenerating(true);
      setScriptData(null);
      setActiveSceneId(null);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userPrompt, 
          apiKey, 
          baseUrl, 
          customModelId 
        }), 
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json() as { success: boolean; data: ScriptEngram; error?: string };

      if (result.success && result.data) {
        setScriptData(result.data);
        // Set first scene as active by default
        if (result.data.scenes?.length > 0) {
          setActiveSceneId(result.data.scenes[0].sceneId);
        }
      } else {
        throw new Error(result.error || 'Generation failed');
      }

    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get active scene data
  const activeScene = scriptData?.scenes?.find(scene => scene.sceneId === activeSceneId);

  return (
    <div className="flex h-screen w-full bg-[#050505] text-white overflow-hidden font-sans">
      {/* LEFT PANE: NAVIGATOR */}
      <aside className="w-64 bg-[#0A0A0A] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-[10px] font-mono text-[#FF5000] tracking-widest font-bold uppercase">
            PROJECT
          </h2>
          <p className="text-sm font-semibold mt-1 truncate">
            {projectName || 'UNNAMED PROJECT'}
          </p>
        </div>

        {/* Scenes Navigation */}
        <div className="p-4 border-b border-white/5 flex flex-col gap-2">
          <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-2">
            ACT SCENES
          </h3>
          {!scriptData?.scenes?.length && (
            <p className="text-xs text-gray-600 italic">Awaiting generation...</p>
          )}
          {scriptData?.scenes?.map((scene: Scene) => (
            <button
              key={scene.sceneId}
              onClick={() => setActiveSceneId(scene.sceneId)}
              className={`text-left px-3 py-2 rounded text-sm transition-all ${
                activeSceneId === scene.sceneId 
                  ? 'bg-[#FF5000]/10 border border-[#FF5000]/30 text-white' 
                  : 'bg-transparent border border-transparent hover:bg-white/5 text-gray-400'
              }`}
            >
              <div className="font-mono text-xs mb-0.5">{scene.sceneId.toUpperCase()}</div>
              <div className="text-xs truncate">{scene.location}</div>
              <div className="text-[10px] text-gray-500">{scene.timeOfDay}</div>
            </button>
          ))}
        </div>

        {/* Characters Roster */}
        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          <h3 className="text-[10px] font-mono text-gray-500 tracking-widest uppercase mb-2">
            CHARACTERS
          </h3>
          {!scriptData?.characters?.length && (
            <p className="text-xs text-gray-600 italic">Awaiting generation...</p>
          )}
          {scriptData?.characters?.map((char: Character) => (
            <div
              key={char.id}
              className="bg-[#141414] border border-white/10 rounded px-3 py-2"
            >
              <div className="text-sm font-medium mb-0.5">{char.name}</div>
              <div className="text-[10px] text-gray-400 mb-1">{char.role}</div>
              <div className="text-[10px] text-gray-500 line-clamp-2">{char.appearance}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER PANE: MAIN CANVAS */}
      <main className="flex-1 overflow-y-auto relative p-8" onMouseUp={handleTextSelection}>
        {/* Global Enhance Button */}
        {scriptData && (
          <button className="absolute top-8 right-8 text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1 rounded text-white font-mono">
            ✨ OVERALL AI ENRICHMENT
          </button>
        )}

        {/* Floating AI Enhance Menu */}
        {selectionMenu.visible && ( 
          <div 
            className="fixed z-50 bg-[#FF5000] text-black text-xs font-bold px-3 py-1.5 rounded shadow-lg shadow-[#FF5000]/20 cursor-pointer hover:bg-white transition-colors transform -translate-x-1/2 flex items-center gap-2" 
            style={{ left: selectionMenu.x, top: selectionMenu.y }} 
            onMouseDown={(e) => e.preventDefault()} // Prevent selection loss 
          > 
            ✨ AI ENHANCE 
          </div> 
        )}

        {/* Empty State */}
        {!scriptData && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-[#FF5000]/50 text-6xl font-mono font-bold mb-4">
              // EMPTY CANVAS
            </div>
            <p className="text-gray-500 font-mono text-sm">
              Enter a prompt in the commander panel to generate your script
            </p>
          </div>
        )}

        {/* Script Content */}
        {scriptData && (
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold mb-2">{scriptData.title}</h1>
              <p className="text-gray-400 italic font-mono text-lg">{scriptData.logline}</p>
            </div>

            {/* Active Scene Content */}
            {activeScene && (
              <div className="space-y-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <h2 className="text-2xl font-bold font-mono text-[#FF5000]">
                    {activeScene.sceneId.toUpperCase()} • {activeScene.location.toUpperCase()}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {activeScene.timeOfDay} • {activeScene.environment}
                  </p>
                </div>

                {/* Shot List */}
                <div className="space-y-4">
                  {activeScene.shots.map((shot) => (
                    <div
                      key={shot.shotId}
                      className="bg-[#0A0A0A] border-l-2 border-[#FF5000] p-4 rounded-r-xl"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-gray-500">{shot.shotId}</span>
                        <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">
                          {shot.type.toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-white text-base mb-2">{shot.visualDescription}</p>
                      
                      {shot.dialogue && (
                        <p className="text-gray-300 italic pl-3 border-l border-white/10 mb-1">
                          "{shot.dialogue}"
                        </p>
                      )}
                      
                      {shot.action && (
                        <p className="text-gray-500 text-xs font-mono">
                          [ACTION] {shot.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show all scenes if no active scene selected */}
            {!activeSceneId && scriptData.scenes.map((scene) => (
              <div key={scene.sceneId} className="mb-12">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <h2 className="text-2xl font-bold font-mono text-[#FF5000]">
                    {scene.sceneId.toUpperCase()} • {scene.location.toUpperCase()}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {scene.timeOfDay} • {scene.environment}
                  </p>
                </div>

                <div className="space-y-4">
                  {scene.shots.map((shot) => (
                    <div
                      key={shot.shotId}
                      className="bg-[#0A0A0A] border-l-2 border-[#FF5000] p-4 rounded-r-xl"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-gray-500">{shot.shotId}</span>
                        <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">
                          {shot.type.toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-white text-base mb-2">{shot.visualDescription}</p>
                      
                      {shot.dialogue && (
                        <p className="text-gray-300 italic pl-3 border-l border-white/10 mb-1">
                          "{shot.dialogue}"
                        </p>
                      )}
                      
                      {shot.action && (
                        <p className="text-gray-500 text-xs font-mono">
                          [ACTION] {shot.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* RIGHT PANE: COMMANDER */}
      <aside className="w-80 bg-[#0A0A0A] border-l border-white/5 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <h2 className="text-[10px] font-mono text-[#FF5000] tracking-widest font-bold uppercase border-b border-white/5 pb-3">
          COMMANDER
        </h2>

        {/* Model Selector */}
        <div className="w-full">
          <label className="text-[10px] text-gray-500 font-mono uppercase mb-2 block">
            SELECT MODEL
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelType)}
            disabled={isGenerating}
            className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-white/80 focus:border-[#FF5000] focus:ring-1 focus:ring-[#FF5000] outline-none transition-all font-medium disabled:opacity-50 text-sm"
          >
            {models.map((model) => (
              <option key={model} value={model} className="bg-[#141414]">
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Neural API Configuration Panel */}
        <div className="w-full flex flex-col gap-2"> 
          <button 
            onClick={() => setShowApiSettings(!showApiSettings)} 
            className="text-xs font-mono text-gray-500 hover:text-[#FF5000] flex items-center gap-2 self-start transition-colors" 
          > 
            [{showApiSettings ? '-' : '+'}] ADVANCED NEURAL API CONFIG 
          </button> 
          
          {showApiSettings && ( 
            <div className="w-full bg-[#050505] border border-white/10 rounded-md p-4 grid grid-cols-1 gap-4"> 
              <div className="flex flex-col gap-1"> 
                <label className="text-[10px] text-gray-500 font-mono uppercase">API Endpoint (Base URL)</label> 
                <input 
                  type="text" 
                  value={baseUrl} 
                  onChange={(e) => setApiConfig({ baseUrl: e.target.value })} 
                  className="bg-[#141414] border border-white/10 rounded-sm px-3 py-1.5 text-sm text-gray-300 font-mono focus:border-[#FF5000] focus:outline-none" 
                /> 
              </div> 
              <div className="flex flex-col gap-1"> 
                <label className="text-[10px] text-gray-500 font-mono uppercase">Model ID</label> 
                <input 
                  type="text" 
                  value={customModelId} 
                  onChange={(e) => setApiConfig({ customModelId: e.target.value })} 
                  className="bg-[#141414] border border-white/10 rounded-sm px-3 py-1.5 text-sm text-gray-300 font-mono focus:border-[#FF5000] focus:outline-none" 
                /> 
              </div> 
              <div className="flex flex-col gap-1"> 
                <label className="text-[10px] text-gray-500 font-mono uppercase">API Key (Bearer Token)</label> 
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiConfig({ apiKey: e.target.value })} 
                  placeholder="sk-..." 
                  className="bg-[#141414] border border-white/10 rounded-sm px-3 py-1.5 text-sm text-gray-300 font-mono focus:border-[#FF5000] focus:outline-none" 
                /> 
              </div> 
            </div> 
          )} 
        </div>

        {/* Prompt Textarea */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-gray-500 font-mono uppercase">GENERATION PROMPT</label>
          <textarea
            value={userPrompt || ""}
            onChange={(e) => setUserPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe your script requirements, style, character settings, etc..."
            className="w-full min-h-[150px] bg-[#141414] border border-white/10 rounded-xl p-4 text-white resize-vertical focus:outline-none focus:border-[#FF5000] focus:ring-1 focus:ring-[#FF5000] transition-all font-mono text-sm placeholder:text-white/30 disabled:opacity-50"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !userPrompt || userPrompt.trim() === ''}
          className={`py-3 px-4 w-full text-sm rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            isGenerating || !userPrompt || userPrompt.trim() === ''
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
            'GENERATE SCRIPT'
          )}
        </button>
      </aside>
    </div>
  );
}
