import { performance } from 'node:perf_hooks';

const baseUrl = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const searchApiKey = process.env.SEARCHAPI_KEY || process.env.SERPAPI_KEY;

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

async function hitSearch(category, query) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category, query }),
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const data = await response.json();
  return {
    category,
    query,
    elapsedMs,
    ok: response.ok,
    status: response.status,
    count: Array.isArray(data.products) ? data.products.length : 0,
    data,
  };
}

async function logRawSearchApiResponse(query) {
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
  console.log(`Running smoke search against ${baseUrl}`);

  const results = [];
  for (const [category, query] of queries) {
    const outcome = await hitSearch(category, query);
    results.push(outcome);
    console.log(
      `${outcome.ok ? 'OK ' : 'ERR'} ${outcome.elapsedMs}ms [${category}] ${query} -> ${outcome.count} products (status ${outcome.status})`,
    );
    if (!outcome.ok) {
      console.log(`  error: ${outcome.data?.error || 'unknown error'}`);
    }
  }

  const timings = results.map((result) => result.elapsedMs);
  console.log(`\np50 latency: ${percentile(timings, 50)}ms`);
  console.log(`p95 latency: ${percentile(timings, 95)}ms`);

  await logRawSearchApiResponse(queries[0][1]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
