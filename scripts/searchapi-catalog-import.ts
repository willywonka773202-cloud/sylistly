import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SearchApiResult = {
  title?: string;
  link?: string;
  product_link?: string;
  source?: string;
  snippet?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  image?: string;
};

const SEARCHAPI_ENDPOINT = process.env.SEARCHAPI_ENDPOINT || 'https://www.searchapi.io/api/v1/search';
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY?.trim();

const QUERIES = [
  'men capsule wardrobe basics products',
  'women capsule wardrobe basics products',
  'men streetwear cargos hoodie sneakers',
  'women clean girl cardigan jeans sneakers bag',
  'men old money loafers trousers polo blazer',
  'women old money blazer trousers flats bag',
  'men gym shorts hoodie trainers',
  'women gym leggings tank sneakers',
  'men date night jacket boots shirt',
  'women date night dress heels bag',
  'college campus outfits men products',
  'college campus outfits women products',
  'airport travel outfit essentials unisex',
  'budget fashion basics men women sneakers jeans tees',
  'premium fashion accessories bags sunglasses jewelry',
  'popular sneakers outfit styling products',
];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 56);
}

function inferGender(query: string): Array<'masc' | 'fem' | 'androgynous'> {
  if (query.includes('women')) return ['fem', 'androgynous'];
  if (query.includes('men')) return ['masc', 'androgynous'];
  return ['androgynous'];
}

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (/sneaker|shoe|trainer|loafer|boot|heel|flat|sandal/.test(lower)) return 'shoes';
  if (/bag|tote|backpack|crossbody|duffel/.test(lower)) return 'bag';
  if (/sunglass|eyewear|glasses/.test(lower)) return 'eyewear';
  if (/necklace|ring|earring|bracelet|watch|jewelry/.test(lower)) return 'jewelry';
  if (/cap|hat|beanie/.test(lower)) return 'hat';
  if (/jacket|coat|blazer|hoodie|cardigan|sweater|puffer|trench/.test(lower)) return 'outer';
  if (/jean|pant|trouser|cargo|short|legging|skirt/.test(lower)) return 'bottom';
  return 'top';
}

function inferVibes(query: string, text: string) {
  const lower = `${query} ${text}`.toLowerCase();
  return [
    lower.includes('street') ? 'streetwear' : null,
    lower.includes('clean') ? 'clean' : null,
    lower.includes('old money') ? 'old money' : null,
    lower.includes('gym') ? 'gym' : null,
    lower.includes('date') ? 'date night' : null,
    lower.includes('campus') || lower.includes('college') ? 'campus' : null,
    lower.includes('airport') || lower.includes('travel') ? 'travel' : null,
    lower.includes('premium') ? 'luxury' : null,
    lower.includes('budget') ? 'budget' : null,
  ].filter((vibe): vibe is string => Boolean(vibe));
}

function priceToCents(result: SearchApiResult) {
  if (typeof result.extracted_price === 'number') return Math.round(result.extracted_price * 100);
  const match = result.price?.match(/\$?([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Math.round(Number(match[1]) * 100) : 7900;
}

function normalizeResult(query: string, result: SearchApiResult) {
  const title = result.title?.replace(/\s+/g, ' ').trim();
  const url = result.product_link || result.link || '';
  if (!title || !url) return null;
  const category = inferCategory(`${title} ${result.snippet || ''}`);
  const brand = result.source || title.split(' ')[0] || 'Retailer';
  const priceCents = priceToCents(result);
  return {
    id: `searchapi-${slug(brand)}-${slug(title)}`,
    brand,
    name: title,
    category,
    priceCents,
    currency: 'USD',
    retailer: brand,
    retailerUrl: url,
    productUrl: url,
    imageUrl: result.thumbnail || result.image || '',
    imageOriginalUrl: result.thumbnail || result.image || '',
    inStock: true,
    trusted: false,
    vibes: inferVibes(query, `${title} ${result.snippet || ''}`),
    occasions: inferVibes(query, `${title} ${result.snippet || ''}`),
    gender: inferGender(query),
    sourceQuery: query,
    imageQuality: result.thumbnail || result.image ? 'ok' : 'missing',
    metadata: {
      source: 'searchapi',
      importedAt: new Date().toISOString(),
    },
  };
}

async function search(query: string): Promise<SearchApiResult[]> {
  const url = new URL(SEARCHAPI_ENDPOINT);
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', SEARCHAPI_KEY || '');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SearchAPI failed for "${query}" with ${response.status}`);
  const json = await response.json() as { shopping_results?: SearchApiResult[]; organic_results?: SearchApiResult[] };
  return json.shopping_results || json.organic_results || [];
}

async function main() {
  if (!SEARCHAPI_KEY) {
    throw new Error('SEARCHAPI_KEY is required. Add it to .env.local; never commit the key.');
  }

  const candidates = new Map<string, unknown>();
  for (const query of QUERIES) {
    const results = await search(query);
    for (const result of results.slice(0, 12)) {
      const normalized = normalizeResult(query, result);
      if (!normalized) continue;
      candidates.set(`${normalized.brand}:${normalized.name}:${normalized.category}`.toLowerCase(), normalized);
    }
    console.log(`Imported ${results.length} raw results for "${query}"`);
  }

  const outputDir = path.join(process.cwd(), 'data');
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'searchapi-catalog-candidates.json');
  await writeFile(outputPath, `${JSON.stringify(Array.from(candidates.values()), null, 2)}\n`, 'utf8');
  console.log(`Wrote ${candidates.size} normalized catalog candidates to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

