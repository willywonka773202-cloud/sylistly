'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Star, Heart, Bookmark, Info, Wand2, RotateCcw, Sparkles } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { SwipeCard, type SwipeAction } from '@/components/SwipeCard';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState, PremiumButton } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import { publicOutfits } from '@/lib/data';
import { getCreator } from '@/lib/data/creators';
import { resolveItem } from '@/lib/item-registry';
import { rankOutfits, dnaInsights } from '@/lib/recommend';
import { aestheticLabel, occasionLabel } from '@/lib/style';
import type { Outfit } from '@/lib/social-types';
import { useStyleDNA } from '@/store/style-dna';
import { useOutfits } from '@/store/outfits';
import { useMounted } from '@/lib/use-mounted';

function reasonsFor(outfit: Outfit): string[] {
  const r: string[] = [];
  if (outfit.occasion) r.push(occasionLabel(outfit.occasion));
  outfit.aesthetics.slice(0, 2).forEach((a) => r.push(aestheticLabel(a)));
  return r;
}

export default function SwipePage() {
  const router = useRouter();
  const mounted = useMounted();
  const dna = useStyleDNA((s) => s.dna);
  const swipe = useStyleDNA((s) => s.swipe);
  const reset = useStyleDNA((s) => s.reset);
  const toggleSaveOutfit = useOutfits((s) => s.toggleSaveOutfit);

  const [force, setForce] = useState<SwipeAction | null>(null);
  const [showItems, setShowItems] = useState(false);

  const all = useMemo(() => publicOutfits(), []);
  const deck = useMemo(() => rankOutfits(all, dna).filter((o) => !dna.seen.includes(o.id)), [all, dna]);
  const insights = dnaInsights(dna);
  const top = deck[0];

  function onSwipe(outfit: Outfit, action: SwipeAction) {
    setForce(null);
    swipe(outfit, action);
    if (action === 'superlike') {
      toggleSaveOutfit(outfit.id);
      successToast('Superliked & saved ⭐');
    }
  }

  function fly(action: SwipeAction) {
    if (top) setForce(action);
  }

  return (
    <AppShell
      header={
        <AppHeader
          title="Swipe"
          kicker="Train your Style DNA"
          right={
            <button onClick={() => reset()} className="grid place-items-center w-10 h-10 rounded-full bg-surface-1 border border-hairline text-ink btn-press" aria-label="Reset">
              <RotateCcw size={17} />
            </button>
          }
        />
      }
    >
      {/* DNA insight strip */}
      <div className="px-5 pt-2">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-1 border border-hairline p-3">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-accent-soft text-accent shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink truncate">
              {mounted ? insights.messages[0] : 'Swipe to begin'}
            </div>
            <div className="h-1.5 mt-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${Math.max(6, (mounted ? insights.progress : 0) * 100)}%` }} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-lg text-ink leading-none">{mounted ? insights.swipes : 0}</div>
            <div className="text-2xs text-muted">swipes</div>
          </div>
        </div>
      </div>

      {/* deck */}
      <div className="px-5 mt-4">
        <div className="relative w-full mx-auto aspect-[3/4.2]">
          {deck.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center rounded-[28px] border border-hairline bg-surface-1">
              <EmptyState
                icon={<Sparkles size={26} />}
                title="You’re all caught up"
                subtitle="You’ve swiped every look. Reset to see them again, or build your own."
                action={
                  <div className="flex gap-2">
                    <PremiumButton variant="secondary" onClick={() => reset()} icon={<RotateCcw size={16} />}>Reset</PremiumButton>
                    <PremiumButton onClick={() => router.push('/create')} icon={<Wand2 size={16} />}>Create</PremiumButton>
                  </div>
                }
              />
            </div>
          ) : (
            deck
              .slice(0, 3)
              .map((outfit, i) => (
                <SwipeCard
                  key={outfit.id}
                  outfit={outfit}
                  reasons={reasonsFor(outfit)}
                  active={i === 0}
                  offset={i}
                  force={i === 0 ? force : null}
                  onSwipe={(action) => onSwipe(outfit, action)}
                />
              ))
              .reverse()
          )}
        </div>
      </div>

      {/* actions */}
      {top && (
        <div className="px-5 mt-5">
          <div className="flex items-center justify-center gap-3">
            <ActionBtn small onClick={() => setShowItems(true)} aria="Inspect items">
              <Info size={20} className="text-ink-soft" />
            </ActionBtn>
            <ActionBtn onClick={() => fly('dislike')} aria="Pass">
              <X size={26} className="text-accent" strokeWidth={2.4} />
            </ActionBtn>
            <ActionBtn big accent onClick={() => fly('superlike')} aria="Superlike">
              <Star size={26} className="text-white fill-white" />
            </ActionBtn>
            <ActionBtn onClick={() => fly('like')} aria="Like">
              <Heart size={26} className="text-emerald" strokeWidth={2.4} />
            </ActionBtn>
            <ActionBtn
              small
              onClick={() => {
                toggleSaveOutfit(top.id);
                successToast('Saved to your looks');
              }}
              aria="Save"
            >
              <Bookmark size={20} className="text-ink-soft" />
            </ActionBtn>
          </div>
          <button
            onClick={() => router.push(`/create?remix=${top.id}`)}
            className="mx-auto mt-3 flex items-center gap-1.5 text-[13px] font-medium text-muted-2 btn-press"
          >
            <Wand2 size={14} /> Remix this look in the editor
          </button>
        </div>
      )}

      <BottomSheet open={showItems} onClose={() => setShowItems(false)} title={top ? `In “${top.title}”` : 'Items'}>
        <div className="space-y-2 pb-2">
          {top?.itemIds.map((id) => {
            const item = resolveItem(id);
            if (!item) return null;
            return (
              <div key={id} className="flex items-center justify-between p-3 rounded-2xl bg-surface-2">
                <div>
                  <div className="text-[13px] font-semibold text-ink">{item.name}</div>
                  <div className="text-[11px] text-muted">{item.brand} · {item.colorName}</div>
                </div>
                <span className="text-[11px] text-muted-2 capitalize">{item.subcategory}</span>
              </div>
            );
          })}
          {top && (
            <div className="text-[11px] text-muted px-1 pt-1">
              By @{getCreator(top.ownerId)?.handle}
            </div>
          )}
        </div>
      </BottomSheet>
    </AppShell>
  );
}

function ActionBtn({
  children,
  onClick,
  big,
  small,
  accent,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  big?: boolean;
  small?: boolean;
  accent?: boolean;
  aria: string;
}) {
  const size = big ? 'w-16 h-16' : small ? 'w-11 h-11' : 'w-14 h-14';
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className={`grid place-items-center rounded-full shadow-card border btn-press ${size} ${
        accent ? 'bg-ink border-ink' : 'bg-surface-1 border-hairline'
      }`}
    >
      {children}
    </button>
  );
}
