import { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'recessed' | 'flat';
}

export function Panel({
  title,
  meta,
  children,
  className = '',
  variant = 'default',
}: PanelProps) {
  const variantClass = {
    default: 'bg-te-bone shadow-te-panel',
    recessed: 'bg-te-bone-deep shadow-[inset_0_2px_6px_rgba(0,0,0,0.15)]',
    flat: 'bg-te-bone-dim',
  }[variant];

  return (
    <section
      className={`rounded-lg overflow-hidden ${variantClass} ${className}`}
    >
      {(title || meta) && (
        <header className="flex items-center justify-between px-4 py-2 border-b border-te-bone-edge/40">
          <span className="text-[9px] font-te-mono uppercase tracking-[0.18em] text-te-charcoal/65">
            {title}
          </span>
          {meta && (
            <span className="text-[9px] font-te-mono uppercase tracking-widest text-te-charcoal/40">
              {meta}
            </span>
          )}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

interface DividerProps {
  className?: string;
}

export function Divider({ className = '' }: DividerProps) {
  return (
    <div
      className={`h-px w-full bg-te-bone-edge/50 ${className}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.5)' }}
    />
  );
}
