import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getProductsByIds } from '@/lib/products';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: fit, error } = await sb.from('fits').select('*').eq('id', id).single();
  if (error || !fit) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: { user } } = await sb.auth.getUser();
  if (!fit.is_public && fit.owner_id && fit.owner_id !== user?.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const ids = Object.values(fit.items || {}).filter(Boolean) as string[];
  const products = await getProductsByIds(ids);

  return NextResponse.json({ fit, products });
}
