import { Bookmark, Sparkles } from 'lucide-react';

interface BuilderHeaderProps {
  itemCount: number;
  totalAmount: number;
  onSave: () => void;
}

export function BuilderHeader({ itemCount, totalAmount, onSave }: BuilderHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-serif font-bold text-xl tracking-tight">sylistly</span>
      </div>
      <div className="flex items-center gap-3">
        {itemCount > 0 && (
          <span className="font-serif text-lg text-emerald font-semibold">${(totalAmount / 100).toFixed(0)}</span>
        )}
        <button
          onClick={onSave}
          disabled={itemCount === 0}
          className={`p-2.5 rounded-full border transition-all ${
            itemCount > 0
              ? 'border-accent text-accent hover:bg-accent hover:text-white shadow-sm'
              : 'border-hairline text-muted'
          }`}
        >
          <Bookmark size={18} />
        </button>
      </div>
    </header>
  );
}
