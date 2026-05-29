'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Heart, Bookmark, Wand2, Plus, Send, UserPlus, UserCheck } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Avatar, Chip, PremiumButton, EmptyState } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import { getPost } from '@/lib/data/community';
import { getOutfit } from '@/lib/data/outfits';
import { getCreator } from '@/lib/data/creators';
import { resolveItem } from '@/lib/item-registry';
import { itemArt } from '@/lib/garment-art';
import { aestheticLabel, occasionLabel, compactCount, centsToUsd, timeAgo } from '@/lib/style';
import type { Comment } from '@/lib/social-types';
import { useSocial } from '@/store/social';
import { useOutfits } from '@/store/outfits';
import { useCloset } from '@/store/closet';
import { useMe } from '@/store/me';
import { useMounted } from '@/lib/use-mounted';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const post = getPost(params.id);
  const outfit = post ? getOutfit(post.outfitId) : undefined;
  const creator = post ? getCreator(post.creatorId) : undefined;

  const [selected, setSelected] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>(post?.comments ?? []);
  const [draft, setDraft] = useState('');

  const liked = useSocial((s) => (post ? s.likedPosts.includes(post.id) : false));
  const savedPost = useSocial((s) => (post ? s.savedPosts.includes(post.id) : false));
  const toggleLike = useSocial((s) => s.toggleLike);
  const toggleSavePost = useSocial((s) => s.toggleSavePost);
  const following = useSocial((s) => (creator ? s.follows.includes(creator.id) : false));
  const toggleFollow = useSocial((s) => s.toggleFollow);
  const savedOutfit = useOutfits((s) => (outfit ? s.savedIds.includes(outfit.id) : false));
  const toggleSaveOutfit = useOutfits((s) => s.toggleSaveOutfit);
  const addItem = useCloset((s) => s.addItem);
  const meName = useMe((s) => s.name);
  const meColor = useMe((s) => s.avatarColor);
  const mounted = useMounted();

  if (!post || !outfit || !creator) {
    return (
      <AppShell showTabBar={false} header={<AppHeader title="Post" back />}>
        <EmptyState icon={<Wand2 size={24} />} title="Post not found" subtitle="This look may have been removed." action={<PremiumButton onClick={() => router.push('/community')}>Back to community</PremiumButton>} />
      </AppShell>
    );
  }

  function postComment() {
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [{ id: `local-${Date.now()}`, authorId: 'me', text, createdAt: new Date().toISOString() }, ...c]);
    setDraft('');
  }

  return (
    <AppShell showTabBar={false} pad={false} header={<AppHeader title={outfit.title} back />}>
      <div className="pb-32">
        {/* collage */}
        <div className="px-5 pt-2">
          <OutfitCollage
            outfit={outfit}
            className="w-full aspect-[4/5] shadow-card"
            interactive
            selectedItemId={selected}
            onItemClick={(id) => setSelected((s) => (s === id ? null : id))}
          />
        </div>

        {/* creator + actions */}
        <div className="px-5 mt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/community/creator/${creator.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <Avatar name={creator.name} color={creator.avatarColor} size={44} />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-ink truncate">{creator.name}</span>
                  {creator.verified && <span className="grid place-items-center w-3.5 h-3.5 rounded-full bg-accent text-white text-[8px]">✓</span>}
                </div>
                <div className="text-[12px] text-muted">@{creator.handle} · {timeAgo(post.createdAt)}</div>
              </div>
            </button>
            <button
              onClick={() => toggleFollow(creator.id)}
              className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-semibold ${
                mounted && following ? 'bg-surface-2 text-ink border border-hairline-2' : 'bg-ink text-cream'
              }`}
            >
              {mounted && following ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {mounted && following ? 'Following' : 'Follow'}
            </button>
          </div>

          <p className="text-sm text-ink mt-3 leading-relaxed">{post.caption}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.occasion && <Chip tone="ink">{occasionLabel(post.occasion)}</Chip>}
            {outfit.aesthetics.slice(0, 3).map((a) => (
              <Chip key={a}>{aestheticLabel(a)}</Chip>
            ))}
          </div>

          <div className="flex items-center gap-5 mt-4 text-muted-2">
            <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 btn-press">
              <Heart size={20} className={mounted && liked ? 'fill-accent text-accent' : ''} />
              <span className="text-sm">{compactCount(post.likes + (mounted && liked ? 1 : 0))}</span>
            </button>
            <span className="flex items-center gap-1.5">
              <Send size={18} /> <span className="text-sm">{compactCount(comments.length)}</span>
            </span>
            <button onClick={() => toggleSavePost(post.id)} className="ml-auto btn-press" aria-label="Bookmark">
              <Bookmark size={20} className={mounted && savedPost ? 'fill-ink text-ink' : ''} />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <PremiumButton size="md" className="flex-1" onClick={() => router.push(`/create?remix=${outfit.id}`)} icon={<Wand2 size={16} />}>
              Recreate / Remix
            </PremiumButton>
            <PremiumButton
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => {
                toggleSaveOutfit(outfit.id);
                successToast(savedOutfit ? 'Removed from saved' : 'Saved to your looks');
              }}
              icon={<Bookmark size={16} />}
            >
              {mounted && savedOutfit ? 'Saved' : 'Save look'}
            </PremiumButton>
          </div>
        </div>

        {/* item list */}
        <div className="px-5 mt-6">
          <div className="text-2xs uppercase tracking-editorial text-muted mb-2">In this look · {outfit.itemIds.length} pieces</div>
          <div className="space-y-2">
            {outfit.itemIds.map((id) => {
              const item = resolveItem(id);
              if (!item) return null;
              const isSel = selected === id;
              return (
                <div key={id} className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-colors ${isSel ? 'bg-accent-soft border-accent' : 'bg-surface-1 border-hairline'}`}>
                  <div className="w-12 h-12 rounded-xl collage-paper grid place-items-center overflow-hidden shrink-0">
                    <img src={itemArt(item)} alt="" className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink truncate">{item.name}</div>
                    <div className="text-[11px] text-muted truncate">{item.brand} · {item.colorName}</div>
                  </div>
                  {item.priceCents ? <span className="text-[12px] text-ink-soft font-medium">{centsToUsd(item.priceCents)}</span> : null}
                  <button
                    onClick={() => {
                      addItem({
                        name: item.name, brand: item.brand, category: item.category, shape: item.shape,
                        color: item.color, colorName: item.colorName, tags: item.tags, formality: item.formality,
                        season: item.season, warmth: item.warmth, priceCents: item.priceCents,
                      });
                      successToast(`Saved ${item.name}`);
                    }}
                    className="grid place-items-center w-8 h-8 rounded-full bg-surface-2 text-ink shrink-0"
                    aria-label="Add to closet"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* comments */}
        <div className="px-5 mt-6">
          <div className="text-2xs uppercase tracking-editorial text-muted mb-2">Comments</div>
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={meName} color={meColor} size={32} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
              placeholder="Add a comment…"
              className="flex-1 h-10 px-3 rounded-full bg-surface-1 border border-hairline text-sm text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2"
            />
            <button onClick={postComment} className="grid place-items-center w-10 h-10 rounded-full bg-ink text-cream" aria-label="Send">
              <Send size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {comments.map((c) => {
              const author = getCreator(c.authorId);
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Avatar name={author?.name || 'You'} color={author?.avatarColor || meColor} size={30} />
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold text-ink">{author?.name || 'You'}</span>
                    <span className="text-[13px] text-ink-soft"> {c.text}</span>
                    <div className="text-[11px] text-muted mt-0.5">{timeAgo(c.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            {comments.length === 0 && <p className="text-sm text-muted">Be the first to comment.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
