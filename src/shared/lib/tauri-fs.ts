import { isTauri } from '@tauri-apps/api/core'; 
import { open } from '@tauri-apps/plugin-dialog'; 
import { mkdir } from '@tauri-apps/plugin-fs'; 
import { join } from '@tauri-apps/api/path';

export const scaffoldProject = async (projectName: string): Promise<string> => { 
  try { 
    // Advanced environment check: handles potential Next.js SSR hydration issues 
    const isTauriEnv = isTauri || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window); 

    if (!isTauriEnv) { 
      console.warn('[Mock] Web preview mode: Project scaffolding simulated'); 
      return `/mock/local/projects/${projectName.trim()}`; 
    } 

    console.log("[Tauri V2] Triggering native plugin dialog..."); 
    
    // Invoke Native V2 Dialog Plugin 
    const selectedPath = await open({ 
      directory: true, 
      multiple: false, 
      title: 'Select Project Root Directory' 
    }); 

    if (!selectedPath) { 
      throw new Error("User canceled folder selection"); 
    } 

    // Normalize path (open returns string | string[] | null) 
    const basePath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath; 
    
    // USE THIS NEW LOGIC: 
    const projectRoot = await join(basePath, projectName.trim()); 

    console.log(`[Tauri V2] Creating physical directories at: ${projectRoot}`); 

    // Create physical folder structure 
    await mkdir(projectRoot, { recursive: true }); 
    await mkdir(await join(projectRoot, '剧本'), { recursive: true }); 
    await mkdir(await join(projectRoot, '脚本'), { recursive: true }); 
    await mkdir(await join(projectRoot, '角色'), { recursive: true }); 
    await mkdir(await join(projectRoot, '场景'), { recursive: true }); 
    await mkdir(await join(projectRoot, '视频素材'), { recursive: true }); 

    return projectRoot; 

  } catch (error) { 
    console.error("[CRITICAL] Tauri Native API Failed. Reason:", error); 
    // Graceful degradation 
    return `/mock/local/projects/${projectName.trim()}`; 
  } 
}; 