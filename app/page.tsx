'use client';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Sparkles, CalendarDays, Shirt, Flame, Wand2, ArrowRight, Bookmark } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { StoryRail } from '@/components/StoryRail';
import { AIStylistCard } from '@/components/AIStylistCard';
import { OutfitCard } from '@/components/OutfitCard';
import { ClothingCard } from '@/components/ClothingCard';
import { OutfitCollage } from '@/components/OutfitCollage';
import { SectionHeader, Avatar, PremiumButton, Chip } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import { useMe } from '@/store/me';
import { useStyleDNA } from '@/store/style-dna';
import { useMyOutfits, useOutfits, useResolveOutfit } from '@/store/outfits';
import { useMyClosetItems, useCloset } from '@/store/closet';
import { usePlanner } from '@/store/planner';
import { publicOutfits, trendingPosts, getOutfit } from '@/lib/data';
import { rankOutfits, dnaInsights } from '@/lib/recommend';
import { realBasics } from '@/lib/real-catalog';
import { STYLIST_ACTIONS } from '@/lib/stylist';
import type { ClosetItem } from '@/lib/social-types';
import { occasionLabel, aestheticLabel } from '@/lib/style';
import { useMounted } from '@/lib/use-mounted';

const SHORTCUTS = [
  { label: 'Planner', icon: CalendarDays, href: '/planner' },
  { label: 'Dressing Room', icon: Shirt, href: '/dressing-room' },
  { label: 'AI Stylist', icon: Wand2, href: '/stylist' },
  { label: 'Swipe', icon: Flame, href: '/swipe' },
];

export default function HomePage() {
  const router = useRouter();
  const mounted = useMounted();
  const name = useMe((s) => s.name);
  const onboarded = useMe((s) => s.onboarded);
  const dna = useStyleDNA((s) => s.dna);
  const myOutfits = useMyOutfits();
  const myItems = useMyClosetItems();
  const addItem = useCloset((s) => s.addItem);
  const schedule = usePlanner((s) => s.schedule);
  const plannerEntries = usePlanner((s) => s.entries);
  const toggleSaveOutfit = useOutfits((s) => s.toggleSaveOutfit);
  const resolveOutfit = useResolveOutfit();

  const insights = dnaInsights(dna);
  const todaysPick = useMemo(() => rankOutfits(publicOutfits(), dna)[0], [dna]);
  const trending = useMemo(() => trendingPosts(10), []);
  const basics = useMemo(() => realBasics(8), []);
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => plannerEntries.filter((e) => e.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
    [plannerEntries, todayKey],
  );

  useEffect(() => {
    if (mounted && !onboarded) router.replace('/onboarding');
  }, [mounted, onboarded, router]);

  function addBasic(item: ClosetItem) {
    addItem({
      name: item.name,
      brand: item.brand,
      category: item.category,
      shape: item.shape,
      color: item.color,
      colorName: item.colorName,
      tags: item.tags,
      formality: item.formality,
      season: item.season,
      warmth: item.warmth,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      retailerUrl: item.retailerUrl,
    });
    successToast(`Added ${item.name} to your closet`);
  }

  function prettyDay(iso: string): string {
    if (iso === todayKey) return 'Today';
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (iso === tomorrow) return 'Tomorrow';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }

  if (mounted && !onboarded) {
    return <div className="mx-auto w-full max-w-[440px] min-h-[100dvh] bg-bg" />;
  }

  return (
    <AppShell
      header={
        <AppHeader
          brand
          right={
            <>
              <button onClick={() => router.push('/community')} className="grid place-items-center w-10 h-10 rounded-full bg-surface-1 border border-hairline text-ink btn-press" aria-label="Search">
                <Search size={18} />
              </button>
              <button onClick={() => router.push('/profile')} aria-label="Profile" className="btn-press">
                <Avatar name={name} color="#c2554e" size={40} />
              </button>
            </>
          }
        />
      }
    >
      {/* greeting + DNA nudge */}
      <section className="px-5 pt-3">
        <p className="text-sm text-muted">{greeting()}, {name.split(' ')[0]}.</p>
        <h2 className="font-display text-2xl text-ink mt-0.5">Let’s build something good.</h2>

        <button
          onClick={() => router.push('/swipe')}
          className="w-full mt-3 rounded-3xl bg-ink text-cream p-4 text-left flex items-center gap-3 btn-press"
        >
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-cream/15">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {mounted && insights.swipes > 0 ? insights.messages[0] : 'Discover your Style DNA'}
            </div>
            <div className="h-1.5 mt-2 rounded-full bg-cream/20 overflow-hidden">
              <div className="h-full bg-cream rounded-full" style={{ width: `${Math.max(8, (mounted ? insights.progress : 0) * 100)}%` }} />
            </div>
          </div>
          <ArrowRight size={18} className="opacity-80" />
        </button>
      </section>

      {/* stories */}
      <section className="mt-5">
        <StoryRail />
      </section>

      {/* AI stylist hero cards */}
      <section className="px-5 mt-6">
        <SectionHeader title="AI Stylist" kicker="Ask me anything" action="Open" onAction={() => router.push('/stylist')} />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {STYLIST_ACTIONS.slice(0, 4).map((a) => (
            <AIStylistCard
              key={a.id}
              title={a.title}
              subtitle={a.subtitle}
              tone={a.tone}
              icon={<a.icon size={20} />}
              onClick={() => router.push(`/stylist?action=${a.id}`)}
            />
          ))}
        </div>
      </section>

      {/* shortcuts */}
      <section className="px-5 mt-6">
        <div className="grid grid-cols-4 gap-2.5">
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              onClick={() => router.push(s.href)}
              className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-surface-1 border border-hairline btn-press"
            >
              <s.icon size={22} className="text-ink" strokeWidth={1.8} />
              <span className="text-[11px] font-medium text-ink-soft text-center leading-tight">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* today's pick */}
      {todaysPick && (
        <section className="px-5 mt-7">
          <SectionHeader title="Today’s pick" kicker="Styled for you" />
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-3xl overflow-hidden border border-hairline">
            <OutfitCollage outfit={todaysPick} className="w-full aspect-[5/6]" rounded="rounded-none" />
            <div className="absolute inset-x-0 bottom-0 pt-20 pb-4 px-4 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {todaysPick.occasion && (
                  <span className="px-2.5 h-7 inline-flex items-center rounded-full bg-white/18 backdrop-blur text-[11px] font-medium text-white">{occasionLabel(todaysPick.occasion)}</span>
                )}
                {todaysPick.aesthetics.slice(0, 2).map((a) => (
                  <span key={a} className="px-2.5 h-7 inline-flex items-center rounded-full bg-white/18 backdrop-blur text-[11px] font-medium text-white">{aestheticLabel(a)}</span>
                ))}
              </div>
              <div className="font-display text-xl text-white">{todaysPick.title}</div>
              <div className="flex gap-2 mt-3">
                <PremiumButton variant="secondary" size="sm" className="flex-1" onClick={() => router.push(`/create?remix=${todaysPick.id}`)} icon={<Wand2 size={15} />}>
                  Remix
                </PremiumButton>
                <PremiumButton
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    schedule(todayKey, todaysPick.id, todaysPick.occasion);
                    successToast('Added to today’s planner');
                  }}
                >
                  Wear today
                </PremiumButton>
                <button
                  onClick={() => {
                    toggleSaveOutfit(todaysPick.id);
                    successToast('Saved to your looks');
                  }}
                  className="grid place-items-center w-11 h-9 rounded-full bg-white/90 text-ink shrink-0"
                  aria-label="Save"
                >
                  <Bookmark size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {/* recent outfits */}
      <section className="px-5 mt-7">
        <SectionHeader title="Your recent looks" action="All" onAction={() => router.push('/profile')} />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {myOutfits.slice(0, 8).map((o) => (
            <OutfitCard key={o.id} outfit={o} className="w-[150px] shrink-0" onClick={() => router.push(`/create?edit=${o.id}`)} />
          ))}
        </div>
      </section>

      {/* recently added items */}
      <section className="px-5 mt-7">
        <SectionHeader title="Recently added" action="Closet" onAction={() => router.push('/profile')} />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {myItems.slice(0, 10).map((i) => (
            <ClothingCard key={i.id} item={i} className="w-[124px] shrink-0" />
          ))}
        </div>
      </section>

      {/* basics */}
      <section className="px-5 mt-7">
        <SectionHeader title="Wardrobe basics" kicker="Tap to add" />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {basics.map((i) => (
            <ClothingCard key={i.id} item={i} className="w-[124px] shrink-0" onClick={() => addBasic(i)} />
          ))}
        </div>
      </section>

      {/* planner preview */}
      <section className="px-5 mt-7">
        <SectionHeader title="Your planner" kicker="What’s next" action="Open" onAction={() => router.push('/planner')} />
        {upcoming.length === 0 ? (
          <button onClick={() => router.push('/planner')} className="w-full rounded-3xl border border-dashed border-hairline-2 bg-surface-1 p-4 text-left flex items-center gap-3 btn-press">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-accent-soft text-accent"><CalendarDays size={20} /></span>
            <div>
              <div className="text-sm font-semibold text-ink">Plan your week</div>
              <div className="text-[12px] text-muted">Schedule outfits for the days ahead</div>
            </div>
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {upcoming.map((e) => {
              const o = resolveOutfit(e.outfitId);
              if (!o) return null;
              return (
                <div key={`${e.date}-${e.outfitId}`} className="w-[150px] shrink-0">
                  <div className="text-[11px] font-semibold text-accent mb-1">{prettyDay(e.date)}</div>
                  <OutfitCard outfit={o} onClick={() => router.push('/planner')} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* trending */}
      <section className="px-5 mt-7">
        <SectionHeader title="Trending now" kicker="Community · demo looks" action="Explore" onAction={() => router.push('/community')} />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {trending.map((p) => {
            const o = getOutfit(p.outfitId);
            if (!o) return null;
            return (
              <OutfitCard key={p.id} outfit={o} showCreator showLikes className="w-[160px] shrink-0" onClick={() => router.push(`/community/${p.id}`)} />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-2xs text-muted">
          <Chip>Demo looks · real product photos</Chip>
        </div>
      </section>
    </AppShell>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
