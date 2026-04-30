import { useCallback, useRef, useState } from 'react';

// kept for back-compat — now controls only the accent dot beside the label
export type KnobColor = 'white' | 'blue' | 'orange' | 'red';

const KNOB_BODY = '#FAFAF7';   // uniform polymer white
const TICK_COLOR = '#1A1A1A';  // uniform charcoal tick

const ACCENT_DOT: Record<KnobColor, string | null> = {
  white: null,           // no dot — pure neutral
  blue: '#2D5BA8',
  orange: '#E8862A',
  red: '#D63031',
};

interface KnobProps {
  color?: KnobColor;
  label?: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  size?: number;
  min?: number;
  max?: number;
}

export function Knob({
  color = 'white',
  label,
  sublabel,
  value,
  onChange,
  size = 56,
  min = 0,
  max = 1,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const norm = (value - min) / (max - min);
  const angle = -135 + norm * 270;
  const dot = ACCENT_DOT[color];

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      startVal.current = value;
      setDragging(true);
    },
    [value]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dy = startY.current - e.clientY;
      const range = max - min;
      const next = clamp(startVal.current + (dy / 200) * range);
      onChange(next);
    },
    [dragging, onChange, min, max]
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta = (-e.deltaY / 1000) * (max - min);
      onChange(clamp(value + delta));
    },
    [value, onChange, min, max]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = (max - min) * 0.05;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        onChange(clamp(value + step));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        onChange(clamp(value - step));
      }
    },
    [value, onChange, min, max]
  );

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className={`relative rounded-full shadow-te-knob outline-none focus:ring-2 focus:ring-te-charcoal/30 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          width: size,
          height: size,
          background: KNOB_BODY,
        }}
      >
        {/* glossy highlight (does not rotate) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.7), transparent 55%)',
          }}
        />
        {/* outer ring */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }}
        />
        {/* tick mark layer (rotates) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: dragging ? 'none' : 'transform 80ms ease-out',
          }}
        >
          <div
            className="absolute rounded-[1px]"
            style={{
              top: 5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2.5,
              height: size * 0.22,
              background: TICK_COLOR,
            }}
          />
        </div>
      </div>
      {label && (
        <div className="flex items-center gap-1.5">
          {dot && (
            <span
              className="w-1 h-1 rounded-full shrink-0"
              style={{ background: dot }}
              aria-hidden
            />
          )}
          <span className="text-[9px] font-te-mono uppercase tracking-[0.15em] text-te-charcoal/70">
            {label}
          </span>
        </div>
      )}
      {sublabel && (
        <div className="text-[9px] font-te-mono lowercase text-te-charcoal/50">
          {sublabel}
        </div>
      )}
    </div>
  );
}
