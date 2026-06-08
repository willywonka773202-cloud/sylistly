import Anthropic from '@anthropic-ai/sdk';
import { aiBudgetAvailable, recordAiUsage } from '@/lib/ai-budget';
import { CATEGORY_ORDER, type Product } from '@/lib/types';
import { hasExactProductLink, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import { detectIntent, generateLocalStylistResponse } from '@/lib/stylist/local-response';
import type {
  StylistAction,
  StylistContext,
  StylistRecommendedProduct,
  StylistResponse,
  StylistUserIntent,
} from '@/lib/stylist/types';

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const DEFAULT_OLLAMA_MODEL = 'gpt-oss:120b';
const DEFAULT_OLLAMA_BASE_URL = 'https://ollama.com/api';
const STYLIST_TIMEOUT_MS = 10_000;

const VALID_INTENTS: StylistUserIntent[] = [
  'outfit_request',
  'rate_current_fit',
  'packing_list',
  'complete_closet',
  'shopping_advice',
  'style_dna',
  'build_around_piece',
  'saved_fit_remix',
  'unknown',
];

const ALLOWED_ACTION_HREFS = new Set(['/build', '/wardrobe', '/discover', '/saved', '/feed', '/canvas', '/profile', '/stylist']);

function compactKnownProducts(products: Product[], limit = 64): Product[] {
  const realProducts = sortTransparentFeedRenderableProducts(products)
    .sort((left, right) => Number(hasExactProductLink(right)) - Number(hasExactProductLink(left)));
  const selected: Product[] = [];
  const usedIds = new Set<string>();

  for (const category of CATEGORY_ORDER) {
    for (const product of realProducts) {
      if (product.category !== category || usedIds.has(product.id)) continue;
      selected.push(product);
      usedIds.add(product.id);
      if (selected.length >= limit) return selected;
    }
  }

  for (const product of realProducts) {
    if (usedIds.has(product.id)) continue;
    selected.push(product);
    if (selected.length >= limit) break;
  }

  return selected;
}

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? new Anthropic({ apiKey }) : null;
}

function getOllamaConfig(): { apiKey: string; model: string; baseUrl: string } | null {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OLLAMA_DEFAULT_MODEL?.trim() || process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
    baseUrl: (process.env.OLLAMA_API_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, ''),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function compactContext(context: StylistContext) {
  return {
    counts: {
      savedFits: context.savedFitCount,
      closet: context.closetCount,
      wishlist: context.wishlistCount,
      likedFeed: context.likedFeedCount,
      currentFitPieces: context.currentFitPieceCount,
      currentFitTotalCents: context.currentFitTotalCents,
    },
    currentFit: {
      categories: context.currentFitCategories,
      missingRequiredSlots: context.currentFitMissingRequiredSlots,
    },
    wardrobe: {
      closetCategories: context.closetCategories,
      missingCategories: context.wardrobeMissingCategories,
      distribution: context.closetDistribution,
      recent: context.recentWardrobeSummary,
    },
    styleSignals: {
      topSavedVibes: context.topSavedVibes,
      topBrands: context.topBrands,
      topCategories: context.topCategories,
      budgetTendency: context.budgetTendency,
      hasEnoughDataForStyleDNA: context.hasEnoughDataForStyleDNA,
      recentSavedFits: context.recentSavedFitSummary,
    },
    knownProducts: compactKnownProducts(context.knownProducts).map((product) => ({
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      priceCents: product.priceCents,
      retailer: product.retailer,
      vibes: product.vibes || [],
      occasions: product.occasions || [],
    })),
  };
}

function fallbackActionsForIntent(intent: StylistUserIntent): StylistAction[] {
  if (intent === 'outfit_request' || intent === 'build_around_piece') {
    return [{ label: 'Open Builder', href: '/build', primary: true }, { label: 'Browse Discover', href: '/discover' }];
  }
  if (intent === 'complete_closet' || intent === 'shopping_advice') {
    return [{ label: 'Open Wardrobe', href: '/wardrobe', primary: true }, { label: 'Browse Discover', href: '/discover' }];
  }
  if (intent === 'saved_fit_remix') {
    return [{ label: 'Open Saved', href: '/saved', primary: true }, { label: 'Open Builder', href: '/build' }];
  }
  if (intent === 'style_dna') {
    return [{ label: 'Open Profile', href: '/profile', primary: true }];
  }
  return [{ label: 'Open Builder', href: '/build' }, { label: 'Open Wardrobe', href: '/wardrobe' }];
}

function sanitizeIntent(value: unknown, fallback: StylistUserIntent): StylistUserIntent {
  return typeof value === 'string' && VALID_INTENTS.includes(value as StylistUserIntent)
    ? (value as StylistUserIntent)
    : fallback;
}

function sanitizeActions(value: unknown, fallback: StylistAction[]): StylistAction[] {
  if (!Array.isArray(value)) return fallback;
  const actions = value
    .map((entry): StylistAction | null => {
      if (!entry || typeof entry !== 'object') return null;
      const action = entry as Partial<StylistAction>;
      if (typeof action.label !== 'string' || typeof action.href !== 'string') return null;
      if (!ALLOWED_ACTION_HREFS.has(action.href)) return null;
      return {
        label: action.label.slice(0, 28),
        href: action.href,
        primary: Boolean(action.primary),
      };
    })
    .filter((entry): entry is StylistAction => Boolean(entry))
    .slice(0, 3);
  return actions.length ? actions : fallback;
}

function sanitizeRecommendedProducts(value: unknown, context: StylistContext): StylistRecommendedProduct[] {
  if (!Array.isArray(value)) return [];
  const renderableProducts = sortTransparentFeedRenderableProducts(context.knownProducts);
  const productsById = new Map(renderableProducts.map((product) => [product.id, product]));
  const knownIds = new Set(renderableProducts.map((product) => product.id));
  const recommendations = value
    .map((entry): StylistRecommendedProduct | null => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Partial<StylistRecommendedProduct>;
      if (typeof candidate.productId !== 'string' || !knownIds.has(candidate.productId)) return null;
      return {
        productId: candidate.productId,
        reason: typeof candidate.reason === 'string' ? candidate.reason.slice(0, 180) : 'Matches your local style context.',
      };
    })
    .filter((entry): entry is StylistRecommendedProduct => Boolean(entry))
    .slice(0, 5);

  if (recommendations.length && !recommendations.some((recommendation) => hasExactProductLink(productsById.get(recommendation.productId)))) {
    const usedIds = new Set(recommendations.map((recommendation) => recommendation.productId));
    const exactFallback = renderableProducts.find((product) => hasExactProductLink(product) && !usedIds.has(product.id));
    if (exactFallback) {
      recommendations[recommendations.length - 1] = {
        productId: exactFallback.id,
        reason: `${exactFallback.brand} has a real merchant product page, keeping this recommendation shoppable instead of search-only.`,
      };
    }
  }

  return recommendations;
}

export async function generateApiStylistResponse(message: string, context: StylistContext, allowAi = true): Promise<StylistResponse> {
  const localFallback = generateLocalStylistResponse(message, context);
  const intentFallback = detectIntent(message);
  const actionFallback = fallbackActionsForIntent(intentFallback);
  const systemPrompt =
    'You are Syli, Sylistly’s AI stylist. Answer like a practical fashion product assistant, not a marketing bot. ' +
    'Use only the provided app context. Do not invent closet items, saved fits, purchases, body measurements, weather, brands, or products. ' +
    'When the user asks for an outfit, route them to Builder and give a concrete plan from available categories/signals. ' +
    'Treat knownProducts as real catalog or user-touched products that can be recommended. Prefer complete outfit foundations: top, bottom, shoes, then outer, bag, hat, eyewear, jewelry. ' +
    'When recommending products, only use product ids from knownProducts. ' +
    'Return strict JSON only with this schema: ' +
    '{"message":string,"intent":string,"actions":[{"label":string,"href":"/build|/wardrobe|/discover|/saved|/feed|/canvas|/profile|/stylist","primary":boolean}],"recommendedProducts":[{"productId":string,"reason":string}],"reasoningSummary":string}.';
  const compactPayload = JSON.stringify({
    userMessage: message,
    detectedIntent: intentFallback,
    appContext: compactContext(context),
  });

  const client = getClient();
  const ollama = getOllamaConfig();
  if (!client && !ollama) return localFallback;
  // Cost governor: rate-limited, killed, or over the daily cap → free responder.
  // (Anthropic budget gates the paid client; a user-run Ollama endpoint is exempt.)
  if (allowAi === false) return localFallback;
  const anthropicAllowed = Boolean(client) && aiBudgetAvailable();
  if (!anthropicAllowed && !ollama) return localFallback;

  try {
    let text = '';
    let provider = 'anthropic';

    if (client && anthropicAllowed) {
      const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
      const response = await withTimeout(
        client.messages.create({
          model,
          max_tokens: 700,
          system: systemPrompt,
          messages: [{ role: 'user', content: compactPayload }],
        }),
        STYLIST_TIMEOUT_MS,
        'Syli AI timed out',
      );
      recordAiUsage(model, response.usage);

      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } else if (ollama) {
      provider = 'ollama';
      const response = await withTimeout(
        fetch(`${ollama.baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollama.apiKey}`,
          },
          body: JSON.stringify({
            model: ollama.model,
            stream: false,
            format: 'json',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: compactPayload },
            ],
          }),
        }),
        STYLIST_TIMEOUT_MS,
        'Syli Ollama timed out',
      );
      if (!response.ok) throw new Error(`Ollama API failed with ${response.status}`);
      const data = await response.json() as { message?: { content?: unknown } };
      text = typeof data.message?.content === 'string' ? data.message.content : '';
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Syli AI returned no JSON');

    const parsed = JSON.parse(match[0]) as Partial<StylistResponse>;
    const intent = sanitizeIntent(parsed.intent, intentFallback);
    const messageText = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim().slice(0, 1_200)
      : localFallback.message;
    const recommendedProducts = sanitizeRecommendedProducts(parsed.recommendedProducts, context);

    return {
      message: messageText,
      intent,
      actions: sanitizeActions(parsed.actions, parsed.actions?.length ? actionFallback : localFallback.actions),
      recommendedProducts: recommendedProducts.length
        ? recommendedProducts
        : localFallback.recommendedProducts,
      mode: 'api',
      reasoningSummary: typeof parsed.reasoningSummary === 'string'
        ? parsed.reasoningSummary.slice(0, 280)
        : `${provider} response sanitized against local context.`,
    };
  } catch (error) {
    console.warn('[stylist/ai] falling back to local responder: %s', error instanceof Error ? error.message : String(error));
    return localFallback;
  }
}
