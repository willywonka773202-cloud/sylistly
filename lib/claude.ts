import Anthropic from '@anthropic-ai/sdk';
import type { Category, Product, SearchIntent } from './types';

const MODEL = 'claude-sonnet-4-6';
const PARSE_TIMEOUT_MS = 2_000;
const RERANK_TIMEOUT_MS = 2_000;

const COLOR_WORDS = [
  'black', 'white', 'grey', 'gray', 'red', 'blue', 'green', 'pink', 'purple',
  'brown', 'tan', 'beige', 'cream', 'navy', 'olive', 'silver', 'gold',
] as const;

const STYLE_WORDS = [
  'crop', 'cropped', 'hoodie', 'tee', 't-shirt', 'tank', 'baggy', 'cargo',
  'puffer', 'trench', 'wayfarer', 'cap', 'beanie', 'samba', 'platform',
  'oversized', 'slim', 'wide-leg', 'wide', 'vintage', 'mini', 'maxi',
] as const;

const BRAND_ALIASES: Array<{ alias: string; brand: string }> = [
  { alias: 'fear of god essentials', brand: 'Essentials' },
  { alias: 'essentials', brand: 'Essentials' },
  { alias: 'nike', brand: 'Nike' },
  { alias: 'adidas', brand: 'Adidas' },
  { alias: 'prada', brand: 'Prada' },
  { alias: 'miu miu', brand: 'Miu Miu' },
  { alias: 'balenciaga', brand: 'Balenciaga' },
  { alias: 'agolde', brand: 'AGOLDE' },
  { alias: 'levi s', brand: "Levi's" },
  { alias: 'levis', brand: "Levi's" },
  { alias: 'stussy', brand: 'Stussy' },
  { alias: 'carhartt', brand: 'Carhartt' },
  { alias: 'dickies', brand: 'Dickies' },
  { alias: 'north face', brand: 'The North Face' },
  { alias: 'the north face', brand: 'The North Face' },
  { alias: 'max mara', brand: 'Max Mara' },
  { alias: 'burberry', brand: 'Burberry' },
  { alias: 'acne studios', brand: 'Acne Studios' },
  { alias: 'supreme', brand: 'Supreme' },
  { alias: 'gucci', brand: 'Gucci' },
  { alias: 'ray ban', brand: 'Ray-Ban' },
  { alias: 'rayban', brand: 'Ray-Ban' },
  { alias: 'oakley', brand: 'Oakley' },
];

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? new Anthropic({ apiKey }) : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferCategory(query: string): Category {
  const normalized = normalizeText(query);
  if (/(shoe|sneaker|boot|loafer|heel|samba|air force)/.test(normalized)) return 'shoes';
  if (/(bag|tote|handbag|purse|backpack)/.test(normalized)) return 'bag';
  if (/(glasses|sunglass|eyewear|wayfarer|aviator)/.test(normalized)) return 'eyewear';
  if (/(ring|necklace|earring|bracelet|jewelry|jewellery)/.test(normalized)) return 'jewelry';
  if (/(jacket|coat|outer|trench|puffer|blazer)/.test(normalized)) return 'outer';
  if (/(pant|jean|skirt|short|trouser|cargo)/.test(normalized)) return 'bottom';
  if (/(hat|cap|beanie|bucket)/.test(normalized)) return 'hat';
  return 'top';
}

function extractBrands(query: string): string[] {
  const normalized = normalizeText(query);
  const brands = BRAND_ALIASES
    .filter(({ alias }) => normalized.includes(alias))
    .map(({ brand }) => brand);
  return Array.from(new Set(brands));
}

function extractColors(query: string): string[] {
  const normalized = normalizeText(query);
  return COLOR_WORDS.filter((color) => normalized.includes(color));
}

function extractStyles(query: string): string[] {
  const normalized = normalizeText(query);
  return STYLE_WORDS.filter((style) => normalized.includes(normalizeText(style)));
}

function parseBudget(query: string): Pick<SearchIntent, 'priceMin' | 'priceMax'> {
  const under = query.match(/\b(?:under|below|max)\s*\$?(\d+(?:\.\d+)?)\b/i);
  if (under?.[1]) {
    return { priceMin: null, priceMax: Number(under[1]) };
  }

  const between = query.match(/\bbetween\s*\$?(\d+(?:\.\d+)?)\s*(?:and|-)\s*\$?(\d+(?:\.\d+)?)\b/i);
  if (between?.[1] && between[2]) {
    return { priceMin: Number(between[1]), priceMax: Number(between[2]) };
  }

  return { priceMin: null, priceMax: null };
}

export function parseSearchIntentHeuristic(query: string, forcedCategory?: Category): SearchIntent {
  const normalized = normalizeText(query);
  const keywords = normalized.split(/\s+/).filter(Boolean);
  const { priceMin, priceMax } = parseBudget(query);

  return {
    category: forcedCategory || inferCategory(query),
    color: extractColors(query),
    brand: extractBrands(query),
    style: extractStyles(query),
    priceMin,
    priceMax,
    gender: null,
    keywords,
  };
}

function scoreCandidate(query: string, intent: SearchIntent, candidate: Product): number {
  const haystack = normalizeText(
    `${candidate.brand} ${candidate.name} ${candidate.retailer}`,
  );

  const terms = new Set<string>([
    ...normalizeText(query).split(/\s+/),
    ...(intent.brand || []).map(normalizeText),
    ...(intent.color || []).map(normalizeText),
    ...(intent.style || []).map(normalizeText),
    ...(intent.keywords || []).map(normalizeText),
  ]);

  let score = candidate.trusted === false ? 0 : 10;

  for (const term of terms) {
    if (!term) continue;
    if (haystack.includes(term)) score += 8;
  }

  if ((intent.brand || []).some((brand) => haystack.includes(normalizeText(brand)))) {
    score += 16;
  }

  if ((intent.color || []).some((color) => haystack.includes(normalizeText(color)))) {
    score += 6;
  }

  return score;
}

function fallbackRerank(
  query: string,
  intent: SearchIntent,
  candidates: Product[],
  limit: number,
): Product[] {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(query, intent, candidate),
    }))
    .sort((a, b) => b.score - a.score);

  const picks: Product[] = [];
  const retailers = new Set<string>();

  for (const { candidate } of scored) {
    if (picks.length >= limit) break;
    const retailer = candidate.retailer.toLowerCase();
    if (retailers.has(retailer) && picks.length + 1 < limit) continue;
    retailers.add(retailer);
    picks.push(candidate);
  }

  if (picks.length >= limit) return picks.slice(0, limit);

  for (const { candidate } of scored) {
    if (picks.length >= limit) break;
    if (picks.includes(candidate)) continue;
    picks.push(candidate);
  }

  return picks.slice(0, limit);
}

/**
 * Parse a natural-language search query into structured intent.
 * "white nike crop top" => { category, color, brand, style, keywords }
 */
export async function parseSearchIntent(
  query: string,
  forcedCategory?: Category,
): Promise<SearchIntent> {
  const fallback = parseSearchIntentHeuristic(query, forcedCategory);
  const client = getClient();

  if (!client) return fallback;

  try {
    const res = await withTimeout(
      client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system:
          `You parse fashion search queries into structured intent for a shopping API. ` +
          `Return STRICT JSON only, no prose. Schema:\n` +
          `{ "category": "hat"|"outer"|"top"|"bottom"|"shoes"|"bag"|"eyewear"|"jewelry", ` +
          `"color": string[], "brand": string[], "style": string[], ` +
          `"priceMin": number|null, "priceMax": number|null, ` +
          `"gender": "masc"|"fem"|"androgynous"|null, "keywords": string[] }`,
        messages: [
          {
            role: 'user',
            content:
              (forcedCategory ? `Slot being filled: ${forcedCategory}. ` : '') +
              `Query: """${query}"""\nReturn JSON only.`,
          },
        ],
      }),
      PARSE_TIMEOUT_MS,
      'Claude intent parse timed out',
    );

    const text = res.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');

    const parsed = JSON.parse(jsonMatch[0]) as SearchIntent;
    if (forcedCategory) parsed.category = forcedCategory;
    parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : fallback.keywords;
    parsed.color = Array.isArray(parsed.color) ? parsed.color : fallback.color;
    parsed.brand = Array.isArray(parsed.brand) ? parsed.brand : fallback.brand;
    parsed.style = Array.isArray(parsed.style) ? parsed.style : fallback.style;
    return parsed;
  } catch {
    return fallback;
  }
}

/**
 * Given candidate products + original query, pick the best 6.
 * Claude re-ranks for brand fit, aesthetic match, and variety.
 */
export async function rerankProducts(
  query: string,
  intent: SearchIntent,
  candidates: Product[],
  limit = 6,
): Promise<Product[]> {
  if (candidates.length <= limit) return candidates;

  const fallback = fallbackRerank(query, intent, candidates, limit);
  const client = getClient();

  if (!client) return fallback;

  const catalog = candidates.map((candidate, index) => ({
    i: index,
    brand: candidate.brand,
    name: candidate.name,
    price: candidate.priceCents / 100,
    retailer: candidate.retailer,
    trusted: candidate.trusted !== false,
  }));

  try {
    const res = await withTimeout(
      client.messages.create({
        model: MODEL,
        max_tokens: 200,
        system:
          `You re-rank shopping results for a fashion app. Pick the ${limit} indices that best match the user's query, ` +
          `favoring (a) strong brand/style match, (b) price variety, (c) different retailers, (d) on-brand aesthetic. ` +
          `Prefer trusted retailers when the product match is similar. ` +
          `Return JSON: { "picks": number[] } — exactly ${limit} indices, no duplicates, in ranked order.`,
        messages: [
          {
            role: 'user',
            content:
              `Query: "${query}"\nIntent: ${JSON.stringify(intent)}\n` +
              `Candidates:\n${JSON.stringify(catalog)}\nReturn JSON only.`,
          },
        ],
      }),
      RERANK_TIMEOUT_MS,
      'Claude rerank timed out',
    );

    const text = res.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');

    const { picks } = JSON.parse(match[0]) as { picks: number[] };
    const validIndices = Array.from(
      new Set(
        (picks || []).filter((index) =>
          Number.isInteger(index) && index >= 0 && index < candidates.length,
        ),
      ),
    );

    const picked = validIndices.map((index) => candidates[index]).filter(Boolean);
    if (picked.length >= limit) return picked.slice(0, limit);

    return [...picked, ...fallback.filter((candidate) => !picked.includes(candidate))]
      .slice(0, limit);
  } catch {
    return fallback;
  }
}

const VISION_TIMEOUT_MS = 22_000;

export type SnapMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface DetectedGarment {
  category: Category;
  label: string; // human label, e.g. "Cream cable-knit sweater"
  query: string; // shopping search query, e.g. "cream oversized cable-knit sweater"
  color?: string;
}

const VALID_CATEGORIES: Category[] = [
  'hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry',
];

/**
 * "Snap to Shop": look at a photo of an outfit and identify each shoppable
 * garment/accessory, with a precise search query for each. Powers the
 * camera -> shoppable-outfit flow. Throws if no vision-capable key is set.
 */
export async function identifyOutfitFromImage(
  imageBase64: string,
  mediaType: SnapMediaType,
): Promise<DetectedGarment[]> {
  const client = getClient();
  if (!client) throw new Error('vision_unavailable');

  const res = await withTimeout(
    client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system:
        `You are a fashion stylist's trained eye. Look at the outfit in the image and identify each ` +
        `distinct shoppable wearable item. For EACH item return: ` +
        `"category" (exactly one of: hat, outer, top, bottom, shoes, bag, eyewear, jewelry), ` +
        `"label" (a short human name, e.g. "Cream cable-knit sweater"), ` +
        `"query" (a precise shopping search query of color + material + cut + item, ` +
        `e.g. "cream oversized cable-knit sweater"), and "color" (the dominant color word). ` +
        `Only include items clearly visible and shoppable. Ignore the person, skin, background, ` +
        `and anything not wearable. At most one item per category (pick the most prominent). ` +
        `Return STRICT JSON only, no prose:\n` +
        `{ "items": [ { "category": string, "label": string, "query": string, "color": string } ] }`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Identify every shoppable clothing item and accessory in this outfit. JSON only.',
            },
          ],
        },
      ],
    }),
    VISION_TIMEOUT_MS,
    'Vision timed out',
  );

  const text = res.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('vision_no_json');

  const parsed = JSON.parse(jsonMatch[0]) as {
    items?: Array<{ category?: string; label?: string; query?: string; color?: string }>;
  };

  const seen = new Set<Category>();
  const garments: DetectedGarment[] = [];
  for (const item of parsed.items || []) {
    const category = item.category as Category;
    const query = (item.query || '').trim();
    if (!query || !VALID_CATEGORIES.includes(category) || seen.has(category)) continue;
    seen.add(category);
    garments.push({
      category,
      label: (item.label || query).slice(0, 64),
      query: query.slice(0, 120),
      color: item.color?.trim() || undefined,
    });
  }
  return garments.slice(0, 8);
}
