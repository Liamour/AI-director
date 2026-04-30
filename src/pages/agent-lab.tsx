// ──────────────────────────────────────────────────────────────────────────
// /agent-lab — sandbox for the multi-agent runtime.
//
// Mirrors te-lab.tsx but for the Director pipeline. Lets you:
//   - pick a model preset
//   - punch in an idea
//   - watch the agent trace stream back (writer → cinematographer × N)
//   - inspect the final ScriptEngram + image prompts
//
// This is a developer-facing tool — the production UX lives in workspace.tsx
// and will get wired to /api/agents/director in a follow-up.
// ──────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useScriptStore } from '@/store/scriptStore';
import {
  Knob,
  Key,
  LCD,
  LCDPixelArt,
  Panel,
} from '@/shared/ui/te';
import type {
  DirectorOutput,
  DirectorTraceEntry,
  CinematographerOutput,
} from '@/core/agents';

const PRESET_MODELS = [
  { label: 'deepseek', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelId: 'deepseek-chat' },
  { label: 'doubao',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelId: 'doubao-pro-32k' },
  { label: 'gemini',   baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', modelId: 'gemini-2.0-flash' },
  { label: 'gpt-4o',   baseUrl: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
] as const;

type Status = 'idle' | 'running' | 'ok' | 'error';

interface DirectorResponse {
  ok: boolean;
  data?: DirectorOutput;
  error?: { kind: string; message: string; issues?: string[] };
  meta?: { agentName: string; backbone: string; attempts: number; durationMs: number };
  events?: Array<{ type: string; agent?: string; attempt?: number; reason?: string; path?: string }>;
}

export default function AgentLab() {
  const { apiKey, baseUrl, customModelId, setApiConfig } = useScriptStore();
  const [activeModelPreset, setActiveModelPreset] = useState(0);
  const [idea, setIdea] = useState(
    'a cyberpunk noir short — neon alley pursuit at 3am, rain reflections, lone protagonist confronts a memory thief.'
  );
  const [shotLimit, setShotLimit] = useState(0.4); // 0..1 → 0..N
  const [status, setStatus] = useState<Status>('idle');
  const [response, setResponse] = useState<DirectorResponse | null>(null);

  const applyPreset = (i: number) => {
    setActiveModelPreset(i);
    const preset = PRESET_MODELS[i];
    setApiConfig({ baseUrl: preset.baseUrl, customModelId: preset.modelId });
  };

  const run = async () => {
    if (!idea.trim() || !apiKey) return;
    setStatus('running');
    setResponse(null);
    try {
      const limitN = Math.max(1, Math.round(shotLimit * 10));
      const res = await fetch('/api/agents/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          apiKey,
          baseUrl,
          modelId: customModelId,
          cinematographerShotLimit: limitN,
        }),
      });
      const json = (await res.json()) as DirectorResponse;
      setResponse(json);
      setStatus(json.ok ? 'ok' : 'error');
    } catch (e) {
      setResponse({
        ok: false,
        error: { kind: 'network', message: e instanceof Error ? e.message : String(e) },
      });
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-te-bone font-te text-te-charcoal pb-12">
      <header className="px-8 pt-6 pb-4 flex items-end justify-between border-b border-te-bone-edge/40">
        <div className="flex items-center gap-3">
          <span className={statusDotClass(status)} />
          <h1 className="text-[18px] font-semibold lowercase tracking-tight">
            ai director · agent lab
          </h1>
          <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
            multi-agent runtime
          </span>
        </div>
        <div className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
          status · {status}
        </div>
      </header>

      <section className="px-8 py-6 grid grid-cols-12 gap-5">
        {/* INPUT */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <Panel title="input" meta="director">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[9px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                  model
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_MODELS.map((m, i) => (
                    <Key
                      key={m.label}
                      variant="text"
                      active={i === activeModelPreset}
                      onClick={() => applyPreset(i)}
                    >
                      {m.label}
                    </Key>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                  idea
                </label>
                <div className="rounded-md bg-te-charcoal shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] p-3">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    disabled={status === 'running'}
                    placeholder="describe a scene · style · vibe..."
                    className="w-full min-h-[120px] bg-transparent border-none outline-none resize-vertical text-te-lcd-fg font-lcd text-[15px] leading-tight placeholder:text-te-lcd-dim/60 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5">
                <Knob
                  label="shots"
                  sublabel={`${Math.max(1, Math.round(shotLimit * 10))}`}
                  value={shotLimit}
                  onChange={setShotLimit}
                  color="orange"
                />
                <div className="flex-1 text-[10px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/55 leading-relaxed">
                  cinematographer shot limit · how many shots to generate image prompts for
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                  api key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="te-input"
                />
              </div>

              <button
                onClick={run}
                disabled={status === 'running' || !idea.trim() || !apiKey}
                className={`w-full h-12 rounded-md lowercase text-[12px] tracking-[0.18em] transition-all flex items-center justify-center gap-2 select-none
                  ${status === 'running' || !idea.trim() || !apiKey
                    ? 'bg-te-bone-dim text-te-charcoal/35 cursor-not-allowed shadow-te-key'
                    : 'bg-te-knob-red text-te-bone shadow-te-key hover:brightness-110 active:translate-y-[1px] active:shadow-te-key-active'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {status === 'running' ? 'orchestrating' : 'run director'}
              </button>

              {!apiKey && (
                <div className="text-[9px] font-te-mono uppercase tracking-widest text-te-warn/90 leading-relaxed">
                  ⚠ api key not set
                </div>
              )}
            </div>
          </Panel>

          {/* TRACE */}
          {response?.events && response.events.length > 0 && (
            <Panel title="trace" meta={`${response.events.length} events`}>
              <div className="bg-te-charcoal rounded-md p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] max-h-[280px] overflow-auto">
                <pre className="text-[11px] font-lcd text-te-lcd-fg leading-snug">
                  {response.events.map((e, i) => formatEvent(e, i)).join('\n')}
                </pre>
              </div>
            </Panel>
          )}
        </div>

        {/* OUTPUT */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <Panel title="output · engram" meta={response?.data ? 'ok' : '—'}>
            {!response && (
              <div className="flex items-center justify-center py-8">
                <LCD width={420} height={140}>
                  <LCDPixelArt
                    rows={[
                      '                          ',
                      '   awaiting transmission  ',
                      '                          ',
                      '   ░▒▓ press run ●  ▓▒░   ',
                      '                          ',
                    ]}
                  />
                </LCD>
              </div>
            )}

            {response?.error && (
              <div className="bg-te-bone-dim rounded-md p-4">
                <div className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-err mb-2">
                  ✗ {response.error.kind}
                </div>
                <div className="text-[12px] font-te lowercase text-te-charcoal/85 leading-relaxed">
                  {response.error.message}
                </div>
                {response.error.issues && (
                  <ul className="mt-2 text-[10px] font-te-mono lowercase text-te-charcoal/65 list-disc pl-4">
                    {response.error.issues.slice(0, 8).map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {response?.data && <EngramSummary data={response.data} />}
          </Panel>

          {response?.data?.imagePrompts && response.data.imagePrompts.length > 0 && (
            <Panel title="image prompts" meta={`${response.data.imagePrompts.length}`}>
              <div className="flex flex-col gap-3">
                {response.data.imagePrompts.map((p) => (
                  <ImagePromptRow key={p.shotId} prompt={p} />
                ))}
              </div>
            </Panel>
          )}

          {response?.data?.trace && (
            <Panel title="agent trace" meta={`${response.data.trace.length} steps`} variant="recessed">
              <div className="flex flex-col gap-1.5">
                {response.data.trace.map((t) => (
                  <TraceRow key={t.step} entry={t} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </section>

      <style jsx global>{`
        .te-input {
          width: 100%;
          background: #161616;
          color: #B8C77A;
          font-family: VT323, ui-monospace, monospace;
          font-size: 14px;
          border: none;
          outline: none;
          border-radius: 4px;
          padding: 6px 8px;
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.5);
        }
        .te-input::placeholder { color: #7A8A4A; }
        .te-input:focus {
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.5), 0 0 0 1px #E8862A;
        }
      `}</style>
    </main>
  );
}

function statusDotClass(status: Status): string {
  const base = 'w-2.5 h-2.5 rounded-full';
  switch (status) {
    case 'running':
      return `${base} bg-te-knob-red shadow-[0_0_8px_rgba(214,48,49,0.8)] animate-pulse`;
    case 'ok':
      return `${base} bg-te-ok shadow-[0_0_6px_rgba(127,176,105,0.7)]`;
    case 'error':
      return `${base} bg-te-err shadow-[0_0_6px_rgba(230,57,70,0.7)]`;
    default:
      return `${base} bg-te-charcoal/30`;
  }
}

function formatEvent(e: any, i: number): string {
  const idx = String(i + 1).padStart(2, '0');
  switch (e.type) {
    case 'agent:start':   return `${idx} ▶  ${e.agent} start`;
    case 'agent:thinking':return `${idx} ⌁  ${e.agent} thinking · attempt ${e.attempt}`;
    case 'agent:retry':   return `${idx} ↻  ${e.agent} retry · ${e.reason}`;
    case 'agent:output':  return `${idx} ✓  ${e.agent} output`;
    case 'agent:done':    return `${idx} ■  ${e.agent} done`;
    case 'agent:error':   return `${idx} ✗  ${e.agent} error`;
    case 'engram:patch':  return `${idx} ✎  engram ${e.path} · rev ${e.revision}`;
    default:              return `${idx} ?  ${JSON.stringify(e)}`;
  }
}

function EngramSummary({ data }: { data: DirectorOutput }) {
  const e = data.engram;
  const totalShots = e.scenes.reduce((s, sc) => s + sc.shots.length, 0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[15px] font-semibold lowercase">{e.title.toLowerCase()}</div>
        <div className="text-[11px] font-te italic text-te-charcoal/75 leading-relaxed mt-1">
          {e.logline}
        </div>
        <div className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mt-2">
          {e.characters.length} cast · {e.scenes.length} scenes · {totalShots} shots
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {e.characters.slice(0, 4).map((c) => (
          <div key={c.id} className="bg-te-bone-dim rounded-md p-2 shadow-te-key">
            <div className="text-[11px] font-semibold lowercase">{c.name.toLowerCase()}</div>
            <div className="text-[9px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/55">
              {c.role.toLowerCase()}
            </div>
            <div className="text-[10px] lowercase text-te-charcoal/70 mt-1 line-clamp-2">
              {c.appearance}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagePromptRow({ prompt }: { prompt: CinematographerOutput }) {
  return (
    <div className="bg-te-bone-dim rounded-md p-3 shadow-te-key">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/65">
          {prompt.shotId} · {prompt.aspectRatio}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-te-knob-orange" />
      </div>
      <div className="text-[11px] font-lcd text-te-charcoal/85 leading-snug whitespace-pre-wrap break-words">
        {prompt.imagePrompt}
      </div>
      <div className="text-[9px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/45 mt-2 leading-snug">
        ⊘ {prompt.negativePrompt}
      </div>
    </div>
  );
}

function TraceRow({ entry }: { entry: DirectorTraceEntry }) {
  return (
    <div className="flex items-center justify-between bg-te-bone-dim rounded-sm px-3 py-1.5 shadow-te-key">
      <div className="flex items-center gap-2 text-[10px] font-te-mono uppercase tracking-[0.18em]">
        <span className="text-te-charcoal/45 w-6">{String(entry.step).padStart(2, '0')}</span>
        <span className={entry.ok ? 'text-te-ok' : 'text-te-err'}>{entry.ok ? '✓' : '✗'}</span>
        <span className="text-te-charcoal">{entry.agent}</span>
      </div>
      <div className="text-[10px] font-te-mono lowercase text-te-charcoal/55">
        {entry.attempts}× · {entry.durationMs}ms
        {entry.error ? ` · ${entry.error.kind}` : ''}
      </div>
    </div>
  );
}
