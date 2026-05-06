import { ReactNode } from 'react';

interface LCDProps {
  width?: number | string;
  height?: number | string;
  title?: string;
  meta?: string;
  children?: ReactNode;
  className?: string;
  glow?: boolean;
}

export function LCD({
  width = '100%',
  height = 96,
  title,
  meta,
  children,
  className = '',
  glow = true,
}: LCDProps) {
  return (
    <div
      className={`relative rounded-md overflow-hidden bg-te-lcd-bg shadow-te-lcd ${className}`}
      style={{ width, height }}
    >
      {/* scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.6) 2px, rgba(0,0,0,0.6) 3px)',
        }}
      />
      {/* CRT glow */}
      {glow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      )}
      {/* header strip */}
      {(title || meta) && (
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-2 py-1 text-[12px] font-lcd uppercase tracking-[0.15em] text-te-lcd-fg/60">
          <span>{title}</span>
          <span>{meta}</span>
        </div>
      )}
      <div
        className="relative h-full font-lcd text-te-lcd-fg leading-tight"
        style={{ paddingTop: title || meta ? 22 : 8, paddingLeft: 10, paddingRight: 10, paddingBottom: 8 }}
      >
        {children}
      </div>
    </div>
  );
}

interface LCDPixelArtProps {
  rows: string[];
  scale?: number;
}

export function LCDPixelArt({ rows, scale = 1 }: LCDPixelArtProps) {
  return (
    <pre
      className="font-lcd text-te-lcd-fg leading-[0.95] m-0 p-0"
      style={{ fontSize: 14 * scale, letterSpacing: 0 }}
    >
      {rows.join('\n')}
    </pre>
  );
}

interface LCDBarsProps {
  values: number[];
  height?: number;
  color?: string;
}

export function LCDBars({ values, height = 36, color }: LCDBarsProps) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(6, Math.min(100, v * 100))}%`,
            background: color ?? '#B8C77A',
            opacity: 0.5 + v * 0.5,
          }}
        />
      ))}
    </div>
  );
}
