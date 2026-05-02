import { NextRequest, NextResponse } from 'next/server';
import { buildAiCatalogLook } from '@/lib/catalog';
import { isRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

interface LookBody {
  vibe?: VibeId;
  frame?: GeneratorFrame;
  budget?: GeneratorBudget;
  customMaxCents?: number | null;
  mode?: 'starter' | 'missing' | 'full' | 'refresh';
  seed?: number;
  avoidProductIds?: string[];
  currentItems?: Partial<Record<Category, Product>>;
  targetSlots?: Category[];
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LookBody;
  const vibe = body.vibe || 'clean';
  const frame = body.frame || 'androgynous';
  const budget = body.budget || 'under250';
  const mode = body.mode || 'starter';
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : 0;
  const targetSlots = Array.isArray(body.targetSlots)
    ? body.targetSlots.filter((slot): slot is Category =>
        ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'].includes(slot),
      )
    : undefined;
  const currentProductIds = Object.values(body.currentItems || {})
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id);
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
    currentItems: body.currentItems || {},
    mode,
    targetSlots,
  });
  const renderableProducts = Object.fromEntries(
    Object.entries(result.products).filter((entry): entry is [Category, Product] => isRenderableProduct(entry[1])),
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
    source: 'catalog',
    assistantMode: result.assistantMode,
  });
}
