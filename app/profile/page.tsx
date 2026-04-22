import { Palette, Ruler, WandSparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

const SETUP_ITEMS = [
  {
    icon: Palette,
    title: 'Skin tone and mannequin',
    body: 'Profile will drive the mannequin skin tone and visual defaults so the builder feels personal instead of generic.',
  },
  {
    icon: Ruler,
    title: 'Sizing preferences',
    body: 'Top, bottom, and shoe preferences will help the product mix get narrower and cleaner over time.',
  },
  {
    icon: WandSparkles,
    title: 'Taste memory',
    body: 'Budget, favorite brands, and style adjectives will feed search prompts so your first results feel closer to the video reference.',
  },
];

export default function ProfilePage() {
  return (
    <PlaceholderScreen
      eyebrow="Profile"
      title="Tune"
      accent="you"
      description="This screen now loads cleanly and shows what is planned, instead of routing to a 404 while the builder is under active work."
    >
      <div className="grid gap-3">
        {SETUP_ITEMS.map(({ icon: Icon, title, body }) => (
          <section key={title} className="rounded-3xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">{title}</h2>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-2">{body}</p>
          </section>
        ))}
      </div>
    </PlaceholderScreen>
  );
}
