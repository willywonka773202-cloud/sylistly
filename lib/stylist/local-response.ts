// Local rule-based Syli responder.
//
// Pure function: `generateLocalStylistResponse(input, context) →
// StylistResponse`. No React, no global state, no external calls. Every
// number quoted in a response is sourced from the StylistContext, which
// itself derives from real local app state.
//
// When/if a real AI backend is wired, the page can call a different
// function (e.g. `requestApiStylistResponse`) with the same context;
// the UI consumes the same StylistResponse shape, so the swap is local.

import type { Category, Product } from '@/lib/types';
import { hasExactProductLink, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import type {
  StylistAction,
  StylistRecommendedProduct,
  StylistContext,
  StylistResponse,
  StylistUserIntent,
} from './types';

const OUTFIT_FOUNDATION_CATEGORIES: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat'];

const HERO_COMPLEMENT_CATEGORIES: Record<Category, Category[]> = {
  top: ['top', 'bottom', 'shoes', 'outer', 'bag'],
  bottom: ['bottom', 'top', 'shoes', 'outer', 'bag'],
  shoes: ['shoes', 'bottom', 'top', 'outer', 'bag'],
  outer: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  bag: ['bag', 'top', 'bottom', 'shoes', 'outer'],
  hat: ['hat', 'top', 'bottom', 'shoes', 'outer'],
  eyewear: ['eyewear', 'top', 'bottom', 'shoes', 'outer'],
  jewelry: ['jewelry', 'top', 'bottom', 'shoes', 'outer'],
};

const PROMPT_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'around', 'build', 'make', 'fit', 'look',
  'outfit', 'today', 'please', 'that', 'this', 'from', 'into', 'what',
  'should', 'would', 'could', 'wear', 'piece', 'pieces',
]);

export function detectIntent(input: string): StylistUserIntent {
  const text = input.toLowerCase();
  if (text.includes('pack') || text.includes('trip') || text.includes('travel')) return 'packing_list';
  if (
    text.includes('buy') ||
    text.includes('shop') ||
    text.includes('purchase') ||
    text.includes('what should i') ||
    text.includes('next')
  )
    return 'shopping_advice';
  if (text.includes('remix') || text.includes('saved fit') || text.includes('saved style')) return 'saved_fit_remix';
  if (
    text.includes('closet') ||
    text.includes('wardrobe') ||
    text.includes('gap') ||
    text.includes('missing') ||
    text.includes('complete')
  )
    return 'complete_closet';
  if (
    text.includes('rate') ||
    text.includes('score') ||
    text.includes('current fit') ||
    text.includes('review')
  )
    return 'rate_current_fit';
  if (text.includes('style dna') || text.includes('my style') || text.includes('archetype')) return 'style_dna';
  if (
    text.includes('around') ||
    text.includes('anchor') ||
    text.includes('build around') ||
    text.includes('this piece')
  )
    return 'build_around_piece';
  if (
    text.includes('make') ||
    text.includes('outfit') ||
    text.includes('build') ||
    text.includes('look') ||
    text.includes('fit')
  )
    return 'outfit_request';
  return 'unknown';
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function categoryLabel(category: Category): string {
  if (category === 'hat') return 'headwear';
  return category;
}

function productText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.category,
    product.retailer,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    ...(product.colors || []),
  ].join(' ').toLowerCase();
}

function promptTerms(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !PROMPT_STOPWORDS.has(term))
    .slice(0, 12);
}

function inferHeroCategory(input: string): Category | null {
  const text = input.toLowerCase();
  if (/\b(sneaker|sneakers|shoe|shoes|boot|boots|loafer|loafers|sandal|sandals)\b/.test(text)) return 'shoes';
  if (/\b(bag|bags|tote|purse|crossbody|backpack|satchel)\b/.test(text)) return 'bag';
  if (/\b(jacket|coat|outer|outerwear|blazer|hoodie|cardigan)\b/.test(text)) return 'outer';
  if (/\b(pant|pants|trouser|trousers|jean|jeans|skirt|shorts|bottom)\b/.test(text)) return 'bottom';
  if (/\b(shirt|tee|t-shirt|top|sweater|knit|tank|blouse)\b/.test(text)) return 'top';
  if (/\b(hat|cap|beanie|headwear)\b/.test(text)) return 'hat';
  if (/\b(sunglasses|glasses|frames|eyewear)\b/.test(text)) return 'eyewear';
  if (/\b(jewelry|jewellery|ring|necklace|bracelet|earring|earrings)\b/.test(text)) return 'jewelry';
  return null;
}

function productPromptScore(product: Product, terms: string[]): number {
  if (terms.length === 0) return product.popularityScore || 0;
  const text = productText(product);
  const matchScore = terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  return matchScore * 1000 + (product.popularityScore || 0);
}

function comparePromptProductFit(left: Product, right: Product, terms: string[]): number {
  const leftExact = hasExactProductLink(left) ? 1 : 0;
  const rightExact = hasExactProductLink(right) ? 1 : 0;
  const leftTransparent = left.imageTransparentUrl || left.imageCutoutUrl ? 1 : 0;
  const rightTransparent = right.imageTransparentUrl || right.imageCutoutUrl ? 1 : 0;
  const promptDifference = productPromptScore(right, terms) - productPromptScore(left, terms);

  if (terms.length > 0) {
    return promptDifference
      || rightExact - leftExact
      || rightTransparent - leftTransparent;
  }

  return rightExact - leftExact
    || rightTransparent - leftTransparent
    || promptDifference;
}

function action(label: string, href: string, primary = false): StylistAction {
  return { label, href, primary };
}

function build(
  message: string,
  intent: StylistUserIntent,
  actions: StylistAction[],
  reasoningSummary: string,
  recommendedProducts: StylistRecommendedProduct[] = [],
): StylistResponse {
  return { message, intent, actions, recommendedProducts, mode: 'local', reasoningSummary };
}

function pickKnownProducts(
  context: StylistContext,
  categories: Category[],
  limit = 5,
  input = '',
): StylistRecommendedProduct[] {
  const realCutoutProducts = sortTransparentFeedRenderableProducts(context.knownProducts);
  const terms = promptTerms(input);
  const picked: Product[] = [];
  const usedIds = new Set<string>();

  for (const category of categories) {
    const candidate = realCutoutProducts
      .filter((product) =>
        product.category === category
        && !usedIds.has(product.id)
      )
      .sort((left, right) => comparePromptProductFit(left, right, terms))[0];
    if (!candidate) continue;
    usedIds.add(candidate.id);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }

  if (picked.length && !picked.some(hasExactProductLink)) {
    const exactFallback = realCutoutProducts.find((product) => hasExactProductLink(product) && !usedIds.has(product.id));
    if (exactFallback) {
      picked[picked.length - 1] = exactFallback;
    }
  }

  return picked.map((product) => ({
    productId: product.id,
    reason: hasExactProductLink(product)
      ? `${product.brand} ${categoryLabel(product.category)} is a real exact merchant-linked cutout Syli can place into the look.`
      : `${product.brand} ${categoryLabel(product.category)} is a real linked cutout Syli can place into the look.`,
  }));
}

function productLookup(context: StylistContext): Map<string, Product> {
  return new Map(context.knownProducts.map((product) => [product.id, product]));
}

function recommendationSummary(context: StylistContext, recommendations: StylistRecommendedProduct[]): string {
  const productsById = productLookup(context);
  return recommendations
    .map((recommendation) => productsById.get(recommendation.productId))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 4)
    .map((product) => `${product.brand} ${categoryLabel(product.category)}`)
    .join(', ');
}

function buildAroundRecommendations(input: string, context: StylistContext): StylistRecommendedProduct[] {
  const heroCategory = inferHeroCategory(input) || 'outer';
  const categories = HERO_COMPLEMENT_CATEGORIES[heroCategory];
  const recommendations = pickKnownProducts(context, categories, 5, input);
  if (!recommendations.length) return [];

  const productsById = productLookup(context);
  const hero = productsById.get(recommendations[0].productId);
  return recommendations.map((recommendation, index) => {
    const product = productsById.get(recommendation.productId);
    if (!product) return recommendation;
    if (index === 0) {
      return {
        ...recommendation,
        reason: `${product.brand} ${product.name} is the real linked ${categoryLabel(product.category)} Syli is anchoring around.`,
      };
    }
    return {
      ...recommendation,
      reason: `${product.brand} ${categoryLabel(product.category)} balances the ${hero ? categoryLabel(hero.category) : 'anchor'} without adding fake inventory.`,
    };
  });
}

export function generateLocalStylistResponse(input: string, context: StylistContext): StylistResponse {
  const intent = detectIntent(input);

  if (intent === 'rate_current_fit') {
    if (context.currentFitPieceCount === 0) {
      return build(
        'I do not see a current build yet. Open Builder, add a top, bottom, and shoes, then I can rate the real fit from those local pieces.',
        intent,
        [action('Open Builder', '/build', true)],
        'no current fit pieces',
      );
    }
    const missing = context.currentFitMissingRequiredSlots.map(categoryLabel);
    const score = Math.min(10, Math.max(4, context.currentFitPieceCount + (missing.length === 0 ? 3 : 0)));
    const totalLabel = formatPrice(context.currentFitTotalCents);
    if (missing.length === 0) {
      return build(
        `Your current fit has ${context.currentFitPieceCount} piece${context.currentFitPieceCount === 1 ? '' : 's'} and covers the required top, bottom, and shoes slots. Local read: ${score}/10. Estimated total ${totalLabel}. Next move: refine accessories or save it.`,
        intent,
        [action('Save or refine fit', '/build', true), action('Open Canvas', '/canvas')],
        'fit complete',
      );
    }
    return build(
      `Your current fit has ${context.currentFitPieceCount} piece${context.currentFitPieceCount === 1 ? '' : 's'} with an estimated total of ${totalLabel}. Local read: ${score}/10 because it is missing ${missing.join(', ')}. Fill those slots before styling accessories.`,
      intent,
      [action('Finish in Builder', '/build', true), action('Open Canvas', '/canvas')],
      'fit missing required slots',
    );
  }

  if (intent === 'packing_list') {
    const gaps = context.wardrobeMissingCategories.map(categoryLabel);
    const closetCount = context.closetCount;
    const savedCount = context.savedFitCount;
    if (gaps.length === 0) {
      return build(
        `Packing base is strong: ${closetCount} closet piece${closetCount === 1 ? '' : 's'} and ${savedCount} saved fit${savedCount === 1 ? '' : 's'} cover the core categories. Use saved outfits as complete looks, then add one backup top and shoes from your closet.`,
        intent,
        [action('Review saved fits', '/saved', true), action('Open Canvas', '/canvas')],
        'packing base healthy',
      );
    }
    return build(
      `For a packing list, I can use ${closetCount} closet piece${closetCount === 1 ? '' : 's'} and ${savedCount} saved fit${savedCount === 1 ? '' : 's'}. Your local data is light on ${gaps.slice(0, 4).join(', ')}, so add those before relying on this as a complete trip list.`,
      intent,
      [action('Fill wardrobe gaps', '/wardrobe', true), action('Open Canvas', '/canvas')],
      'packing gaps detected',
    );
  }

  if (intent === 'complete_closet') {
    const gaps = context.wardrobeMissingCategories.map(categoryLabel);
    const strongest = Object.entries(context.closetDistribution)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 2)
      .map(([category]) => categoryLabel(category as Category));
    if (gaps.length === 0) {
      return build(
        `Your closet covers all core Sylistly categories. Strongest areas: ${strongest.join(', ') || 'balanced basics'}. Next move is editing quality, not adding volume.`,
        intent,
        [action('Open Wardrobe', '/wardrobe', true), action('Shop Discover', '/discover')],
        'closet complete',
      );
    }
    return build(
      `Your closet has ${context.closetCount} real piece${context.closetCount === 1 ? '' : 's'} and ${context.wishlistCount} wishlist piece${context.wishlistCount === 1 ? '' : 's'}. The clearest gaps are ${gaps.slice(0, 5).join(', ')}. Start with top, bottom, and shoes if any are missing, then add outerwear and bag for complete outfit range.`,
      intent,
      [action('Open Wardrobe', '/wardrobe', true), action('Shop Discover', '/discover')],
      'closet gaps detected',
      pickKnownProducts(context, context.wardrobeMissingCategories.slice(0, 5), 5, input),
    );
  }

  if (intent === 'shopping_advice') {
    const gaps = context.wardrobeMissingCategories.map(categoryLabel);
    if (gaps.length > 0) {
      return build(
        `Buy next should solve a real gap: ${gaps.slice(0, 4).join(', ')}. Discover can show catalog-backed options, and Wardrobe can save them to wishlist before you commit.`,
        intent,
        [action('Open Discover', '/discover', true), action('Open Wardrobe', '/wardrobe')],
        'shopping gap-driven',
        pickKnownProducts(context, context.wardrobeMissingCategories.slice(0, 4), 4, input),
      );
    }
    const topSignal = context.topSavedVibes[0] || context.topCategories[0] || 'your saved style data';
    return build(
      `Your closet covers every planning category. Buy next should upgrade quality, not volume. Strongest signal is ${topSignal}.`,
      intent,
      [action('Open Discover', '/discover', true), action('Open Wardrobe', '/wardrobe')],
      'shopping quality upgrade',
      pickKnownProducts(context, ['outer', 'shoes', 'bag', 'top'], 4, input),
    );
  }

  if (intent === 'style_dna') {
    if (!context.hasEnoughDataForStyleDNA) {
      return build(
        `Style DNA is still building. I count ${context.savedFitCount} saved fit${context.savedFitCount === 1 ? '' : 's'} and ${context.closetCount} closet piece${context.closetCount === 1 ? '' : 's'}. Save a few more fits or add a few real pieces so the signal stabilises.`,
        intent,
        [action('Browse feed', '/feed', true), action('Open Wardrobe', '/wardrobe')],
        'insufficient data for DNA',
      );
    }
    return build(
      `Local Style DNA: top vibes — ${context.topSavedVibes.join(', ') || '—'}; top categories — ${context.topCategories.join(', ') || '—'}; top brands — ${context.topBrands.join(', ') || '—'}; budget tendency — ${context.budgetTendency}.`,
      intent,
      [action('See full DNA report', '/profile', true), action('Browse feed', '/feed')],
      'DNA derived',
    );
  }

  if (intent === 'build_around_piece') {
    const recommendations = buildAroundRecommendations(input, context);
    const summary = recommendationSummary(context, recommendations);
    if (recommendations.length) {
      return build(
        `I picked a real anchor and built around it from linked cutouts: ${summary || 'a complete catalog-backed starter look'}. Tap Build or Studio on the preview to use these exact merchant product pages.`,
        intent,
        [action('Build this look', '/build', true), action('Edit in Studio', '/canvas'), action('Browse Discover', '/discover')],
        'build around real catalog anchor',
        recommendations,
      );
    }
    return build(
      `I can help you build around a real selected piece, but this beta will not invent items. Open Wardrobe to choose an owned or wished item, or open Builder and lock the anchor piece before generating around it.`,
      intent,
      [
        action(
          context.closetCount + context.wishlistCount > 0 ? 'Choose from Wardrobe' : 'Open Builder',
          context.closetCount + context.wishlistCount > 0 ? '/wardrobe' : '/build',
          true,
        ),
        action('Open Discover', '/discover'),
      ],
      'piece anchor requires real selection',
    );
  }

  if (intent === 'saved_fit_remix') {
    if (context.savedFitCount === 0) {
      return build(
        `There are no saved fits yet. Build or save one first, then I can help you remix from a real outfit library.`,
        intent,
        [action('Open Builder', '/build', true), action('Browse feed', '/feed')],
        'no saved fits',
      );
    }
    return build(
      `You have ${context.savedFitCount} saved fit${context.savedFitCount === 1 ? '' : 's'} to remix. Start in Saved, load one into Builder, then use locked slots to keep the pieces that define your style.`,
      intent,
      [action('Open Saved', '/saved', true), action('Open Builder', '/build')],
      'saved fits available',
    );
  }

  if (intent === 'outfit_request') {
    const recommendations = pickKnownProducts(context, OUTFIT_FOUNDATION_CATEGORIES, 6, input);
    const summary = recommendationSummary(context, recommendations);
    return build(
      summary
        ? `I made a real linked starter fit from the catalog: ${summary}. It starts with top, bottom, and shoes, then adds shape with outerwear or a bag when available. Tap Build or Studio on the preview to use these exact cutout-backed pieces.`
        : `I can start this in Builder using the real generator and catalog-backed products. Current context: ${context.currentFitPieceCount} build pieces, ${context.closetCount} closet pieces, ${context.savedFitCount} saved fits. Start with top, bottom, and shoes, then add outerwear or a bag if the vibe needs more shape.`,
      intent,
      [action('Make outfit in Builder', '/build', true), action('Edit in Studio', '/canvas'), action('Open Discover', '/discover')],
      'outfit_request routed to builder',
      recommendations,
    );
  }

  // unknown — be honest and surface real state instead of making up an answer.
  return build(
    `I am Syli in beta. I read your real saved fits, wardrobe, wishlist, current build, and linked cutout catalog to suggest next moves. I will not invent products or fake purchase links. Try a prompt card, or ask me to rate your current fit, complete your closet, or build around shoes, a jacket, or a bag.`,
    intent,
    [action('Open Builder', '/build'), action('Open Wardrobe', '/wardrobe'), action('Browse feed', '/feed')],
    'unknown intent fallback',
  );
}
