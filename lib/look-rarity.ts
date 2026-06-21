import { hasExactProductLink } from './product-image-quality';
import type { Category, Product } from './types';

/**
 * HONEST rarity tiers (CS:GO-crate energy, none of the gambling). A look's tier
 * is derived deterministically from its REAL quality — how shoppable it is, how
 * complete, how premium, and whether Claude composed it — so a "Heat" look is
 * genuinely a standout, not a random roll. Same look ⇒ same tier (truthful);
 * the variety across the deck is what makes each landing feel like a pull.
 */
export type RarityTier = 'everyday' | 'standout' | 'showpiece' | 'heat';

export interface Rarity {
  tier: RarityTier;
  /** 0–3, drives sound richness / celebration intensity. */
  level: number;
  label: string;
  hue: string;
}

const TIERS: Record<RarityTier, Omit<Rarity, 'tier'>> = {
  everyday: { level: 0, label: 'Everyday', hue: '#b8b1a4' },
  standout: { level: 1, label: 'Standout', hue: '#5fa8ff' },
  showpiece: { level: 2, label: 'Showpiece', hue: '#FF2D6D' },
  heat: { level: 3, label: 'Heat', hue: '#FFC24B' },
};

export function lookRarity(
  items: Partial<Record<Category, Product>>,
  source?: string,
): Rarity {
  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  const n = products.length;
  if (!n) return { tier: 'everyday', ...TIERS.everyday };

  const exact = products.filter((product) => hasExactProductLink(product)).length;
  const totalCents = products.reduce((sum, product) => sum + (product.priceCents || 0), 0);

  // Shoppability + completeness are the backbone; premium + Claude-composed lift it.
  let score = (exact / n) * 38 + (Math.min(n, 8) / 8) * 22;
  if (totalCents >= 180000) score += 22;
  else if (totalCents >= 90000) score += 13;
  else if (totalCents >= 45000) score += 6;
  if (source === 'syli') score += 16;

  const tier: RarityTier =
    score >= 82 ? 'heat' : score >= 64 ? 'showpiece' : score >= 44 ? 'standout' : 'everyday';
  return { tier, ...TIERS[tier] };
}
