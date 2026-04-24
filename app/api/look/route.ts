import { NextRequest, NextResponse } from 'next/server';
import { buildAiCatalogLook } from '@/lib/catalog';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

interface LookBody {
  vibe?: VibeId;
  frame?: GeneratorFrame;
  budget?: GeneratorBudget;
  mode?: 'starter' | 'missing';
  seed?: number;
  avoidProductIds?: string[];
  currentItems?: Partial<Record<Category, Product>>;
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LookBody;
  const vibe = body.vibe || 'clean';
  const frame = body.frame || 'androgynous';
  const budget = body.budget || 'under250';
  const mode = body.mode || 'starter';
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : 0;

  const result = await buildAiCatalogLook({
    vibe,
    frame,
    budget,
    seed,
    avoidProductIds: Array.isArray(body.avoidProductIds) ? body.avoidProductIds : [],
    currentItems: body.currentItems || {},
    mode,
  });

  return NextResponse.json({
    products: result.products,
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
