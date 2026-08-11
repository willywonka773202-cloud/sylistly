import { NextRequest, NextResponse } from 'next/server';
import { aiBudgetAvailableGlobal } from '@/lib/ai-budget';
import catalogHealthData from '@/data/catalog-health.json';
import { isProductPublishable, type CatalogHealthSnapshot } from '@/lib/catalog-publishability';
import { allowAiCall, clientKeyFromRequest } from '@/lib/rate-limit';
import { composeOutfitLook, type StylistProfileInput } from '@/lib/stylist/outfit-composer';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorBudget, type GeneratorFrame, type VibeId } from '@/lib/vibes';

interface LookBody {
  vibe?: VibeId | string;
  frame?: GeneratorFrame | string;
  budget?: GeneratorBudget | string;
  customMaxCents?: number | null;
  mode?: 'starter' | 'missing' | 'full' | 'refresh';
  seed?: number;
  avoidProductIds?: string[];
  avoidComboSignatures?: string[];
  recentShoeIds?: string[];
  recentBrandCounts?: Record<string, number>;
  recentFormulaIds?: string[];
  preferredFormulaId?: string;
  diversityStrength?: 'low' | 'medium' | 'high';
  currentItems?: Partial<Record<Category, Product>>;
  lockedItems?: Partial<Record<Category, Product>>;
  targetSlots?: Category[];
  selectedSlots?: Category[];
  profile?: StylistProfileInput | null;
  fast?: boolean;
}

export const runtime = 'nodejs';
export const maxDuration = 30;

const PUBLISHABILITY_OPTIONS = {
  health: catalogHealthData as CatalogHealthSnapshot,
  freshnessPolicy: 'require-fresh' as const,
};
const REQUIRED_LOOK_SLOTS: Category[] = ['top', 'bottom', 'shoes'];

function sanitizeProfile(value: unknown): StylistProfileInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const profile: StylistProfileInput = {};
  if (typeof raw.skinTone === 'string') profile.skinTone = raw.skinTone.slice(0, 16);
  if (raw.bodyType === 'masc' || raw.bodyType === 'fem' || raw.bodyType === 'androgynous' || raw.bodyType === 'custom') {
    profile.bodyType = raw.bodyType;
  }
  if (Array.isArray(raw.preferredBrands)) {
    profile.preferredBrands = raw.preferredBrands.filter((b): b is string => typeof b === 'string').slice(0, 12);
  }
  if (Array.isArray(raw.preferredVibes)) {
    profile.preferredVibes = raw.preferredVibes.filter((v): v is string => typeof v === 'string').slice(0, 8);
  }
  if (raw.budgetTier === 'low' || raw.budgetTier === 'mid' || raw.budgetTier === 'high' || raw.budgetTier === 'luxury') {
    profile.budgetTier = raw.budgetTier;
  }
  return Object.keys(profile).length ? profile : null;
}

const VIBE_IDS = new Set<VibeId>(VIBES.map((vibe) => vibe.id));
const VIBE_ALIASES: Record<string, VibeId> = {
  athleisure: 'gym',
  athletic: 'gym',
  classic: 'clean',
  date_night: 'date',
  'date-night': 'date',
  minimal: 'clean',
  minimalist: 'clean',
  old_money: 'preppy',
  'old-money': 'preppy',
  sporty: 'gym',
  streetwear: 'street',
  travel: 'vacation',
  work: 'office',
  y2k: 'street',
};
const FRAME_IDS = new Set<GeneratorFrame>(['masc', 'fem', 'androgynous']);
const BUDGET_IDS = new Set<GeneratorBudget>(['any', 'under100', 'under250', 'under500', 'custom']);
const CATEGORY_ALIASES: Record<string, Category> = {
  accessory: 'jewelry',
  accessories: 'jewelry',
  bottoms: 'bottom',
  cap: 'hat',
  handbag: 'bag',
  headwear: 'hat',
  jacket: 'outer',
  jackets: 'outer',
  pant: 'bottom',
  pants: 'bottom',
  shirt: 'top',
  sneaker: 'shoes',
  sneakers: 'shoes',
  shoe: 'shoes',
  sunglasses: 'eyewear',
  tops: 'top',
};

function normalizeVibe(value: unknown): VibeId {
  if (typeof value !== 'string') return 'clean';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
  if (VIBE_IDS.has(normalized as VibeId)) return normalized as VibeId;
  return VIBE_ALIASES[normalized] || 'clean';
}

function normalizeFrame(value: unknown): GeneratorFrame {
  if (typeof value !== 'string') return 'androgynous';
  const normalized = value.trim().toLowerCase();
  if (FRAME_IDS.has(normalized as GeneratorFrame)) return normalized as GeneratorFrame;
  if (['male', 'man', 'men', "men's"].includes(normalized)) return 'masc';
  if (['female', 'woman', 'women', "women's"].includes(normalized)) return 'fem';
  return 'androgynous';
}

function normalizeBudget(value: unknown): GeneratorBudget {
  if (typeof value !== 'string') return 'under250';
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'under100') return 'under100';
  if (normalized === 'under250') return 'under250';
  if (normalized === 'under500') return 'under500';
  if (normalized === 'custom') return 'custom';
  if (normalized === 'any' || normalized === 'all') return 'any';
  return BUDGET_IDS.has(value as GeneratorBudget) ? value as GeneratorBudget : 'under250';
}

function normalizeCategory(value: unknown): Category | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
  if (['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'].includes(normalized)) {
    return normalized as Category;
  }
  return CATEGORY_ALIASES[normalized] || null;
}

export async function POST(req: NextRequest) {
  let body: LookBody;
  try {
    body = (await req.json()) as LookBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const vibe = normalizeVibe(body.vibe);
  const frame = normalizeFrame(body.frame);
  const budget = normalizeBudget(body.budget);
  const mode = body.mode || 'starter';
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : 0;
  const rawTargetSlots = Array.isArray(body.targetSlots) ? body.targetSlots : body.selectedSlots;
  const targetSlots = Array.isArray(rawTargetSlots)
    ? rawTargetSlots.map(normalizeCategory).filter((slot): slot is Category => Boolean(slot))
    : undefined;
  const lockedProductIds = new Set(
    Object.values(body.lockedItems || {})
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const currentProductIds = Object.values(body.currentItems || {})
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id)
    .filter((id) => !lockedProductIds.has(id));
  const avoidProductIds = Array.from(new Set([
    ...(Array.isArray(body.avoidProductIds) ? body.avoidProductIds : []),
    ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? currentProductIds : []),
  ]));

  // `fast` mode (optimistic UI): return the instant deterministic fit without
  // touching the AI, rate limiter, or budget — the client shows it immediately,
  // then re-requests the full AI-styled look in the background.
  // Otherwise: rate limit per client AND the global daily spend cap; either
  // tripping degrades this request to the free deterministic engine.
  const fast = body.fast === true;
  const allowAi = fast
    ? false
    : allowAiCall(clientKeyFromRequest(req)).allowed && (await aiBudgetAvailableGlobal());
  const result = await composeOutfitLook({
    vibe,
    frame,
    budget,
    customMaxCents: typeof body.customMaxCents === 'number' ? body.customMaxCents : null,
    seed,
    avoidProductIds,
    avoidComboSignatures: Array.isArray(body.avoidComboSignatures) ? body.avoidComboSignatures : [],
    recentShoeIds: Array.isArray(body.recentShoeIds) ? body.recentShoeIds : [],
    recentBrandCounts: body.recentBrandCounts && typeof body.recentBrandCounts === 'object' ? body.recentBrandCounts : undefined,
    recentFormulaIds: Array.isArray(body.recentFormulaIds) ? body.recentFormulaIds : [],
    preferredFormulaId: typeof body.preferredFormulaId === 'string' ? body.preferredFormulaId : undefined,
    diversityStrength: body.diversityStrength || 'medium',
    currentItems: body.currentItems || {},
    lockedItems: body.lockedItems || {},
    mode,
    targetSlots,
    transparentOnly: true,
    profile: sanitizeProfile(body.profile),
    allowAi,
  });
  const renderableProducts = Object.fromEntries(
    Object.entries(result.products).filter((entry): entry is [Category, Product] =>
      Boolean(
        entry[1]
          && isEditorialCutoutProduct(entry[1])
          && isProductPublishable(entry[1], PUBLISHABILITY_OPTIONS),
      ),
    ),
  ) as Partial<Record<Category, Product>>;
  const rejectedRequiredSlots = REQUIRED_LOOK_SLOTS.filter((slot) => !renderableProducts[slot]);
  const completeBuyableProducts = rejectedRequiredSlots.length ? {} : renderableProducts;
  const compositionUnchanged = rejectedRequiredSlots.length === 0
    && Object.keys(result.products).length === Object.keys(completeBuyableProducts).length;
  const missingSlots = Array.from(new Set([
    ...result.missingSlots,
    ...Object.keys(result.products).filter((slot) => !(slot in renderableProducts)) as Category[],
    ...rejectedRequiredSlots,
  ]));
  // Keep only rationales for slots that survived the renderable filter.
  const reasons = result.reasons
    ? Object.fromEntries(Object.entries(result.reasons).filter(([slot]) => slot in completeBuyableProducts))
    : undefined;

  return NextResponse.json({
    products: completeBuyableProducts,
    collection: result.collection
      ? {
          id: result.collection.id,
          label: result.collection.label,
          vibe: result.collection.vibe,
          frame: result.collection.frame,
        }
      : null,
    missingSlots,
    formula: {
      id: result.formula.id,
      label: result.formula.label,
      structure: result.formula.structure,
      reason: result.formula.reason,
    },
    source: result.assistantMode === 'ai-styled' && compositionUnchanged ? 'ai'
      : result.assistantMode === 'budget' ? 'budget'
      : 'catalog',
    assistantMode: result.assistantMode,
    aiBudget: result.assistantMode === 'budget' ? 'capped' : 'ok',
    stylingNotes: compositionUnchanged ? result.stylingNotes : undefined,
    palette: compositionUnchanged ? result.palette : undefined,
    reasons,
    publishability: rejectedRequiredSlots.length ? 'rejected-incomplete' : 'complete-buyable',
  });
}
