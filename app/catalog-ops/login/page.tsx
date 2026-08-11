import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CATALOG_OPS_COOKIE,
  catalogOpsAuthConfigured,
  hasCatalogOpsAccess,
} from '@/lib/catalog-ops-auth';

export const dynamic = 'force-dynamic';

export default async function CatalogOpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  if (hasCatalogOpsAccess({
    authorization: headerStore.get('authorization'),
    sessionCookie: cookieStore.get(CATALOG_OPS_COOKIE)?.value,
  })) {
    redirect('/catalog-ops');
  }
  const { error } = await searchParams;
  const configured = catalogOpsAuthConfigured();

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f0e9] px-5 py-12 text-[#171a18]">
      <section className="w-full max-w-md rounded-[28px] border border-[#d9d3c8] bg-white p-7 shadow-[0_24px_80px_rgba(32,38,34,.12)]">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#64746a]">Internal · protected</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Catalog operations</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d645f]">
          Enter the operator token. It is exchanged for an HTTP-only, eight-hour session and is never placed in the URL or browser storage.
        </p>
        {!configured ? (
          <div className="mt-6 rounded-2xl border border-[#d7a2a2] bg-[#fff3f3] p-4 text-sm font-semibold text-[#872f2f]">
            Access is disabled. Configure a random CATALOG_OPS_TOKEN of at least 24 characters on the server.
          </div>
        ) : (
          <form action="/api/catalog-ops/session" method="post" className="mt-6 space-y-4">
            <label className="block text-sm font-bold" htmlFor="catalog-ops-token">Operator token</label>
            <input
              id="catalog-ops-token"
              name="token"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-[#bbbdb8] bg-[#fbfcfa] px-4 font-mono text-sm outline-none focus:border-[#2d6b51] focus:ring-2 focus:ring-[#2d6b51]/20"
            />
            {error ? <p role="alert" className="text-sm font-semibold text-[#9b2f2f]">Access denied. Check the token and try again.</p> : null}
            <button type="submit" className="h-12 w-full rounded-xl bg-[#183e30] px-4 text-sm font-black text-white hover:bg-[#245b46] focus:outline-none focus:ring-2 focus:ring-[#183e30]/30">
              Open operations
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
