import { NextRequest, NextResponse } from 'next/server';
import dropSourcesData from '@/data/drop-sources.json';
import { hasSupabaseServiceCatalog, upsertProductsToSupabase } from '@/lib/catalog-upsert';
import { ingestDropProducts, type DropSourceConfig } from '@/lib/drop-ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = (process.env.CATALOG_REFRESH_TOKEN || process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function refreshCatalog(request: NextRequest): Promise<NextResponse> {
  const configuredSecret = Boolean((process.env.CATALOG_REFRESH_TOKEN || process.env.CRON_SECRET || '').trim());
  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: 'CATALOG_REFRESH_TOKEN or CRON_SECRET is required.' },
      { status: 500 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasSupabaseServiceCatalog()) {
    return NextResponse.json(
      { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.' },
      { status: 500 },
    );
  }

  const includeSearchApi = process.env.CATALOG_REFRESH_SEARCHAPI === '1';
  const sourceId = process.env.CATALOG_REFRESH_SOURCE_ID?.trim() || undefined;
  const limit = parsePositiveInt(process.env.CATALOG_REFRESH_LIMIT, 120, 1000);
  const maxSearchQueries = parsePositiveInt(process.env.CATALOG_REFRESH_SEARCHAPI_MAX_QUERIES, 0, 50);

  try {
    const result = await ingestDropProducts(dropSourcesData as DropSourceConfig, {
      limit,
      sourceId,
      includeSearchApi,
      maxSearchQueries,
    });
    const upserted = await upsertProductsToSupabase(result.products);

    return NextResponse.json({
      ok: true,
      generatedAt: result.generatedAt,
      acceptedProducts: result.products.length,
      upsertedProducts: upserted,
      reports: result.reports,
      notes: [
        'New drops are stored with original merchant images and imageStatus=needs-cutout.',
        'Transparent cutouts are still produced by the local cutout review pipeline before entering the client-only transparent catalog.',
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return refreshCatalog(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return refreshCatalog(request);
}
