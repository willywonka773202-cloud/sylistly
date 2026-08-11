/**
 * Client bridge to the live Claude outfit composer (`POST /api/look`). The feed
 * deals an instant deterministic look, then calls this to swap in a genuinely
 * AI-styled one (the "Styled by Syli" upgrade) for every card. Returns null
 * unless the server actually used Claude (source === 'ai') and produced a
 * renderable look — so a no-credit / rate-limited / budget-capped response
 * leaves the deterministic look in place.
 */
import { lookProducts, type ScrollLook } from '@/lib/look-helpers';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

export interface AiLookRequest {
  /** The card key to swap in place, so the AI look replaces the placeholder. */
  key: string;
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  seed: number;
  avoidProductIds?: string[];
}

export async function fetchAiLook(req: AiLookRequest, signal?: AbortSignal): Promise<ScrollLook | null> {
  try {
    const res = await fetch('/api/look', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        vibe: req.vibe,
        frame: req.frame,
        budget: req.budget,
        customMaxCents: req.customMaxCents ?? null,
        mode: 'full',
        seed: req.seed,
        diversityStrength: 'high',
        avoidProductIds: req.avoidProductIds || [],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      source?: string;
      products?: Partial<Record<Category, Product>>;
      stylingNotes?: string;
      palette?: string[];
    };
    // Only swap in a GENUINE Claude look — never a deterministic fallback.
    if (data.source !== 'ai') return null;
    const items = (data.products || {}) as Partial<Record<Category, Product>>;
    if (lookProducts(items).length < 3) return null;
    return {
      key: req.key,
      vibe: req.vibe,
      items,
      gen: 0,
      source: 'syli',
      note: typeof data.stylingNotes === 'string' ? data.stylingNotes : undefined,
      palette: Array.isArray(data.palette) ? data.palette.slice(0, 6) : undefined,
    };
  } catch {
    // Aborted, offline, or malformed — keep the deterministic look.
    return null;
  }
}
