import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getProductsByIds } from '@/lib/products';
import { wrapAll } from '@/lib/affiliate';
import { getProductOutboundUrl } from '@/lib/product-links';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { fitId, productIds } = (await req.json()) as {
    fitId?: string;
    productIds?: string[];
  };

  let ids: string[] = productIds || [];

  if (fitId) {
    const sb = await supabaseServer();
    const { data: fit } = await sb.from('fits').select('items').eq('id', fitId).single();
    if (fit?.items) ids = Object.values(fit.items).filter(Boolean) as string[];
  }

  if (!ids.length) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const products = await getProductsByIds(ids);
  const urls = wrapAll(products.map((product) => getProductOutboundUrl(product)));
  return NextResponse.json({ affiliateUrls: urls, products });
}
