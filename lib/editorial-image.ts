/**
 * Optional AI editorial-photo generation for a fit. Renders a full-body model
 * wearing the look as a studio lookbook image, via Gemini 2.5 Flash Image
 * ("nano-banana") — cheap (~$0.04/image) and gen-from-text. Opt-in per fit.
 *
 * Configure: set GEMINI_API_KEY (or NEXT_PUBLIC nothing — server only). Without
 * it, isEditorialImageConfigured() is false and the UI hides the button.
 *
 * Note: text-to-image renders a model in a SIMILAR look (not a pixel-exact
 * try-on of the catalog products) — same approach as the reference mockups.
 */
import type { Category, Product } from './types';

const MODEL = process.env.EDITORIAL_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30_000;

export function isEditorialImageConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const SLOT_WORD: Partial<Record<Category, string>> = {
  hat: 'hat', outer: 'jacket/outerwear', top: 'top', bottom: 'bottoms',
  shoes: 'shoes', bag: 'bag', eyewear: 'eyewear', jewelry: 'jewelry',
};

export interface EditorialLookInput {
  products: Product[];
  vibe?: string;
  frame?: 'masc' | 'fem' | 'androgynous';
  stylingNotes?: string;
  palette?: string[];
}

function buildPrompt({ products, vibe, frame, stylingNotes, palette }: EditorialLookInput): string {
  const pieces = products
    .map((p) => {
      const slot = SLOT_WORD[p.category] || p.category;
      const colors = (p.colors || []).slice(0, 2).join('/');
      return `${slot}: ${colors ? `${colors} ` : ''}${p.brand} ${p.name}`.slice(0, 90);
    })
    .join('; ');
  const model = frame === 'masc' ? 'a male model' : frame === 'fem' ? 'a female model' : 'a model';
  const paletteLine = palette?.length ? ` Color palette: ${palette.slice(0, 4).join(', ')}.` : '';
  return [
    `Editorial fashion lookbook photograph: full-body shot of ${model} wearing this complete outfit, standing in a clean studio.`,
    `Outfit — ${pieces}.`,
    vibe ? `Style/vibe: ${vibe}.` : '',
    stylingNotes ? `Styling: ${stylingNotes}.` : '',
    paletteLine,
    'Premium magazine aesthetic, soft studio lighting, seamless warm-cream background, sharp focus, natural pose, no text or logos overlaid.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1600);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('editorial image timed out')), ms)),
  ]);
}

export interface EditorialImageResult {
  ok: boolean;
  image?: string; // data URL
  reason?: string;
}

export async function generateEditorialLookImage(input: EditorialLookInput): Promise<EditorialImageResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: 'not-configured' };
  if (!input.products.length) return { ok: false, reason: 'no-products' };

  try {
    const res = await withTimeout(
      fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }),
      TIMEOUT_MS,
    );
    if (!res.ok) {
      return { ok: false, reason: `provider-${res.status}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      const b64 = inline?.data;
      const mime = (inline as { mimeType?: string })?.mimeType || (inline as { mime_type?: string })?.mime_type || 'image/png';
      if (b64) return { ok: true, image: `data:${mime};base64,${b64}` };
    }
    return { ok: false, reason: 'no-image' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'error' };
  }
}
