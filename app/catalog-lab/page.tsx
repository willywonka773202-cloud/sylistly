import { ALL_CATALOG_PRODUCTS } from '@/lib/catalog';
import { validateProduct } from '@/lib/catalog-schemas/product.v2';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import type { ReactNode } from 'react';

const imageBlockingCodes = new Set([
  'IMAGE_URL_DATA_URL',
  'IMAGE_URL_SVG_DATA',
  'IMAGE_URL_SEARCH_INTENT',
  'IMAGE_URL_PLACEHOLDER',
  'IMAGE_URL_UNSAFE_HOST',
  'IMAGE_URL_NOT_STRING',
  'MISSING_IMAGE_URL',
]);

function isUnsafeImage(product: Product): boolean {
  return validateProduct(product).issues.some((issue) => imageBlockingCodes.has(issue.code));
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function topEntries(record: Record<string, number>, limit: number) {
  return Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export default function CatalogLabPage() {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const safeProducts = products.filter((product) => !isUnsafeImage(product));
  const transparentProducts = products.filter((product) => Boolean(product.imageTransparentUrl));
  const needsCutout = safeProducts.filter((product) => !product.imageTransparentUrl);
  const unsafeImages = products.length - safeProducts.length;
  const categoryCounts = countBy(products.map((product) => product.category as Category));
  const brandCounts = countBy(products.map((product) => product.brand || 'Unknown'));
  const thinCategories = CATEGORY_ORDER
    .map((category) => ({ category, count: categoryCounts[category] || 0 }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 5);
  const progress = Math.round((transparentProducts.length / Math.max(1, safeProducts.length)) * 100);
  const firstCandidates = needsCutout
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .slice(0, 20);
  const readyProducts = transparentProducts.slice(0, 20);

  return (
    <main className="min-h-screen bg-[#f7efe6] px-4 pb-24 pt-6 text-[#2c2118]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="rounded-[28px] border border-[#eadfd3] bg-white/80 p-5 shadow-[0_20px_60px_rgba(70,45,24,.08)]">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#9a7660]">Catalog Lab · local read-only</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Database and cutout dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#6f5a49]">
            Read-only visibility into runtime catalog coverage, transparent asset progress, and the next expansion gaps.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total products" value={products.length} />
          <Stat label="Transparent products" value={transparentProducts.length} />
          <Stat label="Needs cutout" value={needsCutout.length} />
          <Stat label="Unsafe images" value={unsafeImages} />
        </section>

        <section className="rounded-[24px] border border-[#eadfd3] bg-white/78 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Cutout progress</h2>
              <p className="text-sm font-semibold text-[#7d6755]">{transparentProducts.length} of {safeProducts.length} safe products registered</p>
            </div>
            <div className="text-2xl font-black">{progress}%</div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#eadfd3]">
            <div className="h-full rounded-full bg-[#2f5d50]" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Top categories">
            {CATEGORY_ORDER.map((category) => (
              <MetricRow key={category} label={category} value={categoryCounts[category] || 0} />
            ))}
          </Panel>
          <Panel title="Thin categories">
            {thinCategories.map((row) => (
              <MetricRow key={row.category} label={row.category} value={row.count} />
            ))}
          </Panel>
          <Panel title="Top brands">
            {topEntries(brandCounts, 8).map(([brand, count]) => (
              <MetricRow key={brand} label={brand} value={count} />
            ))}
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ProductList title="First cutout candidates" products={firstCandidates} empty="No candidates pending." />
          <ProductList title="Transparent-ready products" products={readyProducts} empty="No transparent assets registered yet." />
        </section>

        <section className="rounded-[24px] border border-[#eadfd3] bg-white/78 p-5">
          <h2 className="text-lg font-black">SearchAPI can help with</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Note title="Category gaps" body="Find reviewed candidate products for thin categories like eyewear, jewelry, bags, and shoes." />
            <Note title="Better originals" body="Resolve cleaner merchant images for unsafe or low-quality image records before cutout processing." />
            <Note title="Product URL gaps" body="Fill missing productUrl or retailerUrl fields so candidates can be reviewed before any live merge." />
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-[#eadfd3] bg-white/78 p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#8a6d59]">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#eadfd3] bg-white/78 p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8f1e9] px-3 py-2 text-sm font-bold">
      <span className="truncate capitalize text-[#5d4b3d]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ProductList({ title, products, empty }: { title: string; products: Product[]; empty: string }) {
  return (
    <section className="rounded-[24px] border border-[#eadfd3] bg-white/78 p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-3 grid gap-2">
        {products.length === 0 ? (
          <p className="text-sm font-semibold text-[#7d6755]">{empty}</p>
        ) : (
          products.map((product) => (
            <div key={product.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl bg-[#f8f1e9] p-2">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageTransparentUrl || product.imageUrl} alt="" className="h-full w-full object-contain p-1.5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{product.brand}</div>
                <div className="truncate text-xs font-semibold text-[#7d6755]">{product.name}</div>
              </div>
              <div className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#7b614f]">
                {product.category}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-[#f8f1e9] p-4">
      <h3 className="text-sm font-black">{title}</h3>
      <p className="mt-1 text-sm font-semibold leading-5 text-[#6f5a49]">{body}</p>
    </div>
  );
}
