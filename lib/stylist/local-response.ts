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

import type { Category } from '@/lib/types';
import type {
  StylistAction,
  StylistContext,
  StylistResponse,
  StylistUserIntent,
} from './types';

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

function action(label: string, href: string, primary = false): StylistAction {
  return { label, href, primary };
}

function build(
  message: string,
  intent: StylistUserIntent,
  actions: StylistAction[],
  reasoningSummary: string,
): StylistResponse {
  return { message, intent, actions, mode: 'local', reasoningSummary };
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
      );
    }
    const topSignal = context.topSavedVibes[0] || context.topCategories[0] || 'your saved style data';
    return build(
      `Your closet covers every planning category. Buy next should upgrade quality, not volume. Strongest signal is ${topSignal}.`,
      intent,
      [action('Open Discover', '/discover', true), action('Open Wardrobe', '/wardrobe')],
      'shopping quality upgrade',
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
    return build(
      `I can start this in Builder using the real generator and catalog-backed products. This chat is local guidance, so I will not pretend to generate a fit here. Current context: ${context.currentFitPieceCount} build pieces, ${context.closetCount} closet pieces, ${context.savedFitCount} saved fits.`,
      intent,
      [action('Make outfit in Builder', '/build', true), action('Open Discover', '/discover')],
      'outfit_request routed to builder',
    );
  }

  // unknown — be honest and surface real state instead of making up an answer.
  return build(
    `I am Syli in local beta. I read your real saved fits, wardrobe, wishlist, and current build to suggest next moves. I do not call an external AI yet. Try one of the prompt cards, or ask me to rate your current fit, complete your closet, or build around a piece.`,
    intent,
    [action('Open Builder', '/build'), action('Open Wardrobe', '/wardrobe'), action('Browse feed', '/feed')],
    'unknown intent fallback',
  );
}
