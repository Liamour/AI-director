export interface Project {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  orderIndex: number;
}

export interface Shot {
  id: string;
  sceneId: string;
  dialogue: string;
  action: string;
  characters: string[];
  cameraMovement: string;
  status: 'pending' | 'generating' | 'completed';
}
