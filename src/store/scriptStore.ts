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
  setRawIdea: (idea: string) => void;
  toggleTag: (tag: string) => void;
  simulateGeneration: () => Promise<void>;
  setProjectContext: (name: string, path: string) => void;
  setScriptData: (data: ScriptEngram | null) => void;
  setIsGenerating: (isGen: boolean) => void;
  setApiConfig: (config: { apiKey?: string; baseUrl?: string; customModelId?: string }) => void;
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
      // API Configuration Defaults
      apiKey: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      customModelId: 'deepseek-chat',
      
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
        projectName: state.projectName, 
        projectPath: state.projectPath 
      }), // Only save these specific fields to avoid saving massive JSON trees or transient states 
    } 
  ) 
);
