import { useState, useEffect, useMemo } from 'react';
import { useScriptStore } from '@/store/scriptStore';
import type { ScriptEngram, Scene, Shot, Character } from '@/core/types/script';
import {
  Knob,
  Key,
  LCD,
  LCDPixelArt,
  LCDBars,
  ModeRail,
  Panel,
  Tape,
  ShotCard,
} from '@/shared/ui/te';
import type { ShotStatus } from '@/shared/ui/te';

const MODES = [
  { label: 'idea' },
  { label: 'script' },
  { label: 'board' },
  { label: 'cast' },
  { label: 'set' },
  { label: 'audio' },
  { label: 'mix' },
  { label: 'out' },
] as const;

const PRESET_MODELS = [
  { label: 'deepseek', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelId: 'deepseek-chat' },
  { label: 'doubao',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelId: 'doubao-pro-32k' },
  { label: 'gemini',   baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', modelId: 'gemini-2.0-flash' },
  { label: 'gpt-4o',   baseUrl: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
] as const;

export default function Workspace() {
  const {
    projectName,
    scriptData,
    isGenerating,
    setScriptData,
    setIsGenerating,
    apiKey,
    baseUrl,
    customModelId,
    setApiConfig,
  } = useScriptStore();

  // ── ui state ──
  const [mode, setMode] = useState(2); // default: T3 board
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeShotIdx, setActiveShotIdx] = useState(0);
  const [userPrompt, setUserPrompt] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [activeModelPreset, setActiveModelPreset] = useState(0);

  // ── 4 generation knobs ──
  const [style, setStyle] = useState(0.65);
  const [motion, setMotion] = useState(0.45);
  const [lens, setLens] = useState(0.7);
  const [mood, setMood] = useState(0.85);

  // ── tape mock playback ──
  const [tapePlaying, setTapePlaying] = useState(false);
  const [tapePos, setTapePos] = useState(0);
  useEffect(() => {
    if (!tapePlaying) return;
    const id = setInterval(() => setTapePos((p) => (p >= 1 ? 0 : p + 0.005)), 50);
    return () => clearInterval(id);
  }, [tapePlaying]);

  // ── animated spectrum ──
  const [bars, setBars] = useState<number[]>(Array.from({ length: 24 }, () => 0.1));
  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) =>
        prev.map((v) => {
          const target = isGenerating
            ? 0.4 + Math.random() * 0.6
            : tapePlaying
            ? 0.2 + Math.random() * (0.3 + mood * 0.5)
            : Math.max(0.05, v * 0.85);
          return v + (target - v) * 0.4;
        })
      );
    }, 80);
    return () => clearInterval(id);
  }, [isGenerating, tapePlaying, mood]);

  // ── hydrate imported raw script ──
  useEffect(() => {
    const raw = sessionStorage.getItem('imported_raw_script');
    if (raw) {
      setUserPrompt(raw);
      sessionStorage.removeItem('imported_raw_script');
    }
  }, []);

  // ── set first scene active when scriptData arrives ──
  useEffect(() => {
    if (scriptData?.scenes?.length && !activeSceneId) {
      setActiveSceneId(scriptData.scenes[0].sceneId);
      setActiveShotIdx(0);
    }
  }, [scriptData, activeSceneId]);

  // ── apply model preset ──
  useEffect(() => {
    const preset = PRESET_MODELS[activeModelPreset];
    if (preset && (preset.baseUrl !== baseUrl || preset.modelId !== customModelId)) {
      setApiConfig({ baseUrl: preset.baseUrl, customModelId: preset.modelId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModelPreset]);

  // ── generate handler ──
  const handleGenerate = async () => {
    if (!userPrompt.trim() || isGenerating) return;
    try {
      setIsGenerating(true);
      setScriptData(null);
      setActiveSceneId(null);

      const enriched = `[parameters: style ${pct(style)}, motion ${pct(motion)}, lens ${pct(lens)}, mood ${pct(mood)}]\n\n${userPrompt}`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enriched, apiKey, baseUrl, customModelId }),
      });

      if (!response.ok) throw new Error(`api ${response.status}`);
      const result = (await response.json()) as { success: boolean; data: ScriptEngram; error?: string };

      if (result.success && result.data) {
        setScriptData(result.data);
        if (result.data.scenes?.length > 0) setActiveSceneId(result.data.scenes[0].sceneId);
      } else {
        throw new Error(result.error || 'generation failed');
      }
    } catch (err) {
      console.error('[generate]', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeScene = scriptData?.scenes?.find((s) => s.sceneId === activeSceneId) ?? null;
  const activeShot = activeScene?.shots?.[activeShotIdx] ?? null;
  const totalShots = scriptData?.scenes?.reduce((sum, s) => sum + s.shots.length, 0) ?? 0;

  const lcdNowRows = useMemo(() => {
    if (isGenerating) {
      return ['synthesizing', '░▒▓██████▓▒░', '', 'connecting neural', 'gateway · please wait'];
    }
    if (!scriptData) {
      return ['empty canvas', '', 'enter prompt → press ●', '', 'awaiting transmission'];
    }
    if (!activeShot) {
      return [
        scriptData.title.toLowerCase().slice(0, 22),
        scriptData.scenes.length + ' scenes · ' + totalShots + ' shots',
        '',
        'select a scene →',
      ];
    }
    return [
      `shot ${String(activeShotIdx + 1).padStart(2, '0')}/${String(activeScene?.shots.length ?? 0).padStart(2, '0')}`,
      (activeScene?.location ?? '').toLowerCase().slice(0, 22),
      '',
      `${activeShot.type.toLowerCase()} · ${activeScene?.timeOfDay.toLowerCase()}`,
      activeShot.dialogue ? `"${activeShot.dialogue.slice(0, 22)}"` : '',
    ];
  }, [scriptData, activeScene, activeShot, activeShotIdx, isGenerating, totalShots]);

  return (
    <main className="min-h-screen bg-te-bone font-te text-te-charcoal selection:bg-te-knob-orange/40">
      {/* HEADER */}
      <header className="px-6 pt-5 pb-4 flex items-end justify-between border-b border-te-bone-edge/40">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isGenerating
                ? 'bg-te-knob-red shadow-[0_0_8px_rgba(214,48,49,0.8)] animate-pulse'
                : scriptData
                ? 'bg-te-ok shadow-[0_0_6px_rgba(127,176,105,0.7)]'
                : 'bg-te-charcoal/30'
            }`}
          />
          <h1 className="text-[22px] font-te font-semibold lowercase tracking-tight">
            ai director
          </h1>
          <span className="text-[12px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/45">
            workspace
          </span>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/55">
          <span>proj · {(projectName ?? 'unnamed').toLowerCase()}</span>
          <span>·</span>
          <span>
            {isGenerating
              ? 'generating'
              : tapePlaying
              ? 'playing'
              : scriptData
              ? 'ready'
              : 'idle'}
          </span>
        </div>
      </header>

      {/* BODY */}
      <div className="flex gap-5 px-6 py-5">
        {/* MODE RAIL */}
        <div className="shrink-0">
          <ModeRail modes={MODES as any} activeIndex={mode} onSelect={setMode} />
        </div>

        {/* CENTER */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* HERO STRIP */}
          <Panel title="control surface" meta={MODES[mode].label}>
            <div className="flex items-start justify-between gap-5">
              {/* knobs */}
              <div className="flex gap-6 bg-te-bone-dim rounded-md px-5 py-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                <Knob color="white"  label="style"  sublabel={fmtPct(style)}  value={style}  onChange={setStyle} />
                <Knob color="blue"   label="motion" sublabel={fmtPct(motion)} value={motion} onChange={setMotion} />
                <Knob color="orange" label="lens"   sublabel={fmtPct(lens)}   value={lens}   onChange={setLens} />
                <Knob color="red"    label="mood"   sublabel={fmtPct(mood)}   value={mood}   onChange={setMood} />
              </div>

              {/* lcd: now + spectrum */}
              <div className="flex-1 flex gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <LCD title="now" meta={`mode · ${MODES[mode].label}`} height={104}>
                    <LCDPixelArt rows={lcdNowRows} />
                  </LCD>
                </div>
                <div className="w-[180px] shrink-0">
                  <LCD title="spectrum" meta={isGenerating ? 'live' : 'idle'} height={104}>
                    <LCDBars values={bars} height={62} />
                  </LCD>
                </div>
              </div>

              {/* transport */}
              <div className="flex flex-col gap-1.5 items-center">
                <div className="flex gap-1.5">
                  <Key variant="transport" onClick={() => setActiveShotIdx((i) => Math.max(0, i - 1))} title="prev shot">◀◀</Key>
                  <Key
                    variant="transport"
                    active={tapePlaying}
                    indicator={tapePlaying ? 'pulse' : 'off'}
                    onClick={() => setTapePlaying((p) => !p)}
                    title={tapePlaying ? 'pause' : 'play'}
                  >
                    {tapePlaying ? '❚❚' : '▶'}
                  </Key>
                  <Key variant="transport" onClick={() => { setTapePlaying(false); setTapePos(0); }} title="stop">■</Key>
                  <Key
                    variant="transport"
                    onClick={() => setActiveShotIdx((i) => Math.min((activeScene?.shots.length ?? 1) - 1, i + 1))}
                    title="next shot"
                  >
                    ▶▶
                  </Key>
                </div>
                <Key
                  variant="rec"
                  active={isGenerating}
                  indicator={isGenerating ? 'rec' : 'off'}
                  onClick={handleGenerate}
                  disabled={isGenerating || !userPrompt.trim()}
                  title="generate"
                >
                  ●
                </Key>
              </div>
            </div>
          </Panel>

          {/* MODE CONTENT */}
          <ModeContent
            mode={mode}
            scriptData={scriptData}
            activeSceneId={activeSceneId}
            setActiveSceneId={(id) => { setActiveSceneId(id); setActiveShotIdx(0); }}
            activeShotIdx={activeShotIdx}
            setActiveShotIdx={setActiveShotIdx}
            isGenerating={isGenerating}
          />

          {/* TAPE */}
          <Panel title="timeline · 4-track" meta="mix">
            <Tape playing={tapePlaying} position={tapePos} totalSeconds={totalShots * 4 || 36} />
          </Panel>
        </div>

        {/* COMMANDER */}
        <aside className="w-[320px] shrink-0">
          <Panel title="commander" meta="input">
            <div className="flex flex-col gap-4">
              {/* model preset keys */}
              <div>
                <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                  model
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_MODELS.map((m, i) => (
                    <Key
                      key={m.label}
                      variant="text"
                      active={i === activeModelPreset}
                      onClick={() => setActiveModelPreset(i)}
                    >
                      {m.label}
                    </Key>
                  ))}
                </div>
              </div>

              {/* prompt console */}
              <div>
                <label className="block text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2">
                  prompt
                </label>
                <div className="rounded-md bg-te-charcoal shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] p-3">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    disabled={isGenerating}
                    placeholder="describe scene · style · characters..."
                    className="w-full min-h-[140px] bg-transparent border-none outline-none resize-vertical text-te-lcd-fg font-lcd text-[17px] leading-tight placeholder:text-te-lcd-dim/60 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* api config */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowApiSettings((v) => !v)}
                  className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 hover:text-te-knob-orange transition-colors flex items-center gap-1"
                >
                  [{showApiSettings ? '−' : '+'}] api · advanced
                </button>
                {showApiSettings && (
                  <div className="mt-2 bg-te-bone-dim rounded-md p-3 flex flex-col gap-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                    <ConfigRow label="endpoint">
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setApiConfig({ baseUrl: e.target.value })}
                        className="te-input"
                      />
                    </ConfigRow>
                    <ConfigRow label="model id">
                      <input
                        type="text"
                        value={customModelId}
                        onChange={(e) => setApiConfig({ customModelId: e.target.value })}
                        className="te-input"
                      />
                    </ConfigRow>
                    <ConfigRow label="api key">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiConfig({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="te-input"
                      />
                    </ConfigRow>
                  </div>
                )}
              </div>

              {/* generate big button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !userPrompt.trim()}
                className={`w-full h-12 rounded-md font-te lowercase text-[14px] tracking-[0.18em] transition-all flex items-center justify-center gap-2 select-none
                  ${isGenerating || !userPrompt.trim()
                    ? 'bg-te-bone-dim text-te-charcoal/35 cursor-not-allowed shadow-te-key'
                    : 'bg-te-knob-red text-te-bone shadow-te-key hover:brightness-110 active:translate-y-[1px] active:shadow-te-key-active'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    generating
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    generate
                  </>
                )}
              </button>

              {!apiKey && (
                <div className="text-[11px] font-te-mono uppercase tracking-widest text-te-warn/90 leading-relaxed">
                  ⚠ api key not set · open advanced to configure
                </div>
              )}
            </div>
          </Panel>

          {/* characters mini panel */}
          {scriptData?.characters && scriptData.characters.length > 0 && (
            <div className="mt-4">
              <Panel title="cast" meta={`${scriptData.characters.length}`}>
                <div className="flex flex-col gap-2">
                  {scriptData.characters.map((c) => (
                    <CharacterRow key={c.id} char={c} />
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </aside>
      </div>

      {/* shared input style */}
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
        .te-input::placeholder {
          color: #7A8A4A;
        }
        .te-input:focus {
          box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.5), 0 0 0 1px #E8862A;
        }
      `}</style>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ────────────────────────────────────────────────────────────────────

interface ModeContentProps {
  mode: number;
  scriptData: ScriptEngram | null;
  activeSceneId: string | null;
  setActiveSceneId: (id: string) => void;
  activeShotIdx: number;
  setActiveShotIdx: (i: number) => void;
  isGenerating: boolean;
}

function ModeContent({
  mode,
  scriptData,
  activeSceneId,
  setActiveSceneId,
  activeShotIdx,
  setActiveShotIdx,
  isGenerating,
}: ModeContentProps) {
  const activeScene = scriptData?.scenes?.find((s) => s.sceneId === activeSceneId) ?? null;

  // empty state
  if (!scriptData && !isGenerating) {
    return (
      <Panel title={MODES[mode].label} meta="empty">
        <div className="flex items-center justify-center py-12">
          <LCD width={420} height={140}>
            <LCDPixelArt
              rows={[
                '                          ',
                '   no transmission yet    ',
                '                          ',
                '   ░▒▓ press ● to gen ▓▒░ ',
                '                          ',
              ]}
            />
          </LCD>
        </div>
      </Panel>
    );
  }

  if (isGenerating && !scriptData) {
    return (
      <Panel title={MODES[mode].label} meta="generating">
        <div className="flex items-center justify-center py-12">
          <LCD width={420} height={140}>
            <LCDPixelArt
              rows={[
                '   synthesizing...        ',
                '                          ',
                '   ░▒▓████████████▓▒░     ',
                '   neural gateway · live  ',
                '                          ',
              ]}
            />
          </LCD>
        </div>
      </Panel>
    );
  }

  // T2 script — read-only synopsis
  if (mode === 1) {
    return (
      <Panel title="script" meta="logline">
        <div className="flex flex-col gap-3">
          <div className="text-[18px] font-te lowercase font-semibold text-te-charcoal">
            {scriptData?.title.toLowerCase()}
          </div>
          <div className="text-[14px] font-te italic text-te-charcoal/65 leading-relaxed">
            {scriptData?.logline}
          </div>
          <div className="text-[12px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/50 mt-2">
            {scriptData?.scenes.length} scenes · {scriptData?.scenes.reduce((s, sc) => s + sc.shots.length, 0)} shots
          </div>
        </div>
      </Panel>
    );
  }

  // T4 cast — character bible
  if (mode === 3) {
    return (
      <Panel title="cast" meta={`${scriptData?.characters.length ?? 0} characters`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {scriptData?.characters.map((c) => (
            <CharacterCard key={c.id} char={c} />
          ))}
        </div>
      </Panel>
    );
  }

  // T5 set — scene bible
  if (mode === 4) {
    return (
      <Panel title="set" meta={`${scriptData?.scenes.length ?? 0} scenes`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scriptData?.scenes.map((s) => (
            <button
              key={s.sceneId}
              onClick={() => setActiveSceneId(s.sceneId)}
              className={`text-left rounded-md p-3 transition-all ${
                activeSceneId === s.sceneId
                  ? 'bg-te-charcoal text-te-bone shadow-te-key-active'
                  : 'bg-te-bone-dim shadow-te-key hover:bg-te-bone-deep'
              }`}
            >
              <div className="text-[12px] font-te-mono uppercase tracking-[0.18em] opacity-60">
                {s.sceneId}
              </div>
              <div className="text-[15px] font-te lowercase mt-1">{s.location.toLowerCase()}</div>
              <div className="text-[12px] font-te-mono lowercase opacity-55 mt-1">
                {s.timeOfDay} · {s.shots.length} shots
              </div>
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  // T6 audio / T8 out — coming soon
  if (mode === 5 || mode === 7) {
    return (
      <Panel title={MODES[mode].label} meta="coming soon">
        <div className="flex items-center justify-center py-12">
          <LCD width={360} height={100}>
            <LCDPixelArt
              rows={[
                '                        ',
                `  ${MODES[mode].label.padEnd(8)}  · pending build  `,
                '                        ',
                '  see roadmap · v0.2    ',
              ]}
            />
          </LCD>
        </div>
      </Panel>
    );
  }

  // T1 idea / T3 board / T7 mix — show shot board
  return (
    <Panel
      title="board"
      meta={
        activeScene
          ? `${activeScene.sceneId} · ${activeScene.shots.length} shots`
          : `${scriptData?.scenes.length ?? 0} scenes`
      }
    >
      <div className="flex flex-col gap-4">
        {/* scene selector */}
        {scriptData && scriptData.scenes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scriptData.scenes.map((s) => (
              <Key
                key={s.sceneId}
                variant="text"
                active={s.sceneId === activeSceneId}
                onClick={() => {
                  setActiveSceneId(s.sceneId);
                  setActiveShotIdx(0);
                }}
                sublabel={s.location.toLowerCase().slice(0, 14)}
              >
                {s.sceneId.toLowerCase()}
              </Key>
            ))}
          </div>
        )}

        {/* shot grid */}
        {activeScene && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeScene.shots.map((shot, i) => {
              const status: ShotStatus = i === activeShotIdx ? 'completed' : 'pending';
              return (
                <ShotCard
                  key={shot.shotId}
                  index={i + 1}
                  total={activeScene.shots.length}
                  location={(activeScene.location + ' · ' + shot.type).toLowerCase()}
                  shotType={shot.type.toLowerCase()}
                  duration={`0${(i % 6) + 2}s`}
                  status={status}
                  onPlay={() => setActiveShotIdx(i)}
                />
              );
            })}
          </div>
        )}

        {/* active shot detail */}
        {activeScene && activeScene.shots[activeShotIdx] && (
          <ActiveShotDetail shot={activeScene.shots[activeShotIdx]} sceneLocation={activeScene.location} />
        )}
      </div>
    </Panel>
  );
}

function ActiveShotDetail({ shot, sceneLocation }: { shot: Shot; sceneLocation: string }) {
  return (
    <div className="bg-te-bone-dim rounded-md p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
          {shot.shotId.toLowerCase()} · detail
        </span>
        <span className="text-[11px] font-te-mono uppercase tracking-widest text-te-charcoal/45">
          {shot.type.toLowerCase()} · {sceneLocation.toLowerCase()}
        </span>
      </div>
      <p className="text-[15px] font-te lowercase leading-relaxed text-te-charcoal mb-2">
        {shot.visualDescription}
      </p>
      {shot.dialogue && (
        <div className="border-l-2 border-te-knob-orange/70 pl-2 mb-1">
          <span className="text-[11px] font-te-mono uppercase tracking-widest text-te-charcoal/45">
            dialogue
          </span>
          <p className="text-[14px] font-te italic text-te-charcoal/85">"{shot.dialogue}"</p>
        </div>
      )}
      {shot.action && (
        <div className="text-[12px] font-te-mono uppercase text-te-charcoal/55">
          [action] {shot.action.toLowerCase()}
        </div>
      )}
    </div>
  );
}

function CharacterCard({ char }: { char: Character }) {
  return (
    <div className="bg-te-bone-dim rounded-md p-3 shadow-te-key">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-te lowercase font-semibold">{char.name.toLowerCase()}</div>
        <div className="w-1.5 h-1.5 rounded-full bg-te-knob-blue" />
      </div>
      <div className="text-[11px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/55 mb-2">
        {char.role.toLowerCase()}
      </div>
      <div className="text-[13px] font-te lowercase text-te-charcoal/75 leading-snug">
        {char.appearance}
      </div>
    </div>
  );
}

function CharacterRow({ char }: { char: Character }) {
  return (
    <div className="bg-te-bone-dim rounded-md px-3 py-2 shadow-te-key">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-te lowercase font-semibold">{char.name.toLowerCase()}</span>
        <span className="text-[10px] font-te-mono uppercase tracking-widest text-te-charcoal/50">
          {char.role.toLowerCase()}
        </span>
      </div>
      <div className="text-[12px] font-te lowercase text-te-charcoal/65 mt-0.5 line-clamp-2">
        {char.appearance}
      </div>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55">
        {label}
      </span>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// utils
// ────────────────────────────────────────────────────────────────────
function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
