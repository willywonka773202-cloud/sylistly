import { NextResponse } from 'next/server';
import { aiBudgetAvailableGlobal, aiBudgetSnapshot } from '@/lib/ai-budget';
import { allowAiCall, clientKeyFromRequest } from '@/lib/rate-limit';
import { hasDatabaseCatalog } from '@/lib/catalog-db';
import { generateApiStylistResponse } from '@/lib/stylist/ai-response';
import { getStylistCatalogProducts } from '@/lib/stylist/catalog';
import { buildStylistContext } from '@/lib/stylist/context';
import type { StylistContext } from '@/lib/stylist/types';

interface StylistApiRequest {
  message?: unknown;
  context?: unknown;
}

export const runtime = 'nodejs';
export const maxDuration = 15;

function defaultStylistContext(): StylistContext {
  return buildStylistContext({
    currentFitItems: {},
    savedFits: [],
    wardrobeItems: [],
    feedPosts: [],
    catalogProducts: getStylistCatalogProducts(),
    profile: null,
  });
}

function hasKnownProductList(value: unknown): value is StylistContext {
  return Boolean(
    value
      && typeof value === 'object'
      && Array.isArray((value as { knownProducts?: unknown }).knownProducts),
  );
}

function safeContext(value: unknown): StylistContext {
  if (!value || typeof value !== 'object') {
    return defaultStylistContext();
  }
  if (!hasKnownProductList(value)) return defaultStylistContext();
  if (value.knownProducts.length > 0) return value;
  return {
    ...defaultStylistContext(),
    ...value,
    knownProducts: getStylistCatalogProducts(),
  };
}

export async function POST(request: Request) {
  let parsed: StylistApiRequest | null = null;
  try {
    parsed = (await request.json()) as StylistApiRequest;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim()) {
    return NextResponse.json(
      {
        mode: process.env.ANTHROPIC_API_KEY?.trim() ? 'api' : 'local',
        message: 'POST { message, context } to ask Syli for a real-context styling response.',
      },
      { status: 400 },
    );
  }

  const allowAi = allowAiCall(clientKeyFromRequest(request)).allowed && (await aiBudgetAvailableGlobal());
  const response = await generateApiStylistResponse(parsed.message.slice(0, 1_000), safeContext(parsed.context), allowAi);
  return NextResponse.json(response);
}

export async function GET() {
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasOllamaKey = Boolean(process.env.OLLAMA_API_KEY?.trim());
  const hasApiKey = hasAnthropicKey || hasOllamaKey;
  return NextResponse.json({
    mode: hasApiKey ? 'api' : 'local',
    provider: hasAnthropicKey ? 'anthropic' : hasOllamaKey ? 'ollama' : 'local',
    model: hasAnthropicKey
      ? process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6'
      : process.env.OLLAMA_DEFAULT_MODEL?.trim() || process.env.OLLAMA_MODEL?.trim() || 'gpt-oss:120b',
    databaseCatalog: hasDatabaseCatalog(),
    // Live cost-governor state (estimated daily spend vs cap, kill switch).
    budget: aiBudgetSnapshot(),
    message: hasApiKey
      ? 'Syli API is configured for AI-backed responses.'
      : 'Syli API is up and will use local fallback until ANTHROPIC_API_KEY is configured.',
  });
}
