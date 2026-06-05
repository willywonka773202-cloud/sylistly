import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORY_ORDER, type Category, type Product } from './types';

export type VisionProvider = 'gemini' | 'local';

export type ProductFormality =
  | 'casual'
  | 'smart-casual'
  | 'office'
  | 'dressy'
  | 'athletic'
  | 'unknown';

export interface ProductVisionAnalysis {
  productId: string;
  provider: VisionProvider;
  model: string;
  category: Category;
  categoryConfidence: number;
  subcategory: string;
  colors: string[];
  materials: string[];
  patterns: string[];
  silhouette: string[];
  formality: ProductFormality;
  seasons: string[];
  occasions: string[];
  vibes: string[];
  compatibleWith: string[];
  avoidWith: string[];
  imageQualityFlags: string[];
  transparentCutoutScore: number;
  reasoningSummary: string;
  generatedAt: string;
}

export interface AnalyzeProductVisionOptions {
  origin?: string;
  forceProvider?: VisionProvider;
}

interface ImagePayload {
  bytes: Buffer;
  mimeType: string;
  sourceUrl: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_MAX_IMAGE_BYTES = 6_000_000;
const CATEGORY_SET = new Set<Category>(CATEGORY_ORDER);
const FORMALITY_SET = new Set<ProductFormality>(['casual', 'smart-casual', 'office', 'dressy', 'athletic', 'unknown']);

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function configuredProvider(): VisionProvider {
  const provider = process.env.CATALOG_VISION_PROVIDER?.trim().toLowerCase();
  return provider === 'gemini' ? 'gemini' : 'local';
}

export function getCatalogVisionConfig() {
  const provider = configuredProvider();
  return {
    enabled: envFlag('CATALOG_VISION_ENABLED'),
    provider,
    model: provider === 'gemini'
      ? process.env.CATALOG_VISION_MODEL?.trim() || DEFAULT_GEMINI_MODEL
      : 'local-heuristic',
    hasProviderKey: provider === 'gemini' ? Boolean(process.env.GEMINI_API_KEY?.trim()) : false,
    requiresAdminToken: provider !== 'local' && envFlag('CATALOG_VISION_ENABLED') && Boolean(process.env.CATALOG_VISION_ADMIN_TOKEN?.trim()),
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function listFromProduct(product: Product, key: 'colors' | 'vibes' | 'occasions' | 'searchTerms'): string[] {
  const values = product[key];
  return Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim()) : [];
}

function metadataList(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
  if (typeof value === 'string') return value.split(/[,|]/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function compactStrings(values: string[], limit = 10): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function inferSubcategory(product: Product): string {
  const haystack = normalizeText([
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...listFromProduct(product, 'searchTerms'),
    ...metadataList(product, 'productType'),
    ...metadataList(product, 'keywords'),
  ].filter(Boolean).join(' '));

  const checks: Array<[string, string[]]> = [
    ['blazer', ['blazer']],
    ['coat', ['coat', 'balmacaan', 'trench']],
    ['jacket', ['jacket', 'windbreaker', 'puffer', 'bomber', 'hooded']],
    ['hoodie', ['hoodie', 'sweatshirt']],
    ['button-down', ['button down', 'buttondown', 'shirt']],
    ['polo', ['polo']],
    ['tee', ['tee', 't shirt', 'tshirt']],
    ['tank', ['tank']],
    ['sweater', ['sweater', 'knit', 'cardigan']],
    ['trouser', ['trouser', 'suit pant', 'dress pant']],
    ['jean', ['jean', 'denim']],
    ['cargo pant', ['cargo']],
    ['skirt', ['skirt']],
    ['sneaker', ['sneaker', 'samba', 'chuck', 'air force']],
    ['loafer', ['loafer']],
    ['boot', ['boot']],
    ['heel', ['heel', 'pump', 'slingback']],
    ['sandal', ['sandal', 'birkenstock']],
    ['tote', ['tote', 'shopping bag']],
    ['shoulder bag', ['shoulder', 'hobo', 'crossbody']],
    ['cap', ['cap', 'hat']],
    ['beanie', ['beanie']],
    ['sunglasses', ['sunglasses', 'frames']],
    ['watch', ['watch']],
    ['ring', ['ring']],
    ['earrings', ['earring', 'hoop']],
  ];
  return checks.find(([, terms]) => terms.some((term) => haystack.includes(term)))?.[0] || product.category;
}

function inferMaterials(product: Product): string[] {
  const haystack = normalizeText([
    product.name,
    product.sourceQuery,
    ...listFromProduct(product, 'searchTerms'),
    ...metadataList(product, 'description'),
  ].join(' '));
  const materials = [
    'cotton',
    'denim',
    'leather',
    'suede',
    'linen',
    'wool',
    'mesh',
    'nylon',
    'canvas',
    'silk',
    'satin',
    'knit',
    'raffia',
  ];
  return compactStrings(materials.filter((material) => haystack.includes(material)), 6);
}

function inferPatterns(product: Product): string[] {
  const haystack = normalizeText([product.name, product.sourceQuery, ...listFromProduct(product, 'searchTerms')].join(' '));
  const patterns = ['solid', 'striped', 'plaid', 'check', 'graphic', 'logo', 'floral', 'mosaic'];
  const found = patterns.filter((pattern) => haystack.includes(pattern));
  return found.length ? compactStrings(found, 5) : ['solid'];
}

function inferFormality(product: Product): ProductFormality {
  const haystack = normalizeText([
    product.name,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
  ].join(' '));
  if (['gym', 'athletic', 'running', 'workout', 'sport'].some((term) => haystack.includes(term))) return 'athletic';
  if (['office', 'work', 'tailored', 'blazer', 'trouser', 'loafer', 'suit'].some((term) => haystack.includes(term))) return 'office';
  if (['date', 'night', 'dressy', 'heel', 'satin', 'polish'].some((term) => haystack.includes(term))) return 'dressy';
  if (['preppy', 'smart', 'polo', 'sweater'].some((term) => haystack.includes(term))) return 'smart-casual';
  return 'casual';
}

function inferSeasons(product: Product): string[] {
  const haystack = normalizeText([product.name, product.sourceQuery, ...(product.searchTerms || [])].join(' '));
  const seasons = new Set<string>();
  if (['linen', 'mesh', 'sandal', 'raffia', 'beach', 'vacation'].some((term) => haystack.includes(term))) seasons.add('warm');
  if (['wool', 'coat', 'puffer', 'boot', 'beanie', 'fleece'].some((term) => haystack.includes(term))) seasons.add('cool');
  if (!seasons.size) seasons.add('year-round');
  return Array.from(seasons);
}

function inferSilhouette(product: Product): string[] {
  const haystack = normalizeText([product.name, product.sourceQuery, ...(product.searchTerms || [])].join(' '));
  const silhouettes = [
    'oversized',
    'relaxed',
    'slim',
    'straight',
    'wide',
    'cropped',
    'structured',
    'soft',
    'low-profile',
    'pointed',
  ];
  return compactStrings(silhouettes.filter((term) => haystack.includes(term)), 5);
}

function inferCompatibility(product: Product, formality: ProductFormality): { compatibleWith: string[]; avoidWith: string[] } {
  const categoryCompatible: Partial<Record<Category, string[]>> = {
    top: ['bottom', 'shoes', 'outer'],
    outer: ['top', 'bottom', 'shoes'],
    bottom: ['top', 'shoes', 'outer'],
    shoes: ['bottom', 'bag', 'outer'],
    bag: ['shoes', 'outer', 'jewelry'],
    hat: ['outer', 'shoes', 'bag'],
    eyewear: ['outer', 'hat', 'jewelry'],
    jewelry: ['top', 'bag', 'eyewear'],
  };
  const avoidWith = new Set<string>();
  if (formality === 'office' || formality === 'dressy') {
    avoidWith.add('workout');
    avoidWith.add('costume');
  }
  if (formality === 'athletic') {
    avoidWith.add('formal');
    avoidWith.add('evening');
  }
  return {
    compatibleWith: categoryCompatible[product.category] || [],
    avoidWith: Array.from(avoidWith),
  };
}

export function analyzeProductVisionLocally(product: Product): ProductVisionAnalysis {
  const formality = inferFormality(product);
  const { compatibleWith, avoidWith } = inferCompatibility(product, formality);
  const hasTransparentCutout = Boolean(product.imageTransparentUrl || product.imageCutoutUrl);
  const imageQualityFlags = compactStrings(product.imageQualityFlags || [], 10);

  return {
    productId: product.id,
    provider: 'local',
    model: 'local-heuristic',
    category: product.category,
    categoryConfidence: product.category ? 0.62 : 0.2,
    subcategory: inferSubcategory(product),
    colors: compactStrings([...listFromProduct(product, 'colors'), ...metadataList(product, 'colors')], 8),
    materials: inferMaterials(product),
    patterns: inferPatterns(product),
    silhouette: inferSilhouette(product),
    formality,
    seasons: inferSeasons(product),
    occasions: compactStrings([...listFromProduct(product, 'occasions'), ...metadataList(product, 'occasions')], 8),
    vibes: compactStrings([...listFromProduct(product, 'vibes'), ...metadataList(product, 'vibes'), ...metadataList(product, 'styles')], 8),
    compatibleWith,
    avoidWith,
    imageQualityFlags,
    transparentCutoutScore: hasTransparentCutout && product.imageStatus === 'cutout-ready' ? 0.85 : hasTransparentCutout ? 0.68 : 0.12,
    reasoningSummary: 'Local catalog heuristics only. Add GEMINI_API_KEY and enable CATALOG_VISION_ENABLED for visual image classification.',
    generatedAt: new Date().toISOString(),
  };
}

function mimeTypeForUrl(url: string): string {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/png';
}

function productImageUrl(product: Product): string {
  return product.imageTransparentUrl || product.imageCutoutUrl || product.imageUrl;
}

async function loadImagePayload(product: Product, origin?: string): Promise<ImagePayload> {
  const url = productImageUrl(product);
  const maxBytes = Number.parseInt(process.env.CATALOG_VISION_MAX_IMAGE_BYTES || `${DEFAULT_MAX_IMAGE_BYTES}`, 10);
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_IMAGE_BYTES;

  if (url.startsWith('/')) {
    const localPath = join(process.cwd(), 'public', url.replace(/^\/+/, ''));
    const bytes = await readFile(localPath);
    if (bytes.byteLength > limit) throw new Error(`Catalog vision image exceeds ${limit} bytes`);
    return { bytes, mimeType: mimeTypeForUrl(url), sourceUrl: origin ? new URL(url, origin).toString() : url };
  }

  const absoluteUrl = origin ? new URL(url, origin).toString() : url;
  const response = await fetch(absoluteUrl);
  if (!response.ok) throw new Error(`Catalog vision image fetch failed: ${response.status}`);
  const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > limit) throw new Error(`Catalog vision image exceeds ${limit} bytes`);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > limit) throw new Error(`Catalog vision image exceeds ${limit} bytes`);
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type')?.split(';')[0] || mimeTypeForUrl(absoluteUrl),
    sourceUrl: absoluteUrl,
  };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error('Vision provider did not return JSON');
}

function toStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return compactStrings(value.filter((entry): entry is string => typeof entry === 'string'), limit);
}

function sanitizeCategory(value: unknown, fallback: Category): Category {
  return typeof value === 'string' && CATEGORY_SET.has(value as Category) ? value as Category : fallback;
}

function sanitizeFormality(value: unknown): ProductFormality {
  return typeof value === 'string' && FORMALITY_SET.has(value as ProductFormality) ? value as ProductFormality : 'unknown';
}

function clampNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function sanitizeVisionAnalysis(value: unknown, product: Product, provider: VisionProvider, model: string): ProductVisionAnalysis {
  const local = analyzeProductVisionLocally(product);
  if (!value || typeof value !== 'object') return { ...local, provider, model };
  const entry = value as Record<string, unknown>;
  return {
    productId: product.id,
    provider,
    model,
    category: sanitizeCategory(entry.category, product.category),
    categoryConfidence: clampNumber(entry.categoryConfidence, local.categoryConfidence),
    subcategory: typeof entry.subcategory === 'string' && entry.subcategory.trim()
      ? entry.subcategory.trim().slice(0, 64)
      : local.subcategory,
    colors: toStringArray(entry.colors, 8),
    materials: toStringArray(entry.materials, 8),
    patterns: toStringArray(entry.patterns, 8),
    silhouette: toStringArray(entry.silhouette, 8),
    formality: sanitizeFormality(entry.formality),
    seasons: toStringArray(entry.seasons, 6),
    occasions: toStringArray(entry.occasions, 8),
    vibes: toStringArray(entry.vibes, 8),
    compatibleWith: toStringArray(entry.compatibleWith, 8),
    avoidWith: toStringArray(entry.avoidWith, 8),
    imageQualityFlags: toStringArray(entry.imageQualityFlags, 10),
    transparentCutoutScore: clampNumber(entry.transparentCutoutScore, local.transparentCutoutScore),
    reasoningSummary: typeof entry.reasoningSummary === 'string' && entry.reasoningSummary.trim()
      ? entry.reasoningSummary.trim().slice(0, 240)
      : local.reasoningSummary,
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeWithGemini(product: Product, origin?: string): Promise<ProductVisionAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return analyzeProductVisionLocally(product);

  const model = process.env.CATALOG_VISION_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const image = await loadImagePayload(product, origin);
  const prompt = [
    'You are classifying a real fashion product image for Sylistly catalog intelligence.',
    'Return strict JSON only. Do not invent product links, prices, brand facts, or shopping data.',
    'Classify the visible item, not the model/background. Prefer visual evidence over product title.',
    `Allowed category values: ${CATEGORY_ORDER.join(', ')}.`,
    'Use compatibleWith and avoidWith as simple outfit-planning tags, not sentences.',
    '',
    'Product context:',
    JSON.stringify({
      id: product.id,
      brand: product.brand,
      name: product.name,
      currentCategory: product.category,
      retailer: product.retailer,
      existingColors: product.colors || [],
      existingVibes: product.vibes || [],
      existingOccasions: product.occasions || [],
    }),
    '',
    'JSON schema:',
    '{"category":"top|bottom|outer|shoes|bag|hat|eyewear|jewelry","categoryConfidence":0.0,"subcategory":"short noun","colors":["color"],"materials":["material"],"patterns":["solid|stripe|plaid|graphic|logo|other"],"silhouette":["visual fit/shape"],"formality":"casual|smart-casual|office|dressy|athletic|unknown","seasons":["warm|cool|year-round"],"occasions":["occasion"],"vibes":["vibe"],"compatibleWith":["tag"],"avoidWith":["tag"],"imageQualityFlags":["bad-cutout|multi-item|background-visible|model-visible|unclear-category"],"transparentCutoutScore":0.0,"reasoningSummary":"one short sentence"}',
  ].join('\n');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.bytes.toString('base64'),
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 900,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) throw new Error(`Gemini catalog vision failed: ${response.status}`);
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
  const parsed = JSON.parse(extractJsonObject(text));
  return sanitizeVisionAnalysis(parsed, product, 'gemini', model);
}

export async function analyzeProductVision(product: Product, options: AnalyzeProductVisionOptions = {}): Promise<ProductVisionAnalysis> {
  const config = getCatalogVisionConfig();
  const provider = options.forceProvider || config.provider;

  if (!config.enabled || provider === 'local') {
    return analyzeProductVisionLocally(product);
  }

  try {
    if (provider === 'gemini') return await analyzeWithGemini(product, options.origin);
  } catch (error) {
    return {
      ...analyzeProductVisionLocally(product),
      reasoningSummary: error instanceof Error
        ? `Vision provider failed, using local fallback: ${error.message.slice(0, 160)}`
        : 'Vision provider failed, using local fallback.',
    };
  }

  return analyzeProductVisionLocally(product);
}
