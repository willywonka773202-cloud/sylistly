import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getProductsByIds } from '@/lib/products';
import type { Category } from '@/lib/types';

export const runtime = 'nodejs';

interface CreateFitBody {
  title?: string;
  vibe?: string;
  items: Partial<Record<Category, string>>;
  isPublic?: boolean;
}

export async function POST(req: NextRequest) {
  let body: CreateFitBody;
  try {
    body = (await req.json()) as CreateFitBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const ids = Object.values(body.items || {}).filter(Boolean) as string[];
  if (!ids.length) {
    return NextResponse.json({ error: 'empty_fit' }, { status: 400 });
  }

  const products = await getProductsByIds(ids);
  const totalCents = products.reduce((sum, p) => sum + p.priceCents, 0);

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const { data, error } = await sb
    .from('fits')
    .insert({
      owner_id: user?.id ?? null,
      title: body.title ?? null,
      vibe: body.vibe ?? null,
      items: body.items,
      total_cents: totalCents,
      is_public: !!body.isPublic,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data!.id });
}
