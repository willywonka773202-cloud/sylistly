// Placeholder API boundary for the Syli AI stylist.
//
// The UI does NOT depend on this route — every page reads
// /lib/stylist/local-response.ts directly. This file exists so that:
//   1. The architecture for switching to a real AI backend is
//      already in place (the URL, the JSON shape, the local-fallback
//      contract).
//   2. Any client that DOES try to call /api/stylist gets an honest
//      response instead of a silent 500 or a fake AI reply.
//   3. CI / monitoring can hit this route to confirm the boundary
//      exists.
//
// This route makes NO external API call. It does NOT require any
// environment variable. It is safe to deploy as-is.

import { NextResponse } from 'next/server';

interface StylistApiRequest {
  message?: unknown;
  context?: unknown;
}

interface StylistApiResponse {
  mode: 'local_fallback';
  message: string;
  hint: string;
  // Future contract: when an AI backend is configured, this route
  // would instead return `{ mode: 'api', reply, intent, actions, ... }`
  // matching the StylistResponse shape from lib/stylist/types.ts.
}

export async function POST(request: Request) {
  let parsed: StylistApiRequest | null = null;
  try {
    parsed = (await request.json()) as StylistApiRequest;
  } catch {
    parsed = null;
  }

  const payload: StylistApiResponse = {
    mode: 'local_fallback',
    message:
      'AI stylist backend is not configured. The Sylistly app is running the local rule-based responder, which uses your real saved fits, wardrobe, wishlist, and current build to suggest next moves.',
    hint:
      'To enable a real AI backend later, this route should call an external chat provider (OpenAI / Anthropic / etc.) using a server-side env var. See docs/stylist-ai-integration.md when added.',
  };

  // Echo back the bare detection of intent if the client sent a message
  // — useful for future API integration scaffolding without doing any
  // real work here. We deliberately do NOT call the local responder
  // from this server route because the UI already does that, and
  // duplicating it would mean two divergent rule sets.
  if (parsed && typeof parsed.message === 'string') {
    return NextResponse.json({ ...payload, echoedMessageLength: parsed.message.length });
  }

  return NextResponse.json(payload);
}

export async function GET() {
  // Tiny GET for health checks. Same fallback contract.
  return NextResponse.json({
    mode: 'local_fallback',
    message: 'Stylist API boundary is up. POST a JSON body to receive a fallback response.',
  });
}
