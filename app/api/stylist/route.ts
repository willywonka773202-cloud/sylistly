import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

interface StylistBody {
  message?: string;
  action?: string;
  context?: {
    topAesthetic?: string;
    occasion?: string;
    closetSummary?: string;
  };
}

/**
 * Optional AI enhancement for the stylist. If ANTHROPIC_API_KEY is configured we
 * return a short, on-brand styling tip; otherwise we return { text: null } and the
 * client falls back to its built-in (fully functional) stylist engine.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ text: null, source: 'local' });

  let body: StylistBody;
  try {
    body = (await req.json()) as StylistBody;
  } catch {
    return NextResponse.json({ text: null, source: 'local' });
  }

  const userAsk = body.message || body.action || 'style me a look';
  const ctx = body.context || {};

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system:
        'You are Sylistly, a warm, expert fashion stylist. Reply in 2 short sentences max, concrete and encouraging, no markdown, no lists. Reference the user context when given.',
      messages: [
        {
          role: 'user',
          content: `User asked: "${userAsk}". Context — aesthetic: ${ctx.topAesthetic || 'unknown'}, occasion: ${ctx.occasion || 'any'}, closet: ${ctx.closetSummary || 'a small wardrobe'}. Give one punchy styling tip.`,
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return NextResponse.json({ text: text || null, source: 'ai' });
  } catch {
    return NextResponse.json({ text: null, source: 'local' });
  }
}
