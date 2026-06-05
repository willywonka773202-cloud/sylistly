import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductVision, analyzeProductVisionLocally, getCatalogVisionConfig, type VisionProvider } from '@/lib/catalog-vision';
import { getStylistCatalogProducts } from '@/lib/stylist/catalog';
import { CATEGORY_ORDER, type Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 20;

interface CatalogVisionBody {
  product?: unknown;
  productId?: unknown;
  forceProvider?: unknown;
}

const CATEGORY_SET = new Set(CATEGORY_ORDER);

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<Product>;
  return Boolean(
    typeof product.id === 'string'
      && typeof product.brand === 'string'
      && typeof product.name === 'string'
      && typeof product.imageUrl === 'string'
      && typeof product.retailerUrl === 'string'
      && typeof product.category === 'string'
      && CATEGORY_SET.has(product.category),
  );
}

function resolveProduct(body: CatalogVisionBody): Product | null {
  if (isProduct(body.product)) return body.product;
  if (typeof body.productId !== 'string') return null;
  return getStylistCatalogProducts().find((product) => product.id === body.productId) || null;
}

function requestedProvider(value: unknown): VisionProvider | undefined {
  return value === 'gemini' || value === 'local' ? value : undefined;
}

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return request.headers.get('x-sylistly-admin-token')?.trim() || '';
}

function paidVisionIsProtected(request: NextRequest): { ok: boolean; status?: number; message?: string } {
  const config = getCatalogVisionConfig();
  if (!config.enabled || !config.hasProviderKey || config.provider === 'local') return { ok: true };

  const expectedToken = process.env.CATALOG_VISION_ADMIN_TOKEN?.trim();
  if (!expectedToken) {
    return {
      ok: false,
      status: 403,
      message: 'CATALOG_VISION_ADMIN_TOKEN must be set before enabling paid catalog vision calls.',
    };
  }

  if (bearerToken(request) !== expectedToken) {
    return {
      ok: false,
      status: 401,
      message: 'Catalog vision requires the admin bearer token.',
    };
  }

  return { ok: true };
}

export async function GET() {
  const config = getCatalogVisionConfig();
  return NextResponse.json({
    ...config,
    mode: config.enabled && config.hasProviderKey ? 'vision-api' : 'local-fallback',
    message: config.enabled && config.hasProviderKey
      ? 'Catalog vision is configured. POST a productId or product with the admin token to classify a real product image.'
      : 'Catalog vision is available in local fallback mode. Add GEMINI_API_KEY, CATALOG_VISION_ENABLED=1, and CATALOG_VISION_ADMIN_TOKEN to enable real image classification.',
  });
}

export async function POST(request: NextRequest) {
  let body: CatalogVisionBody;
  try {
    body = (await request.json()) as CatalogVisionBody;
  } catch {
    return NextResponse.json({ message: 'POST JSON with { productId } or { product }.' }, { status: 400 });
  }

  const product = resolveProduct(body);
  if (!product) {
    return NextResponse.json({ message: 'Could not resolve a real catalog product for vision analysis.' }, { status: 400 });
  }

  const config = getCatalogVisionConfig();
  const provider = requestedProvider(body.forceProvider) || config.provider;
  if (provider !== 'local' && config.enabled && config.hasProviderKey) {
    const protectedCall = paidVisionIsProtected(request);
    if (!protectedCall.ok) {
      return NextResponse.json(
        {
          message: protectedCall.message,
          fallback: analyzeProductVisionLocally(product),
        },
        { status: protectedCall.status || 401 },
      );
    }
  }

  const analysis = await analyzeProductVision(product, {
    origin: request.nextUrl.origin,
    forceProvider: provider,
  });

  return NextResponse.json({
    productId: product.id,
    source: analysis.provider === 'local' ? 'local-fallback' : 'vision-api',
    analysis,
  });
}
