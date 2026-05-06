import { LCD, LCDPixelArt } from './LCD';
import { Key } from './Key';

export type ShotStatus = 'pending' | 'generating' | 'completed';

interface ShotCardProps {
  index: number;
  total?: number;
  location: string;
  shotType: string;
  duration?: string;
  aspectRatio?: string;
  status?: ShotStatus;
  pixelArt?: string[];
  onPlay?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

const DEFAULT_ART: Record<ShotStatus, string[]> = {
  pending: [
    '                  ',
    '   . . . . . .    ',
    '  . . . . . . .   ',
    '   . . . . . .    ',
    '                  ',
  ],
  generating: [
    '   ░▒▒▒░          ',
    '  ░▒▓▓▓▒░  ░▒░    ',
    ' ▒▓███▓▒░▒▓███▒   ',
    '  ░▒▓▓▓▒░  ░▒░    ',
    '   ░▒▒▒░          ',
  ],
  completed: [
    '  ░▒▓██████▓▒░    ',
    ' ░▒▓████████▓▒    ',
    ' ▒▓██▓▒░░▒▓██▓    ',
    '░▒▓████████▓▒░    ',
    ' ░▒▓██████▓▒      ',
  ],
};

const STATUS_COLOR: Record<ShotStatus, string> = {
  pending: 'bg-te-charcoal/20',
  generating: 'bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)] animate-pulse',
  completed: 'bg-te-ok shadow-[0_0_4px_rgba(127,176,105,0.7)]',
};

export function ShotCard({
  index,
  total,
  location,
  shotType,
  duration = '04s',
  aspectRatio = '9:16',
  status = 'pending',
  pixelArt,
  onPlay,
  onRegenerate,
  onDelete,
}: ShotCardProps) {
  const indexStr = String(index).padStart(2, '0');
  return (
    <div className="bg-te-bone rounded-lg shadow-te-panel overflow-hidden flex flex-col">
      {/* header strip */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-te-bone-dim border-b border-te-bone-edge/40">
        <span className="text-[11px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/60">
          shot {indexStr}{total ? `/${String(total).padStart(2, '0')}` : ''}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[status]}`} />
      </div>

      {/* LCD preview */}
      <div className="px-3 pt-3">
        <LCD height={104}>
          <LCDPixelArt rows={pixelArt ?? DEFAULT_ART[status]} />
        </LCD>
      </div>

      {/* meta */}
      <div className="px-3 pt-2 pb-1 flex flex-col gap-0.5">
        <div className="text-[13px] font-te lowercase text-te-charcoal leading-tight">
          {location}
        </div>
        <div className="text-[11px] font-te-mono uppercase tracking-widest text-te-charcoal/55">
          {shotType} · {duration} · {aspectRatio}
        </div>
      </div>

      {/* actions */}
      <div className="px-3 py-2 flex gap-1">
        <Key variant="text" onClick={onPlay} className="flex-1">
          ▶ play
        </Key>
        <Key variant="text" onClick={onRegenerate} className="flex-1">
          ↻ regen
        </Key>
        <Key variant="text" onClick={onDelete}>
          ⌫
        </Key>
      </div>
    </div>
  );
}
