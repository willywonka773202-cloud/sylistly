import { performance } from 'node:perf_hooks';
import { hasDirectRetailerUrl, hydrateRetailerUrls, searchShopping } from '../lib/serpapi.ts';

const queries = [
  ['top', 'white nike crop top'],
  ['top', 'essentials hoodie'],
  ['top', 'prada tee'],
  ['bottom', 'baggy jeans'],
  ['bottom', 'black cargo pants'],
  ['shoes', 'air force 1 white'],
  ['shoes', 'samba'],
  ['outer', 'north face puffer'],
  ['outer', 'trench coat'],
  ['hat', 'supreme cap'],
  ['bag', 'gucci bag'],
  ['eyewear', 'ray ban wayfarer'],
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function buildIntent(category, query) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return {
    category,
    color: [],
    brand: [],
    style: [],
    priceMin: null,
    priceMax: null,
    gender: null,
    keywords: normalized ? normalized.split(/\s+/) : [],
  };
}

async function logRawSearchApiResponse(query) {
  const searchApiKey = process.env.SEARCHAPI_KEY || process.env.SERPAPI_KEY;
  if (!searchApiKey) {
    console.log('SEARCHAPI_KEY is missing, skipping raw SearchAPI shape dump.');
    return;
  }

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    hl: 'en',
    gl: 'us',
    location: 'United States',
  });

  const response = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${searchApiKey}`,
    },
  });
  const data = await response.json();
  const sample = Array.isArray(data.shopping_results) ? data.shopping_results[0] : null;

  console.log('\nRaw SearchAPI sample for sanity-check:');
  console.log(JSON.stringify(sample, null, 2));
}

async function main() {
  if (!process.env.SEARCHAPI_KEY && !process.env.SERPAPI_KEY) {
    console.error('SEARCHAPI_KEY is missing in .env.local');
    process.exitCode = 1;
    return;
  }

  const durations = [];

  for (const [category, query] of queries) {
    const startedAt = performance.now();

    try {
      const intent = buildIntent(category, query);
      const candidates = await searchShopping(intent, query);
      const hydrated = await hydrateRetailerUrls(candidates.slice(0, 8));
      const selected = hydrated.filter((product) => hasDirectRetailerUrl(product.retailerUrl)).slice(0, 6);
      const results = selected.length >= 4 ? selected : hydrated.slice(0, 6);
      const elapsedMs = Math.round(performance.now() - startedAt);
      durations.push(elapsedMs);

      console.log(
        `OK  ${elapsedMs}ms [${category}] ${query} -> ${results.length} products`,
      );

      results.forEach((product, index) => {
        console.log(
          `  ${index + 1}. ${product.brand} | ${product.name} | ${product.retailer} | $${(product.priceCents / 100).toFixed(2)} | trusted=${product.trusted !== false} | ${product.retailerUrl}`,
        );
      });
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - startedAt);
      durations.push(elapsedMs);
      console.log(`ERR ${elapsedMs}ms [${category}] ${query} -> ${String(error)}`);
    }
  }

  console.log(`\np50 latency: ${percentile(durations, 50)}ms`);
  console.log(`p95 latency: ${percentile(durations, 95)}ms`);

  await logRawSearchApiResponse(queries[0][1]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
