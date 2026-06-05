import { NextRequest, NextResponse } from 'next/server';
import { buildAiCatalogLook } from '@/lib/catalog';
import { hasProductCommerceLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
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
}

export const runtime = 'nodejs';

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
  const body = (await req.json()) as LookBody;
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

  const result = await buildAiCatalogLook({
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
  });
  const renderableProducts = Object.fromEntries(
    Object.entries(result.products).filter((entry): entry is [Category, Product] =>
      Boolean(entry[1] && isEditorialCutoutProduct(entry[1]) && hasProductCommerceLink(entry[1])),
    ),
  ) as Partial<Record<Category, Product>>;

  return NextResponse.json({
    products: renderableProducts,
    collection: result.collection
      ? {
          id: result.collection.id,
          label: result.collection.label,
          vibe: result.collection.vibe,
          frame: result.collection.frame,
        }
      : null,
    missingSlots: result.missingSlots,
    formula: {
      id: result.formula.id,
      label: result.formula.label,
      structure: result.formula.structure,
      reason: result.formula.reason,
    },
    source: 'catalog',
    assistantMode: result.assistantMode,
  });
}
