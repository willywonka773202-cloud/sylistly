import { Feed } from '@/components/Feed';
import { buildVibeThumbs, composeInitialLooks } from '@/lib/compose-look';

// Server Component: resolve the deterministic opening deck + vibe thumbnails at
// build time so the ~1.3MB catalog never ships in the feed's First Load JS. The
// client island (components/Feed) lazy-loads the look engine only when dealing
// MORE looks. No request data → statically prerendered, the deck baked into HTML.
export default function FeedPage() {
  const { looks, cursor } = composeInitialLooks(4);
  return (
    <>
      {/* Lock the document BEFORE first paint. The same class is applied by
          Feed's useAppViewportLock, but that only runs after hydration — on a
          phone you can flick the screen before then, which scrolls the document,
          collapses Safari's toolbar and leaves the page offset for the rest of
          the session. A synchronous inline script closes that window. Feed's
          effect is idempotent and still owns removal on unmount. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.classList.add('sy-app-locked')",
        }}
      />
      <Feed initialLooks={looks} initialCursor={cursor} initialVibeThumbs={buildVibeThumbs()} />
    </>
  );
}
