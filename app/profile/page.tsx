'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shirt, Wand2, CalendarDays, Trash2, Pencil, Heart, Layers, FolderHeart, RotateCcw } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { ProfileHeader } from '@/components/ProfileHeader';
import { SegmentedControl, Pill, EmptyState, PremiumButton, Avatar } from '@/components/Primitives';
import { ClothingCard } from '@/components/ClothingCard';
import { OutfitCard } from '@/components/OutfitCard';
import { OutfitCollage } from '@/components/OutfitCollage';
import { BottomSheet } from '@/components/BottomSheet';
import { AddItemSheet } from '@/components/AddItemSheet';
import { successToast } from '@/components/Toast';
import type { AestheticId, ClosetItem, OccasionKey, Outfit } from '@/lib/social-types';
import type { Category } from '@/lib/types';
import { occasionLabel } from '@/lib/style';
import { POST_BY_OUTFIT } from '@/lib/data/community';
import { useMe } from '@/store/me';
import { useStyleDNA } from '@/store/style-dna';
import { useCloset, useMyClosetItems } from '@/store/closet';
import { useMyOutfits, useSavedOutfits, useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';

type Tab = 'clothes' | 'outfits' | 'collections' | 'saved';
type ClothesFilter = 'all' | Category | 'acc' | 'formal' | 'athletic';

const CLOTHES_FILTERS: Array<{ value: ClothesFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'outer', label: 'Outerwear' },
  { value: 'acc', label: 'Accessories' },
  { value: 'formal', label: 'Formal' },
  { value: 'athletic', label: 'Athletic' },
];

function matchFilter(item: ClosetItem, f: ClothesFilter): boolean {
  if (f === 'all') return true;
  if (f === 'acc') return ['bag', 'eyewear', 'jewelry', 'hat'].includes(item.category);
  if (f === 'formal') return item.formality === 'formal' || item.formality === 'smart';
  if (f === 'athletic') return item.tags.includes('gym') || item.tags.includes('athletic');
  return item.category === f;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ProfilePage() {
  const router = useRouter();
  const me = useMe();
  const setProfile = useMe((s) => s.setProfile);
  const resetOnboarding = useMe((s) => s.resetOnboarding);
  const resetDNA = useStyleDNA((s) => s.reset);

  const items = useMyClosetItems();
  const favorites = useCloset((s) => s.favorites);
  const toggleFavorite = useCloset((s) => s.toggleFavorite);
  const removeItem = useCloset((s) => s.removeItem);
  const myOutfits = useMyOutfits();
  const savedOutfits = useSavedOutfits();
  const deleteOutfit = useOutfits((s) => s.deleteOutfit);
  const schedule = usePlanner((s) => s.schedule);

  const [tab, setTab] = useState<Tab>('clothes');
  const [filter, setFilter] = useState<ClothesFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [itemSheet, setItemSheet] = useState<ClosetItem | null>(null);
  const [outfitSheet, setOutfitSheet] = useState<Outfit | null>(null);
  const [collection, setCollection] = useState<{ label: string; outfits: Outfit[] } | null>(null);

  // edit-profile local fields
  const [name, setName] = useState(me.name);
  const [handle, setHandle] = useState(me.handle);
  const [bio, setBio] = useState(me.bio);

  const filtered = useMemo(() => items.filter((i) => matchFilter(i, filter)), [items, filter]);

  const collections = useMemo(() => {
    const pool = [...myOutfits, ...savedOutfits];
    const byOcc = new Map<OccasionKey, Outfit[]>();
    for (const o of pool) if (o.occasion) byOcc.set(o.occasion, [...(byOcc.get(o.occasion) || []), o]);
    const list = Array.from(byOcc.entries()).map(([key, outfits]) => ({ key, label: occasionLabel(key), outfits }));
    const favs = pool.filter((o) => o.aesthetics.length); // placeholder grouping
    if (favs.length) list.unshift({ key: 'all' as OccasionKey, label: 'All looks', outfits: pool });
    return list;
  }, [myOutfits, savedOutfits]);

  const fallbackAesthetics: AestheticId[] = ['minimalist', 'casual'];
  const meCreator = {
    id: 'me',
    handle: me.handle,
    name: me.name,
    avatarColor: me.avatarColor,
    motif: 'tee' as const,
    bio: me.bio,
    aesthetics: me.aesthetics.length ? me.aesthetics : fallbackAesthetics,
    followers: 128,
    following: 184,
  };

  return (
    <AppShell
      header={
        <AppHeader
          title="Your Closet"
          right={
            <button onClick={() => setActionOpen(true)} className="grid place-items-center w-10 h-10 rounded-full bg-ink text-cream btn-press" aria-label="Add">
              <Plus size={20} />
            </button>
          }
        />
      }
    >
      <div className="pt-2">
        <ProfileHeader
          creator={meCreator}
          stats={{ outfits: myOutfits.length, items: items.length }}
          isMe
          onEdit={() => {
            setName(me.name);
            setHandle(me.handle);
            setBio(me.bio);
            setEditOpen(true);
          }}
          onShare={() => successToast('Profile link copied')}
          onSettings={() => setSettingsOpen(true)}
        />
      </div>

      <div className="px-5 mt-5 sticky top-[68px] z-10">
        <SegmentedControl
          options={[
            { value: 'clothes', label: 'Clothes' },
            { value: 'outfits', label: 'Outfits' },
            { value: 'collections', label: 'Collections' },
            { value: 'saved', label: 'Saved' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-5 mt-4">
        {tab === 'clothes' && (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 mb-3">
              {CLOTHES_FILTERS.map((f) => (
                <Pill key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Pill>
              ))}
            </div>
            {filtered.length === 0 ? (
              <EmptyState icon={<Shirt size={26} />} title="Nothing here yet" subtitle="Add pieces to build your closet." action={<PremiumButton onClick={() => setAddOpen(true)} icon={<Plus size={16} />}>Add a piece</PremiumButton>} />
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {filtered.map((item) => (
                  <ClothingCard
                    key={item.id}
                    item={item}
                    imageClassName="aspect-square"
                    favorite={favorites.includes(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id)}
                    onClick={() => setItemSheet(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'outfits' && (
          myOutfits.length === 0 ? (
            <EmptyState icon={<Layers size={26} />} title="No outfits yet" subtitle="Build your first look in the editor." action={<PremiumButton onClick={() => router.push('/create')} icon={<Wand2 size={16} />}>Create outfit</PremiumButton>} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {myOutfits.map((o) => (
                <OutfitCard key={o.id} outfit={o} onClick={() => setOutfitSheet(o)} />
              ))}
            </div>
          )
        )}

        {tab === 'collections' && (
          collections.length === 0 ? (
            <EmptyState icon={<FolderHeart size={26} />} title="No collections yet" subtitle="Save or tag looks by occasion and they’ll group here." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {collections.map((c) => (
                <button key={c.label} onClick={() => setCollection(c)} className="text-left btn-press">
                  <div className="relative rounded-2xl overflow-hidden border border-hairline">
                    <OutfitCollage outfit={c.outfits[0]} className="w-full aspect-[3/4]" rounded="rounded-none" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink/80 to-transparent">
                      <div className="text-sm font-semibold text-white">{c.label}</div>
                      <div className="text-[11px] text-white/70">{c.outfits.length} looks</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'saved' && (
          savedOutfits.length === 0 ? (
            <EmptyState icon={<Heart size={26} />} title="No saved looks" subtitle="Swipe and save looks you love — they’ll land here." action={<PremiumButton onClick={() => router.push('/swipe')} icon={<Heart size={16} />}>Start swiping</PremiumButton>} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {savedOutfits.map((o) => {
                const post = POST_BY_OUTFIT.get(o.id);
                return (
                  <OutfitCard key={o.id} outfit={o} showCreator onClick={() => (post ? router.push(`/community/${post.id}`) : router.push(`/create?remix=${o.id}`))} />
                );
              })}
            </div>
          )
        )}
      </div>

      {/* + action sheet */}
      <BottomSheet open={actionOpen} onClose={() => setActionOpen(false)} title="Add to Sylistly">
        <div className="space-y-2 pb-2">
          <ActionRow icon={<Shirt size={20} />} title="Add clothes" subtitle="Add a piece to your closet" onClick={() => { setActionOpen(false); setAddOpen(true); }} />
          <ActionRow icon={<Wand2 size={20} />} title="Create outfit" subtitle="Build a collage in the editor" onClick={() => { setActionOpen(false); router.push('/create'); }} />
          <ActionRow icon={<CalendarDays size={20} />} title="Chat with AI stylist" subtitle="Get a look styled for you" onClick={() => { setActionOpen(false); router.push('/stylist'); }} />
        </div>
      </BottomSheet>

      {/* item sheet */}
      <BottomSheet open={!!itemSheet} onClose={() => setItemSheet(null)} title={itemSheet?.name}>
        {itemSheet && (
          <div className="pb-2">
            <div className="flex gap-3">
              <div className="w-28 h-32 rounded-2xl collage-paper border border-hairline grid place-items-center overflow-hidden">
                <OutfitCollage outfit={{ layout: [], background: 'paper', itemIds: [itemSheet.id] }} className="w-full h-full" rounded="rounded-none" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">{itemSheet.name}</div>
                <div className="text-[12px] text-muted">{itemSheet.brand} · {itemSheet.colorName}</div>
                <div className="text-[12px] text-muted capitalize mt-1">{itemSheet.subcategory} · {itemSheet.formality}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <PremiumButton variant="secondary" onClick={() => { toggleFavorite(itemSheet.id); }} icon={<Heart size={16} className={favorites.includes(itemSheet.id) ? 'fill-accent text-accent' : ''} />}>
                {favorites.includes(itemSheet.id) ? 'Unfavorite' : 'Favorite'}
              </PremiumButton>
              <PremiumButton onClick={() => { setItemSheet(null); router.push('/create'); }} icon={<Wand2 size={16} />}>Style it</PremiumButton>
            </div>
            <button onClick={() => { removeItem(itemSheet.id); setItemSheet(null); successToast('Removed from closet'); }} className="w-full mt-2 h-11 rounded-full text-accent text-sm font-semibold flex items-center justify-center gap-1.5">
              <Trash2 size={16} /> Remove from closet
            </button>
          </div>
        )}
      </BottomSheet>

      {/* outfit sheet */}
      <BottomSheet open={!!outfitSheet} onClose={() => setOutfitSheet(null)} title={outfitSheet?.title}>
        {outfitSheet && (
          <div className="pb-2">
            <OutfitCollage outfit={outfitSheet} className="w-full aspect-[4/5]" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <PremiumButton onClick={() => { const o = outfitSheet; setOutfitSheet(null); router.push(`/create?edit=${o.id}`); }} icon={<Pencil size={16} />}>Edit</PremiumButton>
              <PremiumButton variant="secondary" onClick={() => { schedule(todayISO(), outfitSheet.id, outfitSheet.occasion); setOutfitSheet(null); successToast('Added to today’s planner'); }} icon={<CalendarDays size={16} />}>Wear today</PremiumButton>
            </div>
            {outfitSheet.source === 'user' && (
              <button onClick={() => { deleteOutfit(outfitSheet.id); setOutfitSheet(null); successToast('Outfit deleted'); }} className="w-full mt-2 h-11 rounded-full text-accent text-sm font-semibold flex items-center justify-center gap-1.5">
                <Trash2 size={16} /> Delete outfit
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* collection sheet */}
      <BottomSheet open={!!collection} onClose={() => setCollection(null)} title={collection?.label}>
        <div className="grid grid-cols-2 gap-3 pb-2">
          {collection?.outfits.map((o) => {
            const post = POST_BY_OUTFIT.get(o.id);
            return <OutfitCard key={o.id} outfit={o} onClick={() => { setCollection(null); post ? router.push(`/community/${post.id}`) : router.push(`/create?edit=${o.id}`); }} />;
          })}
        </div>
      </BottomSheet>

      {/* edit profile */}
      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
        footer={<PremiumButton fullWidth size="lg" onClick={() => { setProfile({ name, handle, bio }); setEditOpen(false); successToast('Profile updated'); }}>Save</PremiumButton>}
      >
        <div className="space-y-3 pb-2">
          <div className="flex justify-center"><Avatar name={name || 'You'} color={me.avatarColor} size={72} /></div>
          <Labeled label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-surface-2 border border-hairline text-sm text-ink focus:outline-none focus:border-hairline-2" /></Labeled>
          <Labeled label="Handle"><input value={handle} onChange={(e) => setHandle(e.target.value.replace(/\s/g, ''))} className="w-full h-11 px-3 rounded-xl bg-surface-2 border border-hairline text-sm text-ink focus:outline-none focus:border-hairline-2" /></Labeled>
          <Labeled label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-sm text-ink resize-none focus:outline-none focus:border-hairline-2" /></Labeled>
        </div>
      </BottomSheet>

      {/* settings */}
      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-2 pb-2">
          <ActionRow icon={<RotateCcw size={20} />} title="Reset Style DNA" subtitle="Start your swipe learning over" onClick={() => { resetDNA(); setSettingsOpen(false); successToast('Style DNA reset'); }} />
          <ActionRow icon={<Wand2 size={20} />} title="Restart onboarding" subtitle="Re-pick your aesthetics" onClick={() => { resetOnboarding(); setSettingsOpen(false); router.push('/onboarding'); }} />
          <div className="text-center text-[11px] text-muted pt-3">Sylistly v0.3.0 · Your AI Fashion Studio</div>
        </div>
      </BottomSheet>

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  );
}

function ActionRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface-2 text-left btn-press">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-ink text-cream shrink-0">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-[11px] text-muted">{subtitle}</div>
      </div>
    </button>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-editorial text-muted mb-1.5">{label}</div>
      {children}
    </div>
  );
}
