import { NextRequest, NextResponse } from 'next/server';
import {
  CATALOG_OPS_COOKIE,
  CATALOG_OPS_SESSION_TTL_SECONDS,
  catalogOpsAuthConfigured,
  catalogOpsTokenMatches,
  createCatalogOpsSession,
} from '@/lib/catalog-ops-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function requestValues(request: NextRequest): Promise<{ token: string; action: string; json: boolean }> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({})) as { token?: unknown; action?: unknown };
    return {
      token: typeof body.token === 'string' ? body.token.slice(0, 4096) : '',
      action: typeof body.action === 'string' ? body.action : '',
      json: true,
    };
  }
  const form = await request.formData().catch(() => new FormData());
  return {
    token: String(form.get('token') || '').slice(0, 4096),
    action: String(form.get('action') || ''),
    json: false,
  };
}

export async function POST(request: NextRequest) {
  const values = await requestValues(request);
  if (values.action === 'logout') {
    const response = values.json
      ? NextResponse.json({ ok: true })
      : NextResponse.redirect(new URL('/catalog-ops/login', request.url), 303);
    response.cookies.set(CATALOG_OPS_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'strict' });
    return noStore(response);
  }

  if (!catalogOpsAuthConfigured()) {
    return noStore(NextResponse.json({ error: 'catalog_ops_not_configured' }, { status: 503 }));
  }
  if (!catalogOpsTokenMatches(values.token)) {
    if (!values.json) {
      return noStore(NextResponse.redirect(new URL('/catalog-ops/login?error=1', request.url), 303));
    }
    return noStore(NextResponse.json({ error: 'unauthorized' }, {
      status: 401,
      headers: { 'Retry-After': '2' },
    }));
  }

  const session = createCatalogOpsSession();
  if (!session) {
    return noStore(NextResponse.json({ error: 'catalog_ops_not_configured' }, { status: 503 }));
  }
  const response = values.json
    ? NextResponse.json({ ok: true, expiresInSeconds: CATALOG_OPS_SESSION_TTL_SECONDS })
    : NextResponse.redirect(new URL('/catalog-ops', request.url), 303);
  response.cookies.set(CATALOG_OPS_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CATALOG_OPS_SESSION_TTL_SECONDS,
    path: '/',
  });
  return noStore(response);
}
