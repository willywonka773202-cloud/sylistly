import type { Category, SearchIntent } from './types';
import type { GeneratorFrame } from './vibes';

const FRAME_VALUES = new Set(['masc', 'fem', 'androgynous']);
const GENDER_TERMS = /\b(men|mens|men's|male|women|womens|women's|female|unisex|androgynous)\b/i;
const LIGHT_BIAS_CATEGORIES = new Set<Category>(['bag', 'eyewear', 'jewelry', 'hat']);

export function normalizeSearchFrame(value: unknown): GeneratorFrame {
  return typeof value === 'string' && FRAME_VALUES.has(value)
    ? (value as GeneratorFrame)
    : 'androgynous';
}

export function frameDisplayLabel(frame: GeneratorFrame): string {
  if (frame === 'masc') return 'Menswear';
  if (frame === 'fem') return 'Womenswear';
  return 'Neutral';
}

export function frameBiasDescription(frame: GeneratorFrame): string {
  if (frame === 'masc') return "Biasing results toward men's sizing, cuts, and styling.";
  if (frame === 'fem') return "Biasing results toward women's sizing, cuts, and styling.";
  return 'Keeping results unisex and flexible unless your query is specific.';
}

export function withFrameBias(
  query: string,
  category: Category | undefined,
  frame: GeneratorFrame,
): string {
  const trimmed = query.trim();
  if (!trimmed || frame === 'androgynous' || GENDER_TERMS.test(trimmed)) return trimmed;

  const prefix = frame === 'masc' ? "men's" : "women's";
  const softerPrefix = frame === 'masc' ? 'menswear' : 'womenswear';

  if (category && LIGHT_BIAS_CATEGORIES.has(category)) {
    return `${trimmed} ${softerPrefix}`.trim();
  }

  return `${prefix} ${trimmed}`.trim();
}

export function applyFrameToIntent(intent: SearchIntent, frame: GeneratorFrame): SearchIntent {
  return {
    ...intent,
    gender: frame,
    keywords: Array.from(
      new Set([
        ...(intent.keywords || []),
        frame === 'masc' ? 'menswear' : frame === 'fem' ? 'womenswear' : 'unisex',
      ]),
    ),
  };
}
