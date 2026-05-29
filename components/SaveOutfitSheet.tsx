'use client';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { OutfitCollage } from './OutfitCollage';
import { PremiumButton } from './Primitives';
import {
  OCCASIONS_SOCIAL, VISIBILITY_OPTIONS,
  type OccasionKey, type Visibility, type Outfit,
} from '@/lib/social-types';

export interface SaveOutfitMeta {
  title: string;
  caption: string;
  occasion?: OccasionKey;
  visibility: Visibility;
  scheduledDate?: string;
  storyEnabled: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SaveOutfitSheet({
  open,
  onClose,
  draft,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  draft: Pick<Outfit, 'layout' | 'background' | 'itemIds'>;
  initial?: Partial<SaveOutfitMeta>;
  onSave: (meta: SaveOutfitMeta) => void;
}) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [occasion, setOccasion] = useState<OccasionKey | undefined>(undefined);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [storyEnabled, setStoryEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setCaption(initial?.caption ?? '');
      setOccasion(initial?.occasion);
      setVisibility(initial?.visibility ?? 'public');
      setScheduledDate(initial?.scheduledDate ?? '');
      setStoryEnabled(initial?.storyEnabled ?? false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSave() {
    onSave({
      title: title.trim() || 'My outfit',
      caption: caption.trim(),
      occasion,
      visibility,
      scheduledDate: scheduledDate || undefined,
      storyEnabled,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Save your look"
      footer={
        <PremiumButton fullWidth size="lg" onClick={handleSave} icon={<Sparkles size={18} />}>
          {storyEnabled ? 'Save & post to story' : 'Save outfit'}
        </PremiumButton>
      }
    >
      <div className="flex gap-3 mb-4">
        <OutfitCollage outfit={draft} className="w-24 h-32 shrink-0" rounded="rounded-2xl" />
        <div className="flex-1 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Outfit name"
            className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-hairline text-sm font-semibold text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-sm text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2 resize-none"
          />
        </div>
      </div>

      <Field label="Occasion">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {OCCASIONS_SOCIAL.map((o) => (
            <button
              key={o.key}
              onClick={() => setOccasion(occasion === o.key ? undefined : o.key)}
              className={`shrink-0 px-3 h-9 rounded-full text-[13px] font-medium border transition-colors ${
                occasion === o.key ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-muted-2 border-hairline'
              }`}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Schedule (planner)">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl bg-surface-2 border border-hairline text-sm text-ink focus:outline-none focus:border-hairline-2"
          />
          <button
            onClick={() => setScheduledDate(todayISO())}
            className="h-10 px-3 rounded-xl bg-surface-2 border border-hairline text-sm font-medium text-ink-soft"
          >
            Today
          </button>
          {scheduledDate && (
            <button onClick={() => setScheduledDate('')} className="h-10 px-3 text-sm text-muted">
              Clear
            </button>
          )}
        </div>
      </Field>

      <Field label="Visibility">
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map((v) => (
            <button
              key={v.value}
              onClick={() => setVisibility(v.value)}
              className={`p-2.5 rounded-xl border text-left transition-colors ${
                visibility === v.value ? 'bg-accent-soft border-accent' : 'bg-surface-1 border-hairline'
              }`}
            >
              <div className={`text-[13px] font-semibold ${visibility === v.value ? 'text-accent' : 'text-ink'}`}>{v.label}</div>
              <div className="text-[10px] text-muted leading-tight mt-0.5">{v.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <button
        onClick={() => setStoryEnabled((s) => !s)}
        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 border border-hairline"
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-ink">Add to OOTD story</div>
          <div className="text-[11px] text-muted">Share as a 24h story on your profile</div>
        </div>
        <div className={`relative w-12 h-7 rounded-full transition-colors ${storyEnabled ? 'bg-ink' : 'bg-surface-3'}`}>
          <div
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${storyEnabled ? 'left-[22px]' : 'left-0.5'}`}
          />
        </div>
      </button>
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-2xs uppercase tracking-editorial text-muted mb-2">{label}</div>
      {children}
    </div>
  );
}
