'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { SegmentedControl, EmptyState, PremiumButton, Chip } from '@/components/Primitives';
import { OutfitCard } from '@/components/OutfitCard';
import { OutfitCollage } from '@/components/OutfitCollage';
import { BottomSheet } from '@/components/BottomSheet';
import { successToast } from '@/components/Toast';
import { occasionLabel, occasionEmoji } from '@/lib/style';
import { usePlanner } from '@/store/planner';
import { useResolveOutfit, useMyOutfits, useSavedOutfits } from '@/store/outfits';
import { useMounted } from '@/lib/use-mounted';

const pad = (n: number) => `${n}`.padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PlannerPage() {
  const router = useRouter();
  const mounted = useMounted();
  const entries = usePlanner((s) => s.entries);
  const schedule = usePlanner((s) => s.schedule);
  const unschedule = usePlanner((s) => s.unschedule);
  const resolveOutfit = useResolveOutfit();
  const myOutfits = useMyOutfits();
  const savedOutfits = useSavedOutfits();

  const today = new Date();
  const [view, setView] = useState<'day' | 'month'>('day');
  const [selected, setSelected] = useState(iso(today));
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [pickOpen, setPickOpen] = useState(false);

  const week = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const entryDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const dayEntries = useMemo(() => entries.filter((e) => e.date === selected), [entries, selected]);

  const pool = useMemo(() => {
    const seen = new Set<string>();
    return [...myOutfits, ...savedOutfits].filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
  }, [myOutfits, savedOutfits]);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) cells.push(iso(new Date(cursor.y, cursor.m, d)));
    return cells;
  }, [cursor]);

  function prettyDate(isoStr: string): string {
    const [y, m, d] = isoStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isoStr === iso(today)) return 'Today';
    return `${WD[date.getDay()]}, ${MO[m - 1].slice(0, 3)} ${d}`;
  }

  return (
    <AppShell
      header={
        <AppHeader
          title="Planner"
          right={
            <button onClick={() => { setSelected(iso(today)); setCursor({ y: today.getFullYear(), m: today.getMonth() }); setView('day'); }} className="px-3.5 h-9 rounded-full bg-surface-1 border border-hairline text-ink text-[13px] font-semibold btn-press">
              Today
            </button>
          }
        />
      }
    >
      <div className="px-5 pt-2">
        <SegmentedControl options={[{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }]} active={view} onChange={setView} />
      </div>

      {view === 'day' && (
        <>
          {/* week strip */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 mt-4">
            {week.map((d) => {
              const di = iso(d);
              const active = di === selected;
              return (
                <button
                  key={di}
                  onClick={() => setSelected(di)}
                  className={`shrink-0 w-[52px] py-2.5 rounded-2xl flex flex-col items-center gap-1 border transition-colors ${active ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-ink border-hairline'}`}
                >
                  <span className={`text-[10px] ${active ? 'text-cream/70' : 'text-muted'}`}>{WD[d.getDay()]}</span>
                  <span className="text-lg font-display leading-none">{d.getDate()}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${mounted && entryDates.has(di) ? (active ? 'bg-cream' : 'bg-accent') : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>

          <div className="px-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-ink">{prettyDate(selected)}</h2>
              <button onClick={() => setPickOpen(true)} className="flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-ink text-cream text-[13px] font-semibold btn-press">
                <Plus size={15} /> Add outfit
              </button>
            </div>

            {dayEntries.length === 0 ? (
              <EmptyState icon={<CalendarDays size={26} />} title="Nothing planned" subtitle="Add an outfit to plan what you’ll wear." action={<PremiumButton onClick={() => setPickOpen(true)} icon={<Plus size={16} />}>Add outfit</PremiumButton>} />
            ) : (
              <div className="space-y-3">
                {dayEntries.map((e) => {
                  const outfit = resolveOutfit(e.outfitId);
                  if (!outfit) return null;
                  return (
                    <div key={e.outfitId} className="flex gap-3 p-3 rounded-3xl bg-surface-1 border border-hairline">
                      <button onClick={() => router.push(`/create?edit=${outfit.id}`)}>
                        <OutfitCollage outfit={outfit} className="w-24 h-32 shrink-0" rounded="rounded-2xl" />
                      </button>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="font-display text-lg text-ink">{outfit.title}</div>
                        {(e.occasion || outfit.occasion) && (
                          <div className="mt-1"><Chip>{occasionEmoji(e.occasion || outfit.occasion)} {occasionLabel(e.occasion || outfit.occasion)}</Chip></div>
                        )}
                        <div className="text-[12px] text-muted mt-1">{outfit.itemIds.length} pieces</div>
                      </div>
                      <button onClick={() => unschedule(e.date, e.outfitId)} className="grid place-items-center w-9 h-9 rounded-full bg-surface-2 text-muted-2 self-start" aria-label="Remove">
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'month' && (
        <div className="px-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))} className="grid place-items-center w-9 h-9 rounded-full bg-surface-1 border border-hairline"><ChevronLeft size={18} /></button>
            <h2 className="font-display text-xl text-ink">{MO[cursor.m]} {cursor.y}</h2>
            <button onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))} className="grid place-items-center w-9 h-9 rounded-full bg-surface-1 border border-hairline"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WD.map((w) => <div key={w} className="text-center text-2xs text-muted">{w[0]}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} />;
              const d = Number(cell.split('-')[2]);
              const isToday = cell === iso(today);
              const has = mounted && entryDates.has(cell);
              return (
                <button
                  key={cell}
                  onClick={() => { setSelected(cell); setView('day'); }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 border ${isToday ? 'border-ink' : 'border-hairline'} ${has ? 'bg-surface-2' : 'bg-surface-1'}`}
                >
                  <span className={`text-[13px] ${isToday ? 'font-bold text-ink' : 'text-ink-soft'}`}>{d}</span>
                  {has && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
          <p className="text-center text-[12px] text-muted mt-4">Tap a day to plan an outfit.</p>
        </div>
      )}

      {/* pick outfit sheet */}
      <BottomSheet open={pickOpen} onClose={() => setPickOpen(false)} title={`Plan for ${prettyDate(selected)}`}>
        {pool.length === 0 ? (
          <EmptyState icon={<Plus size={24} />} title="No outfits yet" subtitle="Create or save a look first." action={<PremiumButton onClick={() => router.push('/create')}>Create outfit</PremiumButton>} />
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-2">
            {pool.map((o) => (
              <OutfitCard key={o.id} outfit={o} onClick={() => { schedule(selected, o.id, o.occasion); setPickOpen(false); successToast(`Planned for ${prettyDate(selected)}`); }} />
            ))}
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}
