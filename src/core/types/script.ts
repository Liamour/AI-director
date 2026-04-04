export interface Character { 
  id: string; 
  name: string; 
  appearance: string; 
  role: string; 
} 

export interface Shot { 
  shotId: string; 
  type: string; // e.g., Wide, Close-up 
  visualDescription: string; 
  dialogue?: string; 
  action?: string; 
} 

export interface Scene { 
  sceneId: string; 
  location: string; 
  timeOfDay: string; 
  environment: string; 
  shots: Shot[]; 
} 

export interface ScriptEngram { 
  title: string; 
  logline: string; 
  characters: Character[]; 
  scenes: Scene[]; 
}
