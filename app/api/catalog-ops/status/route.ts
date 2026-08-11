import { NextRequest, NextResponse } from 'next/server';
import {
  CATALOG_OPS_COOKIE,
  catalogOpsAuthConfigured,
  hasCatalogOpsAccess,
} from '@/lib/catalog-ops-auth';
import { getCatalogOpsStatus } from '@/lib/catalog-ops-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!catalogOpsAuthConfigured()) {
    return NextResponse.json(
      { error: 'catalog_ops_not_configured' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!hasCatalogOpsAccess({
    authorization: request.headers.get('authorization'),
    sessionCookie: request.cookies.get(CATALOG_OPS_COOKIE)?.value,
  })) {
    return NextResponse.json(
      { error: 'unauthorized' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-store',
          'WWW-Authenticate': 'Bearer realm="Sylistly catalog operations"',
        },
      },
    );
  }

  return NextResponse.json(getCatalogOpsStatus(), {
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Authorization, Cookie',
    },
  });
}
