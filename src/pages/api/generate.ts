import type { NextApiRequest, NextApiResponse } from 'next'; 
 
// Define the expected output structure so we can instruct the LLM 
const JSON_SCHEMA_PROMPT = ` 
You are an elite AI Storyboard Director. Your ONLY task is to take the user's prompt and output a perfectly structured JSON object representing a ScriptEngram. 
NEVER output conversational filler. NEVER output anything outside the JSON. 
 
The JSON MUST strictly follow this TypeScript interface: 
interface Character { id: string; name: string; appearance: string; role: string; } 
interface Shot { shotId: string; type: string; visualDescription: string; dialogue?: string; action?: string; } 
interface Scene { sceneId: string; location: string; timeOfDay: string; environment: string; shots: Shot[]; } 
interface ScriptEngram { title: string; logline: string; characters: Character[]; scenes: Scene[]; } 
 
Format your response as raw JSON only. 
`; 
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) { 
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' }); 
 
  const { prompt, apiKey, baseUrl, customModelId } = req.body; 
 
  if (!prompt || !apiKey || !baseUrl || !customModelId) { 
    return res.status(400).json({ error: 'Missing required fields (prompt, apiKey, baseUrl, customModelId)' }); 
  } 
 
  try { 
    const response = await fetch(baseUrl, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      }, 
      body: JSON.stringify({ 
        model: customModelId, 
        messages: [ 
          { role: 'system', content: JSON_SCHEMA_PROMPT }, 
          { role: 'user', content: prompt } 
        ], 
        temperature: 0.7, 
        // Volcengine strictly supports these OpenAI compatible parameters 
      }) 
    }); 
 
    if (!response.ok) { 
      const errData = await response.text(); 
      throw new Error(`API Provider Error: ${response.status} - ${errData}`); 
    } 
 
    const data = await response.json(); 
    let content = data.choices?.[0]?.message?.content; 
 
    if (!content) throw new Error('No content received from API provider'); 
 
    // DEFENSIVE PROGRAMMING: Markdown Stripper 
    // LLMs often wrap JSON in ```json ... ``` 
    content = content.replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, ''); 
    content = content.trim(); 
 
    // Ensure it starts with '{' or '[' (basic validation) 
    if (!content.startsWith('{') && !content.startsWith('[')) { 
      // Find the first '{' and last '}' just in case there's still preamble 
      const startIdx = content.indexOf('{'); 
      const endIdx = content.lastIndexOf('}'); 
      if (startIdx !== -1 && endIdx !== -1) { 
        content = content.substring(startIdx, endIdx + 1); 
      } 
    } 
 
    // Attempt to parse the cleaned string 
    const parsedData = JSON.parse(content); 
 
    return res.status(200).json({ success: true, data: parsedData }); 
 
  } catch (error: any) { 
    console.error('Neural Gateway Error:', error); 
    return res.status(500).json({ success: false, error: error.message }); 
  } 
}
