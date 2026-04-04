import { create } from 'zustand';

interface ScriptStore {
  rawIdea: string;
  selectedTags: string[];
  isGenerating: boolean;
  currentPhase: 'portal' | 'director';
  projectName: string | null;
  projectPath: string | null;
  scriptContent: string;
  setRawIdea: (idea: string) => void;
  toggleTag: (tag: string) => void;
  simulateGeneration: () => Promise<void>;
  setProjectContext: (name: string, path: string) => void;
  setScriptContent: (content: string) => void;
}

export const useScriptStore = create<ScriptStore>((set) => ({
  rawIdea: '',
  selectedTags: [],
  isGenerating: false,
  currentPhase: 'portal',
  projectName: null,
  projectPath: null,
  scriptContent: '',
  
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

  setScriptContent: (content) => set({ scriptContent: content })
}));
