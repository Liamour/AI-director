import { useEffect, useState } from 'react';
import {
  Knob,
  Key,
  LCD,
  LCDPixelArt,
  LCDBars,
  ModeRail,
  Panel,
  Divider,
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
];

const SHOTS: { location: string; type: string; status: ShotStatus; duration: string }[] = [
  { location: 'neon alley · pov', type: 'wide', status: 'completed', duration: '04s' },
  { location: 'rain reflection', type: 'close', status: 'completed', duration: '03s' },
  { location: 'protagonist mid', type: 'medium', status: 'generating', duration: '05s' },
  { location: 'shadow figure', type: 'pov', status: 'pending', duration: '06s' },
  { location: 'rooftop drone', type: 'aerial', status: 'pending', duration: '08s' },
  { location: 'eye macro', type: 'extreme close', status: 'pending', duration: '02s' },
];

export default function TELab() {
  // knob values
  const [style, setStyle] = useState(0.62);
  const [motion, setMotion] = useState(0.4);
  const [lens, setLens] = useState(0.7);
  const [mood, setMood] = useState(0.85);

  // mode + transport
  const [mode, setMode] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeShot, setActiveShot] = useState(2);

  // tape position auto-advance when playing
  const [tapePos, setTapePos] = useState(0.35);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTapePos((p) => (p >= 1 ? 0 : p + 0.005));
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  // animated LCD bars
  const [bars, setBars] = useState<number[]>(
    Array.from({ length: 32 }, () => Math.random())
  );
  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) =>
        prev.map((v, i) => {
          const target = playing
            ? Math.random() * (0.4 + mood * 0.6)
            : Math.max(0.05, v * 0.85);
          return v + (target - v) * 0.4;
        })
      );
    }, 80);
    return () => clearInterval(id);
  }, [playing, mood]);

  return (
    <main className="min-h-screen bg-te-bone font-te text-te-charcoal">
      {/* HEADER */}
      <header className="px-8 pt-6 pb-4 flex items-end justify-between border-b border-te-bone-edge/40">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-te-knob-red shadow-[0_0_8px_rgba(214,48,49,0.7)]" />
            <h1 className="text-[22px] font-te font-semibold lowercase tracking-tight">
              ai director · te lab
            </h1>
          </div>
          <p className="mt-1 text-[10px] font-te-mono uppercase tracking-[0.22em] text-te-charcoal/55">
            design language sandbox · v0.1
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-te-mono uppercase tracking-widest text-te-charcoal/55">
          <span>proj_neon01</span>
          <span>·</span>
          <span>{playing ? 'playing' : recording ? 'recording' : 'idle'}</span>
        </div>
      </header>

      {/* HERO PANEL — composite of everything (the killer demo) */}
      <section className="px-8 py-6">
        <Panel title="workspace · composite preview" meta="all components">
          <div className="flex gap-5">
            {/* mode rail */}
            <ModeRail
              modes={MODES}
              activeIndex={mode}
              onSelect={setMode}
            />

            {/* center column */}
            <div className="flex-1 flex flex-col gap-4">
              {/* knobs row */}
              <div className="flex items-start justify-between bg-te-bone-dim rounded-lg px-5 py-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
                <div className="flex gap-7">
                  <Knob color="white" label="style" sublabel={fmtPct(style)} value={style} onChange={setStyle} />
                  <Knob color="blue" label="motion" sublabel={fmtPct(motion)} value={motion} onChange={setMotion} />
                  <Knob color="orange" label="lens" sublabel={fmtPct(lens)} value={lens} onChange={setLens} />
                  <Knob color="red" label="mood" sublabel={fmtPct(mood)} value={mood} onChange={setMood} />
                </div>

                {/* transport */}
                <div className="flex gap-1.5 items-center">
                  <Key variant="transport" title="rewind">◀◀</Key>
                  <Key
                    variant="transport"
                    active={playing}
                    onClick={() => setPlaying((p) => !p)}
                    indicator={playing ? 'pulse' : 'off'}
                    title={playing ? 'pause' : 'play'}
                  >
                    {playing ? '❚❚' : '▶'}
                  </Key>
                  <Key variant="transport" title="stop" onClick={() => { setPlaying(false); setTapePos(0); }}>
                    ■
                  </Key>
                  <Key variant="transport" title="forward">▶▶</Key>
                  <Key
                    variant="rec"
                    active={recording}
                    indicator={recording ? 'rec' : 'off'}
                    onClick={() => setRecording((r) => !r)}
                    title="generate / record"
                  >
                    ●
                  </Key>
                </div>
              </div>

              {/* LCD strip */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <LCD title="now" meta={`mode · ${MODES[mode].label}`} height={120}>
                    <LCDPixelArt
                      rows={[
                        `shot ${String(activeShot + 1).padStart(2, '0')} / ${String(SHOTS.length).padStart(2, '0')}`,
                        SHOTS[activeShot]?.location ?? '—',
                        '',
                        `${SHOTS[activeShot]?.type} · ${SHOTS[activeShot]?.duration} · 9:16`,
                        SHOTS[activeShot]?.status === 'generating'
                          ? 'synthesizing ░▒▓██'
                          : SHOTS[activeShot]?.status === 'completed'
                          ? 'ready ████████▓▒'
                          : 'queued ░░░░░░░░',
                      ]}
                    />
                  </LCD>
                </div>
                <div className="w-[280px]">
                  <LCD title="spectrum" meta={playing ? 'live' : 'idle'} height={120}>
                    <LCDBars values={bars} height={70} />
                  </LCD>
                </div>
              </div>

              {/* shot strip — 16 numbered keys */}
              <div className="bg-te-bone-dim rounded-lg p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
                <div className="text-[9px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/55 mb-2 px-1">
                  shot keys · 1–16
                </div>
                <div className="grid grid-cols-16 gap-1.5" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
                  {Array.from({ length: 16 }).map((_, i) => {
                    const shot = SHOTS[i];
                    const ind: 'on' | 'pulse' | 'off' = shot
                      ? shot.status === 'generating'
                        ? 'pulse'
                        : shot.status === 'completed'
                        ? 'on'
                        : 'off'
                      : 'off';
                    return (
                      <Key
                        key={i}
                        variant="numbered"
                        active={i === activeShot}
                        indicator={ind}
                        onClick={() => i < SHOTS.length && setActiveShot(i)}
                        disabled={!shot}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Key>
                    );
                  })}
                </div>
              </div>

              {/* tape */}
              <Tape playing={playing} position={tapePos} />
            </div>
          </div>
        </Panel>
      </section>

      <Divider />

      {/* COMPONENT GALLERY */}
      <section className="px-8 py-6 grid grid-cols-12 gap-5">
        {/* knobs */}
        <div className="col-span-4">
          <Panel title="knobs" meta="drag · scroll · ↑↓">
            <div className="flex justify-around items-center py-2">
              <Knob label="style"  value={style}  onChange={setStyle}  sublabel={fmtPct(style)} />
              <Knob label="motion" value={motion} onChange={setMotion} sublabel={fmtPct(motion)} color="blue" />
              <Knob label="lens"   value={lens}   onChange={setLens}   sublabel={fmtPct(lens)} color="orange" />
              <Knob label="mood"   value={mood}   onChange={setMood}   sublabel={fmtPct(mood)} color="red" />
            </div>
          </Panel>
        </div>

        {/* keys */}
        <div className="col-span-4">
          <Panel title="keys" meta="variants">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Key variant="text">shift</Key>
                <Key variant="text">option</Key>
                <Key variant="text" active>active</Key>
                <Key variant="text" disabled>disabled</Key>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <Key key={n} variant="numbered" indicator={n === 3 ? 'pulse' : n < 3 ? 'on' : 'off'}>
                    {String(n).padStart(2, '0')}
                  </Key>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Key variant="transport">◀◀</Key>
                <Key variant="transport">▶</Key>
                <Key variant="transport">■</Key>
                <Key variant="transport">▶▶</Key>
                <Key variant="rec" indicator="rec">●</Key>
              </div>
            </div>
          </Panel>
        </div>

        {/* lcd variants */}
        <div className="col-span-4">
          <Panel title="lcd" meta="pixel · bars · text">
            <div className="flex flex-col gap-2">
              <LCD title="pixel" meta="art" height={70}>
                <LCDPixelArt
                  rows={[
                    '  ░▒▓████▓▒░  ',
                    ' ░▒▓██████▓▒░ ',
                    '  ░▒▓████▓▒░  ',
                  ]}
                />
              </LCD>
              <LCD title="bars" height={56}>
                <LCDBars values={bars.slice(0, 18)} height={32} />
              </LCD>
              <LCD title="text" height={56}>
                <div className="font-lcd text-[16px] leading-tight">
                  ready · 12 shots queued
                  <br />
                  press ● to generate
                </div>
              </LCD>
            </div>
          </Panel>
        </div>

        {/* shot cards row */}
        <div className="col-span-12">
          <Panel title="shot cards" meta={`${SHOTS.length} shots`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {SHOTS.map((s, i) => (
                <ShotCard
                  key={i}
                  index={i + 1}
                  total={SHOTS.length}
                  location={s.location}
                  shotType={s.type}
                  duration={s.duration}
                  status={s.status}
                  onPlay={() => setActiveShot(i)}
                />
              ))}
            </div>
          </Panel>
        </div>

        {/* footer notes */}
        <div className="col-span-12">
          <Panel title="design notes" variant="recessed">
            <ul className="text-[11px] font-te leading-relaxed text-te-charcoal/75 space-y-1 list-disc pl-4">
              <li>typeface · inter (ui) + jetbrains mono (technical) + vt323 (lcd). all-lowercase by convention.</li>
              <li>color · 4 functional knobs (style/motion/lens/mood) — never decorative. red is reserved for record/destructive.</li>
              <li>grid · 8px modular. all paddings, gaps, sizes derive from this.</li>
              <li>density · low. white space is cheap; clarity is expensive.</li>
              <li>interaction · knobs accept drag, wheel, and arrow keys. keys depress on active state. tape reels spin only when playing.</li>
            </ul>
          </Panel>
        </div>
      </section>

      <footer className="px-8 py-4 border-t border-te-bone-edge/40 flex items-center justify-between text-[9px] font-te-mono uppercase tracking-[0.22em] text-te-charcoal/45">
        <span>te-lab · src/pages/te-lab.tsx</span>
        <span>navigate / and /workspace for the live app</span>
      </footer>
    </main>
  );
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
