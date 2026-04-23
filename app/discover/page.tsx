import Link from 'next/link';
import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { getCollectionProducts, getFeaturedCatalogProducts, LAUNCH_COLLECTIONS } from '@/lib/catalog';

const FEATURED_PRODUCTS = getFeaturedCatalogProducts(8);

export default function DiscoverPage() {
  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Style"
      accent="library"
      description="Sylistly now has a launch-ready discovery tab built around curated catalog collections and featured inventory."
    >
      <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.18em] text-muted">Curated collections</div>
            <h2 className="mt-1 font-serif text-[18px] font-semibold text-ink">Start from a full outfit direction</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {LAUNCH_COLLECTIONS.map((collection) => {
            const products = getCollectionProducts(collection);
            return (
              <section key={collection.id} className="rounded-3xl border border-hairline bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[.18em] text-muted">
                      {collection.frame === 'all' ? 'Any frame' : collection.frame === 'masc' ? 'Male frame' : 'Female frame'} · {collection.vibe}
                    </div>
                    <h3 className="mt-1 font-serif text-[18px] font-semibold text-ink">{collection.label}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-2">{collection.blurb}</p>
                  </div>
                  <div className="rounded-full bg-surface-3 px-3 py-1 text-[10px] uppercase tracking-[.16em] text-muted">
                    {products.length} picks
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {products.map((product) => (
                    <span
                      key={product.id}
                      className="rounded-full border border-hairline bg-surface-1 px-3 py-1 text-[10px] uppercase tracking-[.12em] text-muted-2"
                    >
                      {product.brand}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/?vibe=${collection.vibe}&frame=${collection.frame === 'all' ? 'androgynous' : collection.frame}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-white"
                >
                  Open in builder
                  <ArrowRight size={13} />
                </Link>
              </section>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-3xl border border-hairline bg-surface-1 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
            <ShoppingBag size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.18em] text-muted">Featured inventory</div>
            <h2 className="mt-1 font-serif text-[18px] font-semibold text-ink">Starter products already in Sylistly</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {FEATURED_PRODUCTS.map((product) => (
            <section key={product.id} className="rounded-3xl border border-hairline bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[.18em] text-muted">{product.category}</div>
                  <h3 className="mt-1 font-serif text-[18px] font-semibold text-ink">{product.brand}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-2">{product.name}</p>
                </div>
                <div className="rounded-full bg-surface-3 px-3 py-1 text-[12px] font-semibold text-ink">
                  ${(product.priceCents / 100).toLocaleString()}
                </div>
              </div>

              <Link
                href={`/?slot=${product.category}&query=${encodeURIComponent(product.brand)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-white"
              >
                Find similar
                <ArrowRight size={13} />
              </Link>
            </section>
          ))}
        </div>
      </section>
    </PlaceholderScreen>
  );
}
