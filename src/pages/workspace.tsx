import { useState } from 'react';
import { useScriptStore } from '@/store/scriptStore';

type ModelType = 'DeepSeek' | '豆包 (Doubao)' | 'Gemini' | 'GPT-4o';

export default function Workspace() {
  // State binding from script store
  const { 
    projectName, 
    projectPath, 
    scriptContent, 
    isGenerating,
    setScriptContent,
    setIsGenerating
  } = useScriptStore();

  // Local state
  const [selectedModel, setSelectedModel] = useState<ModelType>('DeepSeek');
  const [userPrompt, setUserPrompt] = useState('');

  const models: ModelType[] = ['DeepSeek', '豆包 (Doubao)', 'Gemini', 'GPT-4o'];

  const handleGenerate = async () => {
    if (!userPrompt.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      
      // Append connecting status
      setScriptContent(prev => prev ? `${prev}\n\n--- [Connecting to ${selectedModel}] ---` : `--- [Connecting to ${selectedModel}] ---`);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: "生成中文剧本+" + userPrompt,
          model: selectedModel
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.text();

      // Update script content
      setScriptContent(prev => {
        if (prev && !prev.includes('Connecting')) {
          return `${prev}\n\n--- [AI Generated - ${selectedModel}] ---\n\n${result}`;
        }
        // Replace connecting message with actual response
        return prev 
          ? prev.replace(`--- [Connecting to ${selectedModel}] ---`, `--- [AI Generated - ${selectedModel}] ---\n\n${result}`)
          : `--- [AI Generated - ${selectedModel}] ---\n\n${result}`;
      });

    } catch (error) {
      console.error('Generation failed:', error);
      setScriptContent(prev => 
        prev ? `${prev}\n\n--- [ERROR] Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        : `--- [ERROR] Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#FF5000] tracking-tight">
              🎬 AI 剧本工作台
            </h1>
            <p className="text-gray-400 mt-1">
              {projectName || '未命名项目'}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500 font-mono">
            <p>📂 {projectPath || '无路径'}</p>
          </div>
        </div>
      </header>

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-[calc(100vh-140px)]">
        {/* Left Column - Control Panel */}
        <div className="flex flex-col gap-6">
          {/* Model Selector */}
          <div className="bg-[#262626] border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 text-gray-200">🧠 选择模型</h2>
            <div className="grid grid-cols-2 gap-3">
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  disabled={isGenerating}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    selectedModel === model
                      ? 'bg-[#FF5000] text-white shadow-lg shadow-[#FF5000]/20'
                      : 'bg-[#1A1A1A] text-gray-300 hover:bg-gray-700 border border-gray-700'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input */}
          <div className="bg-[#262626] border border-gray-700 rounded-xl p-6 flex-1 flex flex-col">
            <h2 className="text-lg font-bold mb-4 text-gray-200">✍️ 生成提示</h2>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder="描述你想要生成的剧本内容、风格、人物设定等..."
              className="flex-1 w-full bg-[#1A1A1A] border border-gray-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-[#FF5000] transition-colors disabled:opacity-50 placeholder:text-gray-500"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !userPrompt.trim()}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              isGenerating || !userPrompt.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#FF5000] text-white hover:bg-[#FF6A33] shadow-lg shadow-[#FF5000]/20'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                生成中...
              </div>
            ) : (
              '⚡ 生成剧本'
            )}
          </button>
        </div>

        {/* Right Column - Script Content */}
        <div className="bg-[#262626] border border-gray-700 rounded-xl p-6 flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-gray-200">📄 剧本内容</h2>
          <textarea
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            placeholder="剧本内容将显示在这里..."
            className="flex-1 w-full bg-[#1A1A1A] border border-gray-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-[#FF5000] transition-colors font-mono text-sm"
          />
        </div>
      </div>
    </div>
  );
}
