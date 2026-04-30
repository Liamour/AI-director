interface ModeTabProps {
  index: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function ModeTab({ index, label, active, onClick }: ModeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full h-14 rounded-md flex flex-col items-center justify-center gap-0.5 transition-all duration-75 select-none
        ${active
          ? 'bg-te-charcoal text-te-bone shadow-te-key-active translate-y-[1px]'
          : 'bg-te-bone-dim text-te-charcoal shadow-te-key hover:bg-te-bone-deep active:translate-y-[1px]'}`}
    >
      <span
        className={`text-[8px] font-te-mono tracking-widest ${
          active ? 'text-te-knob-orange' : 'text-te-charcoal/40'
        }`}
      >
        T{index}
      </span>
      <span className="text-[10px] font-te lowercase leading-none">{label}</span>
    </button>
  );
}

interface ModeRailProps {
  modes: { label: string }[];
  activeIndex: number;
  onSelect: (i: number) => void;
}

export function ModeRail({ modes, activeIndex, onSelect }: ModeRailProps) {
  return (
    <div className="flex flex-col gap-1.5 w-20">
      {modes.map((m, i) => (
        <ModeTab
          key={i}
          index={i + 1}
          label={m.label}
          active={i === activeIndex}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
