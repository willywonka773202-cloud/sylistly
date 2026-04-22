'use client';
import { Palette, Ruler, WandSparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useProfile } from '@/store/profile';

const SKIN_TONES = ['#f5d0b5', '#ddb192', '#c9a98a', '#a47757', '#7d553e', '#4b3025'];
const BODY_TYPES = ['masc', 'fem', 'androgynous', 'custom'] as const;
const BUDGETS = ['low', 'mid', 'high', 'luxury'] as const;
const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
  masc: 'Male',
  fem: 'Female',
  androgynous: 'Neutral',
  custom: 'Custom',
};

export default function ProfilePage() {
  const profile = useProfile((state) => state.profile);
  const setSkinTone = useProfile((state) => state.setSkinTone);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setTopSize = useProfile((state) => state.setTopSize);
  const setBottomSize = useProfile((state) => state.setBottomSize);
  const setShoeSize = useProfile((state) => state.setShoeSize);
  const setBudget = useProfile((state) => state.setBudget);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);
  const setBrandsFromText = useProfile((state) => state.setBrandsFromText);

  return (
    <PlaceholderScreen
      eyebrow="Profile"
      title="Tune"
      accent="you"
      description="Your preferences now persist locally and feed the look and feel of the builder."
    >
      <div className="grid gap-3">
        <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">Skin tone and silhouette</h2>
              <p className="mt-1 text-[12px] text-muted-2">Changes here update the builder mannequin immediately.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`Select skin tone ${tone}`}
                onClick={() => setSkinTone(tone)}
                className={`h-10 w-10 rounded-full border-2 transition ${
                  profile.skinTone === tone ? 'border-white scale-105' : 'border-transparent'
                }`}
                style={{ backgroundColor: tone }}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {BODY_TYPES.map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => setBodyType(bodyType)}
                className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[.14em] ${
                  profile.bodyType === bodyType
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                {BODY_TYPE_LABELS[bodyType]}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Ruler size={18} />
            </div>
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">Sizing preferences</h2>
              <p className="mt-1 text-[12px] text-muted-2">Keep a quick reference for the pieces you usually shop for.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <label className="text-[11px] text-muted-2">
              Top
              <input
                value={profile.sizes.top || ''}
                onChange={(event) => setTopSize(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                placeholder="M"
              />
            </label>
            <label className="text-[11px] text-muted-2">
              Waist
              <input
                value={profile.sizes.bottom?.waist?.toString() || ''}
                onChange={(event) => setBottomSize(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                placeholder="30"
              />
            </label>
            <label className="text-[11px] text-muted-2">
              Shoe
              <input
                value={profile.sizes.shoe || ''}
                onChange={(event) => setShoeSize(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                placeholder="9"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <WandSparkles size={18} />
            </div>
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-ink">Taste memory</h2>
              <p className="mt-1 text-[12px] text-muted-2">These preferences are stored locally so future search tuning has something to build from.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {BUDGETS.map((budget) => (
              <button
                key={budget}
                type="button"
                onClick={() => setBudget(budget)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] ${
                  profile.stylePrefs.budget === budget
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-[11px] text-muted-2">
            Vibes
            <input
              value={(profile.stylePrefs.vibes || []).join(', ')}
              onChange={(event) => setVibesFromText(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              placeholder="clean girl, streetwear, date night"
            />
          </label>

          <label className="mt-3 block text-[11px] text-muted-2">
            Favorite brands
            <input
              value={(profile.stylePrefs.brands || []).join(', ')}
              onChange={(event) => setBrandsFromText(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              placeholder="Skims, Nike, Zara"
            />
          </label>
        </section>
      </div>
    </PlaceholderScreen>
  );
}
