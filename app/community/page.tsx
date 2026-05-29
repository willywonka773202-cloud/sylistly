'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, UserCheck } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { SegmentedControl, Avatar } from '@/components/Primitives';
import { MasonryFeed } from '@/components/MasonryFeed';
import { ClothingCard } from '@/components/ClothingCard';
import { successToast } from '@/components/Toast';
import { SEED_POSTS } from '@/lib/data/community';
import { trendingPosts } from '@/lib/data';
import { CLOSET_ITEMS } from '@/lib/data/closet';
import { CREATORS } from '@/lib/data/creators';
import { aestheticLabel, compactCount } from '@/lib/style';
import { useSocial } from '@/store/social';
import { useCloset } from '@/store/closet';
import { useMounted } from '@/lib/use-mounted';

type Tab = 'outfits' | 'clothes' | 'creators' | 'trending';
const DISCOVER_ITEMS = CLOSET_ITEMS.filter((i) => i.ownerId !== 'me');

export default function CommunityPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('outfits');
  const [query, setQuery] = useState('');
  const addItem = useCloset((s) => s.addItem);
  const q = query.trim().toLowerCase();

  const outfits = useMemo(
    () =>
      q
        ? SEED_POSTS.filter((p) => `${p.caption} ${p.creatorId}`.toLowerCase().includes(q))
        : SEED_POSTS,
    [q],
  );
  const trending = useMemo(() => trendingPosts(20), []);
  const clothes = useMemo(
    () => (q ? DISCOVER_ITEMS.filter((i) => `${i.name} ${i.brand} ${i.colorName}`.toLowerCase().includes(q)) : DISCOVER_ITEMS),
    [q],
  );
  const creators = useMemo(
    () => (q ? CREATORS.filter((c) => `${c.name} ${c.handle}`.toLowerCase().includes(q)) : CREATORS),
    [q],
  );

  return (
    <AppShell header={<AppHeader brand kicker="Community" />}>
      <div className="px-5 pt-1">
        <div className="relative mb-3">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search looks, creators, pieces…"
            className="w-full h-11 pl-10 pr-4 rounded-full bg-surface-1 border border-hairline text-sm text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2"
          />
        </div>
        <SegmentedControl
          options={[
            { value: 'outfits', label: 'Outfits' },
            { value: 'clothes', label: 'Clothes' },
            { value: 'creators', label: 'Creators' },
            { value: 'trending', label: 'Trending' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-5 mt-4">
        {(tab === 'outfits' || tab === 'trending') && (
          <MasonryFeed posts={tab === 'trending' ? trending : outfits} onOpen={(p) => router.push(`/community/${p.id}`)} />
        )}

        {tab === 'clothes' && (
          <>
            <p className="text-[12px] text-muted mb-3">Tap a piece to save it to your closet.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {clothes.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  imageClassName="aspect-square"
                  onClick={() => {
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
                    });
                    successToast(`Saved ${item.name}`);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {tab === 'creators' && (
          <div className="space-y-2">
            {creators.map((c) => (
              <CreatorRow key={c.id} id={c.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CreatorRow({ id }: { id: string }) {
  const router = useRouter();
  const creator = CREATORS.find((c) => c.id === id)!;
  const following = useSocial((s) => s.follows.includes(id));
  const toggleFollow = useSocial((s) => s.toggleFollow);
  const mounted = useMounted();

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-1 border border-hairline">
      <button onClick={() => router.push(`/community/creator/${id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <Avatar name={creator.name} color={creator.avatarColor} size={48} />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-ink truncate">{creator.name}</span>
            {creator.verified && <span className="grid place-items-center w-3.5 h-3.5 rounded-full bg-accent text-white text-[8px]">✓</span>}
          </div>
          <div className="text-[12px] text-muted truncate">
            {compactCount(creator.followers)} followers · {creator.aesthetics.slice(0, 2).map(aestheticLabel).join(', ')}
          </div>
        </div>
      </button>
      <button
        onClick={() => toggleFollow(id)}
        className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-semibold shrink-0 ${
          mounted && following ? 'bg-surface-2 text-ink border border-hairline-2' : 'bg-ink text-cream'
        }`}
      >
        {mounted && following ? <UserCheck size={15} /> : <UserPlus size={15} />}
        {mounted && following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
