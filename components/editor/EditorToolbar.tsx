'use client';
import { Wand2, FlipHorizontal2, ArrowUp, ArrowDown } from 'lucide-react';
import { LAYOUT_PRESETS } from '@/lib/outfit-layout';
import { CANVAS_BACKGROUNDS, type LayoutPreset } from '@/lib/social-types';

export function EditorToolbar({
  background,
  onBackground,
  onAutoArrange,
  selectedId,
  onFlip,
  onLayer,
}: {
  background: string;
  onBackground: (key: string) => void;
  onAutoArrange: (preset: LayoutPreset) => void;
  selectedId: string | null;
  onFlip: () => void;
  onLayer: (dir: 'up' | 'down') => void;
}) {
  return (
    <div className="space-y-2.5">
      {selectedId && (
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-editorial text-muted mr-1">Selected</span>
          <ToolBtn onClick={onFlip} icon={<FlipHorizontal2 size={16} />} label="Flip" />
          <ToolBtn onClick={() => onLayer('up')} icon={<ArrowUp size={16} />} label="Forward" />
          <ToolBtn onClick={() => onLayer('down')} icon={<ArrowDown size={16} />} label="Back" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Wand2 size={15} className="text-ink-soft shrink-0" />
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {LAYOUT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onAutoArrange(p.id)}
              className="shrink-0 px-3 h-9 rounded-full bg-surface-2 border border-hairline text-[13px] font-medium text-ink-soft active:bg-surface-3"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {CANVAS_BACKGROUNDS.map((b) => (
            <button
              key={b.key}
              onClick={() => onBackground(b.key)}
              aria-label={b.label}
              className={`shrink-0 w-9 h-9 rounded-full border-2 ${background === b.key ? 'border-ink' : 'border-hairline'}`}
              style={{ background: b.css }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-surface-2 border border-hairline text-[13px] font-medium text-ink-soft active:bg-surface-3"
    >
      {icon}
      {label}
    </button>
  );
}
