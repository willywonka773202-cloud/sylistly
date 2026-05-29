'use client';
import { motion } from 'framer-motion';
import { Settings, Share2, UserPlus, UserCheck, Pencil } from 'lucide-react';
import type { Creator } from '@/lib/social-types';
import { Avatar, Chip } from './Primitives';
import { aestheticLabel } from '@/lib/style';
import { compactCount } from '@/lib/style';

export function ProfileHeader({
  creator,
  stats,
  isMe,
  isFollowing,
  onEdit,
  onShare,
  onFollow,
  onSettings,
}: {
  creator: Creator;
  stats: { outfits: number; items: number };
  isMe?: boolean;
  isFollowing?: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onSettings?: () => void;
}) {
  return (
    <div className="px-5 pt-2">
      <div className="flex items-center gap-4">
        <Avatar name={creator.name} color={creator.avatarColor} size={76} />
        <div className="flex-1 grid grid-cols-3 gap-1 text-center">
          <Stat value={compactCount(stats.outfits)} label="Outfits" />
          <Stat value={compactCount(creator.followers)} label="Followers" />
          <Stat value={compactCount(creator.following)} label="Following" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <h1 className="font-display text-2xl text-ink">{creator.name}</h1>
          {creator.verified && (
            <span className="grid place-items-center w-4 h-4 rounded-full bg-accent text-white text-[9px]">✓</span>
          )}
        </div>
        <div className="text-sm text-muted">@{creator.handle}</div>
        <p className="text-sm text-ink-soft mt-1.5 leading-snug">{creator.bio}</p>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {creator.aesthetics.slice(0, 3).map((a) => (
            <Chip key={a}>{aestheticLabel(a)}</Chip>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {isMe ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onEdit}
              className="flex-1 h-11 rounded-full bg-surface-1 border border-hairline-2 text-ink text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Pencil size={15} /> Edit profile
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onShare}
              className="grid place-items-center w-11 h-11 rounded-full bg-surface-1 border border-hairline-2 text-ink"
              aria-label="Share"
            >
              <Share2 size={17} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onSettings}
              className="grid place-items-center w-11 h-11 rounded-full bg-surface-1 border border-hairline-2 text-ink"
              aria-label="Settings"
            >
              <Settings size={17} />
            </motion.button>
          </>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onFollow}
              className={`flex-1 h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 ${
                isFollowing ? 'bg-surface-1 border border-hairline-2 text-ink' : 'bg-ink text-cream'
              }`}
            >
              {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onShare}
              className="grid place-items-center w-11 h-11 rounded-full bg-surface-1 border border-hairline-2 text-ink"
              aria-label="Share"
            >
              <Share2 size={17} />
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-lg text-ink leading-none">{value}</div>
      <div className="text-[11px] text-muted mt-1">{label}</div>
    </div>
  );
}
