import { Feed } from '@/components/Feed';
import { buildVibeThumbs, composeInitialLooks } from '@/lib/compose-look';

// Server Component: resolve the deterministic opening deck + vibe thumbnails at
// build time so the ~1.3MB catalog never ships in the feed's First Load JS. The
// client island (components/Feed) lazy-loads the look engine only when dealing
// MORE looks. No request data → statically prerendered, the deck baked into HTML.
export default function FeedPage() {
  const { looks, cursor } = composeInitialLooks(4);
  return <Feed initialLooks={looks} initialCursor={cursor} initialVibeThumbs={buildVibeThumbs()} />;
}
