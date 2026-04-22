import Link from 'next/link';
import { ArrowRight, Glasses, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Curated vibes',
    body: 'Jump directly into the builder with a strong first prompt instead of starting from a blank mannequin.',
    href: '/?slot=top&query=white%20crop%20top',
    cta: 'Start with a clean top',
  },
  {
    icon: Shirt,
    title: 'Tap-to-style looks',
    body: 'Kick off an outerwear pass and then keep swapping pieces once the search sheet opens.',
    href: '/?slot=outer&query=oversized%20leather%20jacket',
    cta: 'Search outerwear',
  },
  {
    icon: ShoppingBag,
    title: 'Retailer mix',
    body: 'Build around a statement bag or accessory when you want the whole fit to orbit one item.',
    href: '/?slot=bag&query=structured%20black%20mini%20bag',
    cta: 'Find a statement bag',
  },
  {
    icon: Glasses,
    title: 'Saved taste profile',
    body: 'Use a trend shortcut to generate fast demo or live results for the piece that sets the tone.',
    href: '/?slot=eyewear&query=oval%20black%20sunglasses',
    cta: 'Browse eyewear',
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
        {FEATURES.map(({ icon: Icon, title, body, href, cta }) => (
          <section key={title} className="rounded-3xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[.18em] text-muted">Quick start</div>
                <h2 className="mt-1 font-serif text-[18px] font-semibold text-ink">{title}</h2>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-2">{body}</p>
            <Link
              href={href}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-white"
            >
              {cta}
              <ArrowRight size={13} />
            </Link>
          </section>
        ))}
      </div>
    </PlaceholderScreen>
  );
}
