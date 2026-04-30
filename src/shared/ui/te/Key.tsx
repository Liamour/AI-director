import { ReactNode } from 'react';

export type KeyVariant = 'text' | 'numbered' | 'transport' | 'rec' | 'wide';
export type KeyIndicator = 'off' | 'on' | 'pulse' | 'rec';

interface KeyProps {
  variant?: KeyVariant;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  indicator?: KeyIndicator;
  sublabel?: string;
  className?: string;
  title?: string;
}

const VARIANT_SIZE: Record<KeyVariant, string> = {
  text: 'h-9 px-3 min-w-[2.5rem] text-[10px]',
  numbered: 'h-11 w-9 text-[11px]',
  transport: 'h-10 w-12 text-base',
  rec: 'h-10 w-10 text-base',
  wide: 'h-9 px-5 min-w-[5rem] text-[10px]',
};

const INDICATOR_BG: Record<KeyIndicator, string> = {
  off: 'bg-te-charcoal/15',
  on: 'bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)]',
  pulse: 'bg-te-knob-orange shadow-[0_0_4px_rgba(232,134,42,0.8)] animate-pulse',
  rec: 'bg-te-knob-red shadow-[0_0_6px_rgba(214,48,49,0.9)]',
};

export function Key({
  variant = 'text',
  active = false,
  disabled = false,
  onClick,
  onPointerDown,
  children,
  width,
  height,
  indicator,
  sublabel,
  className = '',
  title,
}: KeyProps) {
  const base =
    'relative font-te lowercase tracking-tight inline-flex flex-col items-center justify-center transition-[transform,box-shadow,background] duration-75 select-none rounded-md';
  const colorClasses = active
    ? 'bg-te-charcoal text-te-bone shadow-te-key-active translate-y-[1px]'
    : 'bg-te-bone-dim text-te-charcoal shadow-te-key hover:bg-te-bone-deep active:translate-y-[1px] active:shadow-te-key-active';
  const recVariant =
    variant === 'rec'
      ? active
        ? 'bg-te-knob-red text-te-bone shadow-te-key-active'
        : 'bg-te-bone-dim text-te-knob-red shadow-te-key hover:bg-te-bone-deep'
      : '';
  const disabledClasses = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      title={title}
      style={{ width, height }}
      className={`${base} ${VARIANT_SIZE[variant]} ${recVariant || colorClasses} ${disabledClasses} ${className}`}
    >
      {indicator && (
        <span
          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${INDICATOR_BG[indicator]}`}
        />
      )}
      <span className="leading-none">{children}</span>
      {sublabel && (
        <span className="mt-0.5 text-[8px] font-te-mono opacity-60 leading-none">
          {sublabel}
        </span>
      )}
    </button>
  );
}
