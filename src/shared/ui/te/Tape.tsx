interface Track {
  label: string;
  color: string;
  data: number[];
}

interface TapeProps {
  tracks?: Track[];
  playing?: boolean;
  position?: number;
  totalSeconds?: number;
}

const DEFAULT_TRACKS: Track[] = [
  { label: 'vid', color: '#E8862A', data: [1, 1, 0.95, 0.85, 1, 1, 0.65, 1, 1, 0.9, 1, 0.95] },
  { label: 'dlg', color: '#2D5BA8', data: [0.2, 0.35, 0.45, 0.25, 0.05, 0.55, 0.7, 0.55, 0.35, 0.05, 0.25, 0.45] },
  { label: 'mus', color: '#7FB069', data: [0.3, 0.4, 0.5, 0.6, 0.7, 0.7, 0.85, 0.85, 0.7, 0.6, 0.5, 0.4] },
  { label: 'sfx', color: '#D63031', data: [0.05, 0.85, 0.05, 0.6, 0.05, 0.05, 0.95, 0.05, 0.55, 0.05, 0.05, 0.75] },
];

export function Tape({
  tracks = DEFAULT_TRACKS,
  playing = false,
  position = 0.35,
  totalSeconds = 36,
}: TapeProps) {
  const currentSec = position * totalSeconds;

  return (
    <div className="bg-te-bone-deep rounded-lg p-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)]">
      {/* reels + label */}
      <div className="flex items-center gap-4 mb-3">
        <Reel playing={playing} />
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-te-mono uppercase tracking-[0.2em] text-te-charcoal/60">
              tape · 4-track sequencer
            </span>
            <span className="font-lcd text-[16px] text-te-charcoal/70">
              {formatTime(currentSec)} / {formatTime(totalSeconds)}
            </span>
          </div>
          {/* progress strip */}
          <div className="mt-1 h-[3px] bg-te-charcoal/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-te-knob-orange rounded-full transition-[width] duration-150"
              style={{ width: `${position * 100}%` }}
            />
          </div>
        </div>
        <Reel playing={playing} reverse />
      </div>

      {/* track display */}
      <div className="bg-te-charcoal rounded-md p-2.5 space-y-1 relative overflow-hidden">
        {/* playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)] z-10 pointer-events-none"
          style={{ left: `calc(${2.5 + position * 95}%)` }}
        />
        {tracks.map((track, ti) => (
          <div key={ti} className="flex items-center gap-2">
            <div className="w-7 text-[11px] font-te-mono uppercase text-te-bone/50">
              {track.label}
            </div>
            <div className="flex-1 flex h-5 gap-[1px] items-center">
              {track.data.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    height: `${Math.max(15, v * 100)}%`,
                    background: track.color,
                    opacity: 0.35 + v * 0.55,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReelProps {
  playing?: boolean;
  reverse?: boolean;
}

function Reel({ playing, reverse }: ReelProps) {
  return (
    <div className="relative w-12 h-12 shrink-0">
      <div
        className="absolute inset-0 rounded-full bg-te-charcoal"
        style={{ boxShadow: 'inset 0 0 0 2px #444, inset 0 2px 4px rgba(0,0,0,0.6)' }}
      />
      <div
        className="absolute inset-1.5 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #2a2a2a 0deg, #555 22deg, #2a2a2a 45deg, #555 67deg, #2a2a2a 90deg, #555 112deg, #2a2a2a 135deg, #555 157deg, #2a2a2a 180deg, #555 202deg, #2a2a2a 225deg, #555 247deg, #2a2a2a 270deg, #555 292deg, #2a2a2a 315deg, #555 337deg, #2a2a2a 360deg)',
          animation: playing
            ? `te-spin 2.4s linear infinite ${reverse ? 'reverse' : ''}`
            : undefined,
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-te-bone rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
      <style jsx>{`
        @keyframes te-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
