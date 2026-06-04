import { NextRequest, NextResponse } from 'next/server';
import { identifyOutfitFromImage, type DetectedGarment, type SnapMediaType } from '@/lib/claude';
import type { Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 45;

interface SnapBody {
  image?: string; // data URL or raw base64
  mediaType?: string;
}

export interface SnapLook extends DetectedGarment {
  products: Product[];
}

const ALLOWED_MEDIA: SnapMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

function detectMediaType(image: string, hint?: string): SnapMediaType {
  const fromData = image.match(/^data:(image\/\w+);base64,/);
  const candidate = (fromData?.[1] || hint || 'image/jpeg').toLowerCase();
  return (ALLOWED_MEDIA as string[]).includes(candidate)
    ? (candidate as SnapMediaType)
    : 'image/jpeg';
}

/**
 * POST /api/snap  { image: dataUrl|base64, mediaType? }
 * Claude Vision reads the outfit, then each detected garment is run through the
 * existing /api/search pipeline so every item comes back with affiliate links.
 */
export async function POST(req: NextRequest) {
  let body: SnapBody;
  try {
    body = (await req.json()) as SnapBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const rawImage = (body.image || '').trim();
  if (!rawImage) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
  }
  const mediaType = detectMediaType(rawImage, body.mediaType);
  const base64 = rawImage.replace(/^data:image\/\w+;base64,/, '');
  // ~8MB base64 ceiling to avoid oversized vision calls.
  if (base64.length > 8_000_000) {
    return NextResponse.json({ error: 'That image is too large — try a smaller photo.' }, { status: 413 });
  }

  let garments: DetectedGarment[];
  try {
    garments = await identifyOutfitFromImage(base64, mediaType);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'vision_failed';
    const message =
      reason === 'vision_unavailable'
        ? 'Snap to Shop needs the vision model configured (ANTHROPIC_API_KEY).'
        : 'Could not read the outfit from that photo. Try a clearer, well-lit shot of the full look.';
    return NextResponse.json({ error: message, reason }, { status: 502 });
  }

  if (!garments.length) {
    return NextResponse.json(
      { error: 'No clothing items detected. Try a photo that clearly shows an outfit.' },
      { status: 404 },
    );
  }

  const origin = req.nextUrl.origin;
  const looks: SnapLook[] = await Promise.all(
    garments.map(async (garment): Promise<SnapLook> => {
      let products: Product[] = [];
      try {
        const res = await fetch(`${origin}/api/search`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: garment.query, category: garment.category }),
        });
        const data = (await res.json()) as { products?: Product[] };
        products = Array.isArray(data.products) ? data.products.slice(0, 6) : [];
      } catch {
        products = [];
      }
      return { ...garment, products };
    }),
  );

  const matched = looks.filter((look) => look.products.length > 0).length;
  return NextResponse.json({ looks, matched, total: garments.length });
}
