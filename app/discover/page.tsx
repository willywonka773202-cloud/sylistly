import { Glasses, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Curated vibes',
    body: 'Editorial look packs and creator outfits are next on deck so discovery feels more like inspiration than search.',
  },
  {
    icon: Shirt,
    title: 'Tap-to-style looks',
    body: 'You will be able to pull a full fit into the builder, swap one piece, and keep iterating without starting over.',
  },
  {
    icon: ShoppingBag,
    title: 'Retailer mix',
    body: 'Discover will prioritize trusted stores first so the outfits look polished and the links stay clean.',
  },
  {
    icon: Glasses,
    title: 'Saved taste profile',
    body: 'Your vibe, brands, and budget will eventually shape what shows up here before you ever type a query.',
  },
];

export default function DiscoverPage() {
  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Style"
      accent="next"
      description="This tab is no longer a broken route. It is staged as the next polished screen while the builder remains the main working flow."
    >
      <div className="grid gap-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <section key={title} className="rounded-3xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[.18em] text-muted">Planned</div>
                <h2 className="mt-1 font-serif text-[18px] font-semibold text-ink">{title}</h2>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-2">{body}</p>
          </section>
        ))}
      </div>
    </PlaceholderScreen>
  );
}
