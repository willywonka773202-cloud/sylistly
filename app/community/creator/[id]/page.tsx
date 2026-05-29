'use client';
import { useParams, useRouter } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { ProfileHeader } from '@/components/ProfileHeader';
import { OutfitCard } from '@/components/OutfitCard';
import { EmptyState, PremiumButton, SectionHeader } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import { getCreator } from '@/lib/data/creators';
import { outfitsByOwner, itemsByOwner } from '@/lib/data';
import { POST_BY_OUTFIT } from '@/lib/data/community';
import { useSocial } from '@/store/social';
import { useMounted } from '@/lib/use-mounted';

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const creator = getCreator(params.id);
  const following = useSocial((s) => s.follows.includes(params.id));
  const toggleFollow = useSocial((s) => s.toggleFollow);
  const mounted = useMounted();

  if (!creator) {
    return (
      <AppShell showTabBar={false} header={<AppHeader title="Creator" back />}>
        <EmptyState icon={<Wand2 size={24} />} title="Creator not found" action={<PremiumButton onClick={() => router.push('/community')}>Back</PremiumButton>} />
      </AppShell>
    );
  }

  const outfits = outfitsByOwner(creator.id);

  return (
    <AppShell showTabBar={false} header={<AppHeader title={creator.name} back />}>
      <div className="pt-2 pb-10">
        <ProfileHeader
          creator={creator}
          stats={{ outfits: outfits.length, items: itemsByOwner(creator.id).length }}
          isFollowing={mounted && following}
          onFollow={() => toggleFollow(creator.id)}
          onShare={() => successToast('Profile link copied')}
        />

        <div className="px-5 mt-6">
          <SectionHeader title="Looks" kicker={`${outfits.length} outfits`} />
          {outfits.length === 0 ? (
            <p className="text-sm text-muted">No public looks yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {outfits.map((o) => {
                const post = POST_BY_OUTFIT.get(o.id);
                return (
                  <OutfitCard
                    key={o.id}
                    outfit={o}
                    showLikes
                    onClick={() => (post ? router.push(`/community/${post.id}`) : router.push(`/create?remix=${o.id}`))}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
