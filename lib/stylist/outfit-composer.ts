import Anthropic from '@anthropic-ai/sdk';
import {
  getFullSlotInventory,
  getOutfitCandidateShortlists,
  REQUIRED_OUTFIT_SLOTS,
  type CatalogCollection,
  type OutfitCandidateShortlists,
  type OutfitFormula,
} from '@/lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

type GeneratorMode = 'starter' | 'missing' | 'full' | 'refresh';
type DiversityStrength = 'low' | 'medium' | 'high';

// Haiku is fast + strong at this constrained, structured selection task, keeping
// generation snappy. Override with OUTFIT_COMPOSER_MODEL (e.g. a Sonnet for max taste).
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const COMPOSE_TIMEOUT_MS = 13_000;
const PER_SLOT_LIMIT = 10; // deterministic shortlist (fallback base only)
const FULL_INVENTORY_PER_SLOT = 32; // how much of the real catalog the model reads per slot
const COMPOSE_MAX_TOKENS = 900;

/** Optional, privacy-safe styling profile the composer can personalize against. */
export interface StylistProfileInput {
  skinTone?: string; // hex
  bodyType?: 'masc' | 'fem' | 'androgynous' | 'custom';
  preferredBrands?: string[];
  preferredVibes?: string[];
  budgetTier?: 'low' | 'mid' | 'high' | 'luxury';
}

export interface ComposeOutfitParams {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  lockedItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
  avoidComboSignatures?: string[];
  recentShoeIds?: string[];
  recentBrandCounts?: Record<string, number>;
  recentFormulaIds?: string[];
  preferredFormulaId?: string;
  diversityStrength?: DiversityStrength;
  targetSlots?: Category[];
  transparentOnly?: boolean;
  profile?: StylistProfileInput | null;
}

export interface ComposedLook {
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
  formula: OutfitFormula;
  assistantMode: 'ai-styled' | 'catalog';
  stylingNotes?: string;
  palette?: string[];
  reasons?: Partial<Record<Category, string>>;
}

interface StylistPick {
  slot: Category;
  productId: string;
  reason?: string;
}

interface StylistToolResult {
  picks: StylistPick[];
  palette?: string[];
  stylingNotes?: string;
}

// ----- garment attribute inference (grounding the model in real signals) -----

const COLOR_LEXICON: Record<string, string> = {
  black: 'black', jet: 'black', onyx: 'black', noir: 'black',
  white: 'white', ivory: 'white', cream: 'white', ecru: 'white', bone: 'white', off: 'white',
  grey: 'grey', gray: 'grey', charcoal: 'grey', slate: 'grey', heather: 'grey',
  navy: 'navy', blue: 'blue', denim: 'blue', indigo: 'blue', cobalt: 'blue', sky: 'blue',
  beige: 'beige', tan: 'tan', khaki: 'tan', camel: 'tan', sand: 'tan', taupe: 'taupe', stone: 'taupe',
  brown: 'brown', chocolate: 'brown', espresso: 'brown', mocha: 'brown', coffee: 'brown',
  olive: 'olive', green: 'green', sage: 'green', forest: 'green', emerald: 'green', loden: 'olive',
  red: 'red', burgundy: 'burgundy', maroon: 'burgundy', wine: 'burgundy', crimson: 'red',
  pink: 'pink', rose: 'pink', blush: 'pink', fuchsia: 'pink', magenta: 'pink',
  purple: 'purple', lavender: 'purple', lilac: 'purple', plum: 'purple', violet: 'purple',
  yellow: 'yellow', mustard: 'yellow', gold: 'gold', butter: 'yellow',
  orange: 'orange', rust: 'rust', terracotta: 'rust', amber: 'orange',
  silver: 'silver', metallic: 'silver', chrome: 'silver',
};

function inferColors(product: Product): string[] {
  const found = new Set<string>();
  for (const raw of product.colors || []) {
    const key = COLOR_LEXICON[String(raw).toLowerCase().trim()];
    if (key) found.add(key);
  }
  if (found.size < 2) {
    const words = `${product.name} ${product.sourceQuery || ''}`.toLowerCase().split(/[^a-z]+/);
    for (const word of words) {
      const key = COLOR_LEXICON[word];
      if (key) found.add(key);
      if (found.size >= 3) break;
    }
  }
  return Array.from(found).slice(0, 3);
}

const FORMAL_TERMS = ['blazer', 'suit', 'tailored', 'trouser', 'loafer', 'oxford', 'heel', 'pump', 'dress shirt', 'silk', 'wool', 'cashmere', 'gown', 'midi', 'pleated', 'leather', 'derby', 'sleek'];
const CASUAL_TERMS = ['hoodie', 'sweat', 'jogger', 'sneaker', 'tee', 't-shirt', 'cargo', 'gym', 'track', 'jersey', 'flip', 'slide', 'beanie', 'graphic', 'fleece', 'athletic', 'running', 'crewneck'];

function inferFormality(product: Product): number {
  const haystack = `${product.name} ${product.category} ${(product.vibes || []).join(' ')}`.toLowerCase();
  let score = 3;
  for (const term of FORMAL_TERMS) if (haystack.includes(term)) { score += 1; break; }
  for (const term of CASUAL_TERMS) if (haystack.includes(term)) { score -= 1; break; }
  if (product.category === 'jewelry' || product.category === 'eyewear') score = 3;
  return Math.max(1, Math.min(5, score));
}

function compactCandidate(product: Product) {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name.slice(0, 70),
    price: Math.round(product.priceCents / 100),
    colors: inferColors(product),
    formality: inferFormality(product),
    tags: (product.vibes || []).slice(0, 4),
  };
}

// ----------------------- model plumbing -----------------------

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? new Anthropic({ apiKey }) : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

const STYLIST_RUBRIC = [
  'You are the lead stylist for Sylistly, a premium outfit app. You are given the FULL eligible catalog for each requested slot — read every option and assemble ONE complete, genuinely good-looking outfit by choosing exactly one product per slot.',
  '',
  'Read the whole candidate list for each slot before deciding — the lists are the real inventory, not pre-filtered by style, so it is your job to find the pieces that actually go together. Style like a real human stylist, not a keyword matcher. Optimize the whole look, not each slot in isolation:',
  '• COLOR: build a cohesive palette — a neutral base (black/white/grey/tan/navy/brown) with AT MOST one saturated accent, OR a tonal/analogous scheme. Avoid two competing bright colors. Earthy tones pair together; cool tones pair together.',
  '• FORMALITY: keep the formality levels within ~1 point of each other. Never mix athletic pieces (formality 1-2: gym, sweats, running shoes) with tailored pieces (formality 4-5: blazers, trousers, heels).',
  '• SILHOUETTE: balance proportion — pair a relaxed/oversized top with a slimmer or structured bottom (and vice versa). Avoid baggy-on-baggy unless the vibe is explicitly oversized/street.',
  '• VIBE: every piece must read as the requested vibe. A "clean"/minimal look avoids loud graphics; "street" leans bolder; "office"/"preppy" stays polished. Because the lists are unfiltered, actively skip off-vibe items (e.g. no gym shorts in an office look) — pick the ones that fit.',
  '• FRAME: respect the requested frame (masc/fem/androgynous) and keep proportions appropriate.',
  '• BUDGET: stay at or under budget across the whole outfit when possible; spend where it matters (shoes, outerwear).',
  '',
  'Fill EVERY slot that has a candidate list — the user explicitly chose to include these slots, so do not skip one (including hat, bag, eyewear, jewelry). For each, pick the single option that best completes the look; if a slot is genuinely hard, still choose the most on-palette, on-vibe piece available. One statement piece per outfit, maximum.',
  '',
  'When a user profile is given, personalize: bias toward their preferred brands when an option fits, respect their budget tendency, and choose colors that flatter their skin tone (warm undertones → earthy/warm neutrals, olive, rust, cream; cool undertones → navy, grey, cool white, jewel tones; deep skin → high-contrast and rich saturated tones read beautifully).',
  '',
  'You MUST pick productId values that appear in the candidate list for that slot. Never invent IDs. Call the compose_outfit tool with one pick per slot, a 2-5 word palette, and one tight sentence of styling notes that a shopper would find genuinely useful (why these pieces work together).',
].join('\n');

const COMPOSE_TOOL: Anthropic.Tool = {
  name: 'compose_outfit',
  description: 'Return the final assembled outfit: one chosen productId per slot you decide to fill, plus the palette and styling notes.',
  input_schema: {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        description: 'One entry per slot you choose to fill. Always include top, bottom, shoes.',
        items: {
          type: 'object',
          properties: {
            slot: { type: 'string', enum: CATEGORY_ORDER },
            productId: { type: 'string', description: 'Must be an id from that slot’s candidate list.' },
            reason: { type: 'string', description: 'Short reason this piece fits the look (<= 14 words).' },
          },
          required: ['slot', 'productId'],
        },
      },
      palette: { type: 'array', items: { type: 'string' }, description: '2-5 color words describing the outfit palette.' },
      stylingNotes: { type: 'string', description: 'One sentence on why the outfit works.' },
    },
    required: ['picks'],
  },
};

function buildUserPayload(
  candidatePools: Partial<Record<Category, Product[]>>,
  shortlists: OutfitCandidateShortlists,
  params: ComposeOutfitParams,
) {
  const slots: Record<string, ReturnType<typeof compactCandidate>[]> = {};
  for (const [slot, products] of Object.entries(candidatePools)) {
    if (!products?.length) continue;
    slots[slot] = products.map(compactCandidate);
  }
  const lockedItems = shortlists.lockedSlots
    .map((slot) => {
      const product = params.lockedItems?.[slot];
      return product ? { slot, ...compactCandidate(product) } : null;
    })
    .filter(Boolean);

  return {
    request: {
      vibe: params.vibe,
      frame: params.frame,
      budgetMaxUsd: params.customMaxCents
        ? Math.round(params.customMaxCents / 100)
        : { any: null, under100: 100, under250: 250, under500: 500, custom: null }[params.budget] ?? null,
      formulaHint: shortlists.formula?.label,
    },
    profile: params.profile
      ? {
          skinTone: params.profile.skinTone,
          bodyType: params.profile.bodyType,
          preferredBrands: (params.profile.preferredBrands || []).slice(0, 8),
          budgetTier: params.profile.budgetTier,
        }
      : null,
    alreadyChosenLockedItems: lockedItems,
    candidatesBySlot: slots,
  };
}

/** Deterministic assembly used when AI is unavailable or fails. */
function assembleFallback(shortlists: OutfitCandidateShortlists, params: ComposeOutfitParams): ComposedLook {
  const products: Partial<Record<Category, Product>> = {};
  for (const slot of shortlists.lockedSlots) {
    const locked = params.lockedItems?.[slot];
    if (locked) products[slot] = locked;
  }
  for (const slot of shortlists.targetSlots) {
    if (products[slot]) continue;
    const basePick = shortlists.base[slot];
    if (basePick) products[slot] = basePick;
  }
  const missingSlots = shortlists.targetSlots.filter((slot) => !products[slot]);
  return {
    products,
    collection: shortlists.collection,
    missingSlots,
    formula: shortlists.formula,
    assistantMode: 'catalog',
  };
}

function parseToolResult(message: Anthropic.Message): StylistToolResult | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'compose_outfit') {
      const input = block.input as Partial<StylistToolResult>;
      if (Array.isArray(input.picks)) {
        return {
          picks: input.picks.filter((pick): pick is StylistPick =>
            Boolean(pick && typeof pick.slot === 'string' && typeof pick.productId === 'string')),
          palette: Array.isArray(input.palette) ? input.palette.slice(0, 5).map(String) : undefined,
          stylingNotes: typeof input.stylingNotes === 'string' ? input.stylingNotes.slice(0, 240) : undefined,
        };
      }
    }
  }
  return null;
}

function applyPicks(
  shortlists: OutfitCandidateShortlists,
  candidatePools: Partial<Record<Category, Product[]>>,
  params: ComposeOutfitParams,
  result: StylistToolResult,
): ComposedLook {
  const products: Partial<Record<Category, Product>> = {};
  const reasons: Partial<Record<Category, string>> = {};

  // Locked items are fixed.
  for (const slot of shortlists.lockedSlots) {
    const locked = params.lockedItems?.[slot];
    if (locked) products[slot] = locked;
  }

  // Apply validated AI picks (id must exist in that slot's candidate list).
  for (const pick of result.picks) {
    const slot = pick.slot as Category;
    if (!CATEGORY_ORDER.includes(slot)) continue;
    if (products[slot]) continue; // already locked
    const pool = candidatePools[slot];
    if (!pool) continue;
    const product = pool.find((entry) => entry.id === pick.productId);
    if (!product) continue;
    products[slot] = product;
    if (pick.reason) reasons[slot] = pick.reason.slice(0, 120);
  }

  // Backfill EVERY requested slot the model skipped — the user explicitly chose
  // to include these slots (e.g. hat), so they should not come back empty.
  for (const slot of shortlists.targetSlots) {
    if (products[slot]) continue;
    const backfill = shortlists.base[slot] || candidatePools[slot]?.[0];
    if (backfill) products[slot] = backfill;
  }

  const missingSlots = shortlists.targetSlots.filter((slot) => !products[slot]);
  return {
    products,
    collection: shortlists.collection,
    missingSlots,
    formula: shortlists.formula,
    assistantMode: 'ai-styled',
    stylingNotes: result.stylingNotes,
    palette: result.palette,
    reasons: Object.keys(reasons).length ? reasons : undefined,
  };
}

/**
 * Compose one coherent outfit with a real model over deterministic shortlists.
 * Falls back to the deterministic engine on no-key/timeout/error so generation
 * never fails or hangs.
 */
export async function composeOutfitLook(params: ComposeOutfitParams): Promise<ComposedLook> {
  const shortlists = getOutfitCandidateShortlists({
    vibe: params.vibe,
    frame: params.frame,
    budget: params.budget,
    customMaxCents: params.customMaxCents,
    currentItems: params.currentItems,
    lockedItems: params.lockedItems,
    mode: params.mode,
    seed: params.seed,
    avoidProductIds: params.avoidProductIds,
    avoidComboSignatures: params.avoidComboSignatures,
    recentShoeIds: params.recentShoeIds,
    recentBrandCounts: params.recentBrandCounts,
    recentFormulaIds: params.recentFormulaIds,
    preferredFormulaId: params.preferredFormulaId,
    diversityStrength: params.diversityStrength,
    targetSlots: params.targetSlots,
    transparentOnly: params.transparentOnly,
    perSlotLimit: PER_SLOT_LIMIT,
  });

  // Give the model the FULL eligible inventory per slot (hard constraints only),
  // so it reads the whole catalog and makes the styling call — not a vibe-scored
  // shortlist that pre-decides for it.
  const inventory = getFullSlotInventory({
    targetSlots: shortlists.targetSlots,
    budget: params.budget,
    customMaxCents: params.customMaxCents,
    frame: params.frame,
    avoidProductIds: params.avoidProductIds,
    lockedItems: params.lockedItems,
    currentItems: params.currentItems,
    mode: params.mode,
    transparentOnly: params.transparentOnly ?? true,
    perSlotLimit: FULL_INVENTORY_PER_SLOT,
    seed: params.seed ?? 0,
  });

  const slotsWithCandidates = Object.values(inventory).filter((pool) => pool && pool.length).length;
  const client = getClient();
  if (!client || slotsWithCandidates === 0) {
    return assembleFallback(shortlists, params);
  }

  try {
    const model = process.env.OUTFIT_COMPOSER_MODEL?.trim() || DEFAULT_MODEL;
    const message = await withTimeout(
      client.messages.create({
        model,
        max_tokens: COMPOSE_MAX_TOKENS,
        system: STYLIST_RUBRIC,
        tools: [COMPOSE_TOOL],
        tool_choice: { type: 'tool', name: 'compose_outfit' },
        messages: [{ role: 'user', content: JSON.stringify(buildUserPayload(inventory, shortlists, params)) }],
      }),
      COMPOSE_TIMEOUT_MS,
      'Outfit composer timed out',
    );

    const result = parseToolResult(message);
    if (!result || !result.picks.length) {
      return assembleFallback(shortlists, params);
    }
    const composed = applyPicks(shortlists, inventory, params, result);
    // If the model failed to fill even the required slots, prefer the deterministic look.
    const hasRequired = REQUIRED_OUTFIT_SLOTS.every((slot) => composed.products[slot]);
    return hasRequired ? composed : assembleFallback(shortlists, params);
  } catch (error) {
    console.warn('[outfit-composer] falling back to deterministic: %s', error instanceof Error ? error.message : String(error));
    return assembleFallback(shortlists, params);
  }
}
