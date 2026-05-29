/**
 * Client-side AI stylist engine. Assembles real outfits from the user's closet and
 * produces helpful, grounded responses. Works fully offline; the /api/stylist route
 * can enhance the prose when an Anthropic key is configured.
 */
import {
  Shirt, Star, Plane, Layers, CalendarDays, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { AestheticId, ClosetItem, Formality, OccasionKey, OutfitLayoutItem, StyleDNA } from './social-types';
import type { Category } from './types';
import { autoArrange } from './outfit-layout';
import { aestheticLabel, occasionLabel } from './style';

export type StylistActionId =
  | 'make-outfit'
  | 'today'
  | 'rate'
  | 'pack'
  | 'capsule'
  | 'improve';

export const STYLIST_ACTIONS: Array<{
  id: StylistActionId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { id: 'make-outfit', title: 'Make an outfit', subtitle: 'Build a look from your closet', icon: Shirt, tone: '#efe7da' },
  { id: 'today', title: 'What to wear today', subtitle: 'A pick for your day', icon: Sparkles, tone: '#f3e7e3' },
  { id: 'rate', title: 'Rate my outfit', subtitle: 'Honest styling feedback', icon: Star, tone: '#eef0e6' },
  { id: 'pack', title: 'Pack for a trip', subtitle: 'A smart packing list', icon: Plane, tone: '#e8eef2' },
  { id: 'capsule', title: 'Capsule wardrobe', subtitle: 'Your most versatile pieces', icon: Layers, tone: '#f0ece2' },
  { id: 'improve', title: 'Improve my style', subtitle: 'Find the gaps in your closet', icon: CalendarDays, tone: '#efe7da' },
];

export interface DraftOutfit {
  itemIds: string[];
  layout: OutfitLayoutItem[];
  background: string;
  title: string;
  aesthetics: AestheticId[];
  occasion?: OccasionKey;
}

const FORMALITY_VALUE: Record<Formality, number> = { lounge: 1, casual: 2, smart: 3, formal: 4 };

interface BuildOpts {
  occasion?: OccasionKey;
  aesthetic?: AestheticId;
  formality?: Formality;
  background?: string;
  seed?: number;
}

function pick(closet: ClosetItem[], category: Category, opts: BuildOpts, exclude: Set<string>): ClosetItem | undefined {
  const pool = closet.filter((i) => i.category === category && !exclude.has(i.id));
  if (!pool.length) return undefined;
  const scored = pool.map((i) => {
    let s = 0;
    if (opts.aesthetic && i.tags.includes(opts.aesthetic)) s += 3;
    if (opts.formality && i.formality === opts.formality) s += 2;
    if (opts.formality) s -= Math.abs(FORMALITY_VALUE[i.formality] - FORMALITY_VALUE[opts.formality]);
    return { i, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s === scored[0].s).map((x) => x.i);
  const idx = (opts.seed ?? 0) % top.length;
  return top[idx];
}

/** Assemble a complete, sensible outfit from a closet. */
export function buildOutfitFromCloset(closet: ClosetItem[], opts: BuildOpts = {}): DraftOutfit | null {
  if (!closet.length) return null;
  const exclude = new Set<string>();
  const ids: string[] = [];

  const dressy = opts.aesthetic && ['datenight', 'goingout', 'formal'].includes(opts.aesthetic);
  const dress = dressy ? closet.find((i) => i.shape === 'dress' && (!opts.aesthetic || i.tags.includes(opts.aesthetic))) : undefined;

  if (dress) {
    ids.push(dress.id);
    exclude.add(dress.id);
  } else {
    const top = pick(closet, 'top', opts, exclude);
    if (top) {
      ids.push(top.id);
      exclude.add(top.id);
    }
    const bottom = pick(closet, 'bottom', opts, exclude);
    if (bottom) {
      ids.push(bottom.id);
      exclude.add(bottom.id);
    }
  }

  const shoes = pick(closet, 'shoes', opts, exclude);
  if (shoes) {
    ids.push(shoes.id);
    exclude.add(shoes.id);
  }

  const wantsOuter = opts.formality === 'smart' || opts.formality === 'formal' || opts.aesthetic === 'winter' || opts.aesthetic === 'cozy';
  if (wantsOuter) {
    const outer = pick(closet, 'outer', opts, exclude);
    if (outer) {
      ids.push(outer.id);
      exclude.add(outer.id);
    }
  }

  for (const cat of ['bag', 'jewelry', 'eyewear', 'hat'] as Category[]) {
    if (ids.length >= 5) break;
    const acc = pick(closet, cat, opts, exclude);
    if (acc) {
      ids.push(acc.id);
      exclude.add(acc.id);
    }
  }

  if (ids.length < 2) return null;

  const arrangeInput = ids
    .map((id) => closet.find((c) => c.id === id))
    .filter((c): c is ClosetItem => Boolean(c))
    .map((c) => ({ itemId: c.id, category: c.category }));

  const title =
    opts.occasion ? `${occasionLabel(opts.occasion)} look` : opts.aesthetic ? `${aestheticLabel(opts.aesthetic)} look` : 'Fresh look';

  return {
    itemIds: ids,
    layout: autoArrange(arrangeInput, 'editorial'),
    background: opts.background || 'paper',
    title,
    aesthetics: opts.aesthetic ? [opts.aesthetic] : [],
    occasion: opts.occasion,
  };
}

function topAesthetic(dna: StyleDNA): AestheticId | undefined {
  let best: AestheticId | undefined;
  let bestVal = 0;
  for (const [k, v] of Object.entries(dna.aesthetics) as Array<[AestheticId, number]>) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}

export interface StylistReply {
  text: string;
  bullets?: string[];
  outfit?: DraftOutfit;
}

/** Produce a grounded stylist reply for an action or free-text message. */
export function composeReply(
  actionId: StylistActionId,
  ctx: { closet: ClosetItem[]; dna: StyleDNA; occasion?: OccasionKey; seed?: number },
): StylistReply {
  const { closet, dna } = ctx;
  const aesthetic = ctx.occasion ? undefined : topAesthetic(dna);
  const categories = new Set(closet.map((c) => c.category));
  const seed = ctx.seed ?? 0;

  switch (actionId) {
    case 'make-outfit':
    case 'today': {
      const occasion = ctx.occasion;
      const outfit = buildOutfitFromCloset(closet, { occasion, aesthetic, seed });
      if (!outfit) {
        return { text: 'Add a few pieces to your closet and I’ll build you a complete look in seconds.' };
      }
      const lead =
        actionId === 'today'
          ? 'Here’s a clean pick for today'
          : occasion
            ? `Here’s a ${occasionLabel(occasion).toLowerCase()} look I pulled together`
            : 'Here’s a look I styled from your closet';
      return {
        text: `${lead} — ${outfit.itemIds.length} pieces that work together. Tap to open it in the editor or save it.`,
        outfit,
      };
    }
    case 'rate': {
      const recent = closet.length;
      const score = Math.min(9.4, 6.2 + Math.min(2, categories.size * 0.4) + (dna.likes > 5 ? 0.6 : 0));
      return {
        text: `Based on your closet, your styling instincts are landing around ${score.toFixed(1)}/10. Here’s how to push it higher:`,
        bullets: [
          'Anchor each fit around one hero piece and keep the rest quiet.',
          categories.has('jewelry') ? 'Your accessory game is strong — keep using it to finish looks.' : 'Add one accessory (a watch, chain, or bag) to finish your fits.',
          'Repeat 2–3 colors max per outfit for an editorial, cohesive feel.',
        ],
      };
    }
    case 'pack': {
      return {
        text: 'Here’s a versatile 4-day capsule that mixes into 6+ outfits:',
        bullets: [
          '2 tops (1 neutral tee, 1 elevated knit or shirt)',
          '2 bottoms (1 denim, 1 tailored)',
          '1 layer (overshirt, blazer, or light jacket)',
          '2 shoes (1 sneaker, 1 dressier)',
          '1 bag + sunglasses to tie it together',
        ],
        outfit: buildOutfitFromCloset(closet, { occasion: 'travel', aesthetic: 'minimalist', seed }) ?? undefined,
      };
    }
    case 'capsule': {
      const versatile = closet
        .filter((i) => ['minimalist', 'oldmoney', 'casual', 'businesscasual'].some((t) => i.tags.includes(t as AestheticId)))
        .slice(0, 8);
      return {
        text: 'A capsule is a small set of pieces that all work together. From your closet, these are your most mixable foundations:',
        bullets: versatile.length
          ? versatile.map((i) => `${i.name} — ${i.brand}`)
          : ['Start with a white tee, blue jeans, a neutral knit, and white sneakers.'],
      };
    }
    case 'improve': {
      const allCats: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'jewelry'];
      const missing = allCats.filter((c) => !categories.has(c));
      return {
        text: missing.length
          ? 'I looked at your closet and spotted a few gaps worth filling:'
          : 'Your closet is well-rounded! To level up, focus on cohesion and quality over quantity:',
        bullets: missing.length
          ? missing.map((c) => `Add a ${c === 'outer' ? 'layer (jacket/coat)' : c} — it unlocks more complete outfits.`)
          : [
              'Invest in one elevated neutral coat — it lifts everything.',
              'Build around a 3-color palette you love.',
              'Tailoring beats trends: fit is everything.',
            ],
      };
    }
    default:
      return { text: 'Tell me an occasion and I’ll style you a look.' };
  }
}
