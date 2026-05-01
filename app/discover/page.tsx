import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { ProductImage } from '@/components/ProductImage';
import { getCollectionProducts, LAUNCH_COLLECTIONS } from '@/lib/catalog';

export default function DiscoverPage() {
  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Style"
      accent="library"
      description="Browse curated visual outfit boards, then open any direction directly in Builder."
    >
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,#141311_0%,#0f0f0e_100%)] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent"><Sparkles size={18} /></div>
          <div>
            <div className="text-[11px] uppercase tracking-[.18em] text-muted">Style library</div>
            <h2 className="mt-1 font-serif text-[22px] font-semibold text-[#fff5ee]">Curated visual outfit cards</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {LAUNCH_COLLECTIONS.map((collection) => {
            const products = getCollectionProducts(collection);
            const total = products.reduce((sum, p) => sum + p.priceCents, 0);
            return (
              <section key={collection.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[.18em] text-[#9e8f85]">{collection.vibe} · {collection.frame}</div>
                    <h3 className="mt-1 font-serif text-[20px] font-semibold text-[#fff5ee]">{collection.label}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#c7b7ad]">{collection.blurb}</p>
                  </div>
                  <div className="rounded-full bg-surface-3 px-3 py-1 text-[10px] uppercase tracking-[.16em] text-muted">{products.length} pcs</div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {products.slice(0, 4).map((product) => (
                    <div key={product.id} className="rounded-xl border border-hairline bg-white/70 p-1.5">
                      <div className="h-16"><ProductImage product={product} className="h-full w-full object-contain p-1" /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-2">
                  <span>{collection.frame === 'all' ? 'Any frame' : collection.frame === 'masc' ? 'Male bias' : 'Female bias'}</span>
                  <span>${(total / 100).toLocaleString()} est.</span>
                </div>
                <Link href={`/?vibe=${collection.vibe}&frame=${collection.frame === 'all' ? 'androgynous' : collection.frame}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-white">
                  Open in builder <ArrowRight size={13} />
                </Link>
              </section>
            );
          })}
        </div>
      </section>
    </PlaceholderScreen>
  );
}
