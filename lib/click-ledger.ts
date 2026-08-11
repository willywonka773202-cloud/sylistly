import { createClient } from '@supabase/supabase-js';
import type { ProductResolutionSource } from './product-resolution';

export interface RetailerClickRecord {
  productId?: string;
  productSource?: ProductResolutionSource;
  lookId?: string;
  surface: string;
  campaign: string;
  subId?: string;
  networkSubId?: string;
  anonymousId?: string;
  sessionId?: string;
  destinationHost?: string;
  affiliateNetwork?: 'rakuten' | 'skimlinks' | 'direct';
  redirectStatus: 'success' | 'failure';
  errorCode?: string;
}

export function hasClickLedger(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Best-effort by design: attribution storage can never block shopping. */
export async function recordRetailerClick(record: RetailerClickRecord): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return false;

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1_200) }),
      },
    });
    const row = {
      // The original FK can only safely point at a row resolved from Supabase.
      product_id: record.productSource === 'supabase' ? record.productId || null : null,
      external_product_id: record.productId || null,
      look_id: record.lookId || null,
      surface: record.surface,
      campaign: record.campaign,
      sub_id: record.subId || null,
      network_sub_id: record.networkSubId || null,
      anonymous_id: record.anonymousId || null,
      session_id: record.sessionId || null,
      destination_host: record.destinationHost || null,
      affiliate_network: record.affiliateNetwork || null,
      redirect_status: record.redirectStatus,
      error_code: record.errorCode || null,
      metadata: { product_source: record.productSource || null },
    };
    const { error } = await client.from('clicks').insert(row);
    if (!error) return true;

    // A database awaiting migration 0004 can still count successful Supabase
    // product clicks through the legacy columns. Static attribution requires
    // the migration because its product id is not guaranteed to satisfy the FK.
    if (record.redirectStatus === 'success' && record.productSource === 'supabase' && record.productId) {
      const { error: legacyError } = await client.from('clicks').insert({ product_id: record.productId });
      return !legacyError;
    }
  } catch {
    // Redirect continues below.
  }
  return false;
}
