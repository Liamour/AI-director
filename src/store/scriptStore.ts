import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptEngram } from '@/core/types/script';

interface ScriptStore {
  rawIdea: string;
  selectedTags: string[];
  isGenerating: boolean;
  currentPhase: 'portal' | 'director';
  projectName: string | null;
  projectPath: string | null;
  scriptData: ScriptEngram | null;
  // API Configuration States
  apiKey: string;
  baseUrl: string;
  customModelId: string;
  /** model id used by /api/render — usually different from chat model (e.g. dall-e-3 / flux-schnell) */
  imageModelId: string;
  /** which render backend to dispatch to */
  renderBackend: 'cloud' | 'comfyui';
  /** ComfyUI base url — typically http://localhost:8188 */
  comfyUrl: string;
  /** Checkpoint filename inside ComfyUI/models/checkpoints/ */
  comfyCheckpoint: string;
  setRawIdea: (idea: string) => void;
  toggleTag: (tag: string) => void;
  simulateGeneration: () => Promise<void>;
  setProjectContext: (name: string, path: string) => void;
  setScriptData: (data: ScriptEngram | null) => void;
  setIsGenerating: (isGen: boolean) => void;
  setApiConfig: (config: {
    apiKey?: string;
    baseUrl?: string;
    customModelId?: string;
    imageModelId?: string;
    renderBackend?: 'cloud' | 'comfyui';
    comfyUrl?: string;
    comfyCheckpoint?: string;
  }) => void;
}

export const useScriptStore = create<ScriptStore>()( 
  persist( 
    (set) => ({
      rawIdea: '',
      selectedTags: [],
      isGenerating: false,
      currentPhase: 'portal',
      projectName: null,
      projectPath: null,
      scriptData: null,
      // API Configuration Defaults — match the deepseek preset out of the box.
      // Any OpenAI-compatible endpoint works (DeepSeek, Doubao, Gemini OpenAI-compat,
      // OpenAI, vLLM, Ollama, …); user can edit base url / model id freely.
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1/chat/completions',
      customModelId: 'deepseek-chat',
      // Image gen reuses the same baseUrl + apiKey by default (most proxies bundle both).
      // Empty = renders skipped silently. Common values: dall-e-3 / gpt-image-1 / flux-schnell.
      imageModelId: '',
      // Render backend — 'cloud' uses imageModelId + the chat baseUrl/apiKey;
      // 'comfyui' uses comfyUrl + comfyCheckpoint instead, talking to a local ComfyUI install.
      renderBackend: 'cloud',
      comfyUrl: 'http://localhost:8188',
      comfyCheckpoint: 'flux1-schnell.safetensors',
      
      setRawIdea: (idea) => set({ rawIdea: idea }),
      
      toggleTag: (tag) => set((state) => ({
        selectedTags: state.selectedTags.includes(tag)
          ? state.selectedTags.filter(t => t !== tag)
          : [...state.selectedTags, tag]
      })),
      
      simulateGeneration: async () => {
        set({ isGenerating: true });
        await new Promise(resolve => setTimeout(resolve, 2000));
        set({ isGenerating: false, currentPhase: 'director' });
      },

      setProjectContext: (name, path) => set({ 
        projectName: name, 
        projectPath: path 
      }),

      setScriptData: (data) => set({ scriptData: data }),
      
      setIsGenerating: (isGen) => set({ isGenerating: isGen }),
      
      setApiConfig: (config) => set((state) => ({ ...state, ...config })),
    }), 
    { 
      name: 'ai-director-storage', // The key in localStorage 
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        customModelId: state.customModelId,
        imageModelId: state.imageModelId,
        renderBackend: state.renderBackend,
        comfyUrl: state.comfyUrl,
        comfyCheckpoint: state.comfyCheckpoint,
        projectName: state.projectName,
        projectPath: state.projectPath
      }), // Only save these specific fields to avoid saving massive JSON trees or transient states
    } 
  ) 
);
