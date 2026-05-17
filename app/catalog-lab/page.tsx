import { ALL_CATALOG_PRODUCTS } from '@/lib/catalog';
import { validateProduct } from '@/lib/catalog-schemas/product.v2';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function emptyCategoryRecord() {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<Category, number>;
}

function transparentFileExists(product: Product): boolean {
  if (!product.imageTransparentUrl?.startsWith('/assets/')) return false;
  return existsSync(join(process.cwd(), 'public', product.imageTransparentUrl.replace(/^\//, '')));
}

type CutoutRunItem = {
  id: string;
  brand?: string;
  name?: string;
  category?: Category;
  status?: string;
  outputPath?: string;
  reason?: string;
};

function latestCutoutRun(): { generated: CutoutRunItem[]; failed: CutoutRunItem[] } {
  const reportPath = join(process.cwd(), 'data', 'catalog', 'cutout-reviewed', 'cutout-run-report.json');
  if (!existsSync(reportPath)) return { generated: [], failed: [] };
  try {
    const parsed = JSON.parse(readFileSync(reportPath, 'utf8')) as { items?: CutoutRunItem[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      generated: items.filter((item) => item.status === 'generated').slice(0, 30),
      failed: items.filter((item) => item.status === 'failed' || item.status === 'blocked').slice(0, 12),
    };
  } catch {
    return { generated: [], failed: [] };
  }
}

const transparentTargets: Record<Category, number> = {
  hat: 10,
  outer: 20,
  top: 25,
  bottom: 25,
  shoes: 20,
  bag: 10,
  eyewear: 8,
  jewelry: 8,
};

const nextBatchCategories: Category[] = ['bottom', 'shoes', 'outer', 'bag', 'hat', 'jewelry'];

export default function CatalogLabPage() {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const safeProducts = products.filter((product) => !isUnsafeImage(product));
  const transparentProducts = products.filter((product) => Boolean(product.imageTransparentUrl));
  const needsCutout = safeProducts.filter((product) => !product.imageTransparentUrl);
  const unsafeImages = products.length - safeProducts.length;
  const categoryCounts = countBy(products.map((product) => product.category as Category));
  const transparentByCategory = emptyCategoryRecord();
  const originalOnlyByCategory = emptyCategoryRecord();
  const unsafeByCategory = emptyCategoryRecord();
  for (const product of products) {
    const category = product.category as Category;
    if (product.imageTransparentUrl) transparentByCategory[category] += 1;
    else if (isUnsafeImage(product)) unsafeByCategory[category] += 1;
    else originalOnlyByCategory[category] += 1;
  }
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
  const transparentPreviewProducts = transparentProducts.slice(0, 48);
  const latestRun = latestCutoutRun();
  const nextBatch = nextBatchCategories
    .map((category) => ({
      category,
      transparent: transparentByCategory[category],
      target: transparentTargets[category],
      originalOnly: originalOnlyByCategory[category],
      priority: Math.max(0, transparentTargets[category] - transparentByCategory[category]),
    }))
    .filter((row) => row.originalOnly > 0)
    .sort((a, b) => b.priority - a.priority || b.originalOnly - a.originalOnly);

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
          <div className="mt-4 rounded-2xl border border-[#f0d5c4] bg-[#fff7ef] p-3 text-sm font-black text-[#7a3f22]">
            Do not enable transparent-only until readiness passes.
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Transparent by category">
            {CATEGORY_ORDER.map((category) => (
              <ProgressRow
                key={category}
                label={category}
                value={transparentByCategory[category]}
                target={transparentTargets[category]}
              />
            ))}
          </Panel>
          <Panel title="Original-only by category">
            {CATEGORY_ORDER.map((category) => (
              <MetricRow key={category} label={category} value={originalOnlyByCategory[category]} />
            ))}
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Weak category progress">
            {nextBatchCategories.map((category) => (
              <ProgressRow
                key={category}
                label={category}
                value={transparentByCategory[category]}
                target={transparentTargets[category]}
              />
            ))}
          </Panel>
          <Panel title="Latest generated cutouts">
            {latestRun.generated.length === 0 ? (
              <p className="text-sm font-semibold text-[#7d6755]">No recent generated cutout report found.</p>
            ) : (
              latestRun.generated.slice(0, 8).map((item) => (
                <MetricRow key={item.id} label={`${item.category || 'item'} - ${item.name || item.id}`} value={1} />
              ))
            )}
          </Panel>
          <Panel title="Next recommended batch">
            {nextBatch.slice(0, 6).map((row) => (
              <MetricRow key={row.category} label={`${row.category} gap ${row.transparent}/${row.target}`} value={Math.min(row.originalOnly, row.priority)} />
            ))}
          </Panel>
        </section>

        <section className="rounded-[24px] border border-[#eadfd3] bg-white/78 p-5">
          <h2 className="text-lg font-black">Failed cutouts</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {latestRun.failed.length === 0 ? (
              <p className="text-sm font-semibold text-[#7d6755]">Latest run reported no failed or blocked cutouts.</p>
            ) : (
              latestRun.failed.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#fff0ec] p-3 text-sm font-semibold text-[#763b2c]">
                  <div className="font-black">{item.name || item.id}</div>
                  <div>{item.category || 'unknown'} - {item.reason || item.status}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#b7d8c7] bg-[#f8fbf7] p-4 shadow-[0_20px_70px_rgba(31,72,54,.1)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#2f6f55]">Transparent Asset Preview</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Original image beside registered transparent PNG</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#597060]">
                This section uses only runtime products with imageTransparentUrl. The right image is shown on a checkerboard so the alpha channel is visually obvious.
              </p>
            </div>
            <div className="rounded-full bg-[#2f6f55] px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-white">
              {transparentPreviewProducts.length} shown
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transparentPreviewProducts.map((product) => (
              <TransparentPreviewCard key={product.id} product={product} />
            ))}
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

function checkerStyle() {
  return {
    backgroundColor: '#f8faf7',
    backgroundImage:
      'linear-gradient(45deg, rgba(47,111,85,.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(47,111,85,.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(47,111,85,.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(47,111,85,.18) 75%)',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
    backgroundSize: '20px 20px',
  };
}

function TransparentPreviewCard({ product }: { product: Product }) {
  const exists = transparentFileExists(product);
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#d8eadf] bg-white shadow-[0_18px_48px_rgba(31,72,54,.1)]">
      <div className="grid grid-cols-2 gap-0">
        <div className="border-r border-[#e4eee7] bg-[#fbf5ec] p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-[#8b6b55]">Original</div>
          <div className="grid aspect-square place-items-center rounded-2xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" data-image-kind="original" />
          </div>
        </div>
        <div className="p-3" style={checkerStyle()}>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-[#245f49]">Transparent</div>
          <div className="grid aspect-square place-items-center rounded-2xl bg-white/35">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageTransparentUrl}
              alt=""
              className="h-full w-full object-contain p-3 drop-shadow-[0_24px_22px_rgba(0,0,0,.4)]"
              data-image-kind="transparent"
            />
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#2f6f55] px-2 py-1 text-[10px] font-black uppercase tracking-[.13em] text-white">transparent</span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[.13em] ${exists ? 'bg-[#e7f5ed] text-[#245f49]' : 'bg-[#ffe3df] text-[#8c2d22]'}`}>
            file exists: {exists ? 'yes' : 'no'}
          </span>
          <span className="rounded-full bg-[#f3eee7] px-2 py-1 text-[10px] font-black uppercase tracking-[.13em] text-[#715846]">{product.category}</span>
        </div>
        <div>
          <div className="truncate text-sm font-black">{product.brand}</div>
          <div className="line-clamp-2 text-sm font-semibold leading-5 text-[#5f4c3d]">{product.name}</div>
        </div>
        <div className="rounded-2xl bg-[#f6f0e9] p-2 text-[10px] font-semibold leading-4 text-[#6b5748]">
          <div className="break-all">id: {product.id}</div>
          <div className="mt-1 break-all">src: {product.imageTransparentUrl}</div>
        </div>
      </div>
    </article>
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

function ProgressRow({ label, value, target }: { label: string; value: number; target: number }) {
  const width = `${Math.min(100, Math.round((value / Math.max(1, target)) * 100))}%`;
  return (
    <div className="rounded-2xl bg-[#f8f1e9] px-3 py-2">
      <div className="flex items-center justify-between gap-4 text-sm font-bold">
        <span className="truncate capitalize text-[#5d4b3d]">{label}</span>
        <span>{value}/{target}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eadfd3]">
        <div className="h-full rounded-full bg-[#2f5d50]" style={{ width }} />
      </div>
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
