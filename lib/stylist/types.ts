// Shared types for the Syli AI stylist.
//
// Designed so the on-device local-rule-based responder and a future
// API-backed responder can implement the same `StylistResponse` shape
// — the UI doesn't have to care which mode produced the answer.

import type { Category, Product } from '@/lib/types';

export type StylistRole = 'user' | 'syli' | 'system';

export type StylistUserIntent =
  | 'outfit_request'
  | 'rate_current_fit'
  | 'packing_list'
  | 'complete_closet'
  | 'shopping_advice'
  | 'style_dna'
  | 'build_around_piece'
  | 'saved_fit_remix'
  | 'unknown';

export type StylistMode = 'local' | 'api';

export interface StylistAction {
  label: string;
  href: string;
  /** When true, UI should treat this as the primary suggested next step. */
  primary?: boolean;
}

export interface StylistRecommendedProduct {
  productId: string;
  reason: string;
}

export interface StylistMessage {
  id: string;
  role: StylistRole;
  text: string;
  ctas?: StylistAction[];
  /** Optional structured payload, e.g. for product recommendations. */
  recommendedProducts?: StylistRecommendedProduct[];
  /** UI-friendly metadata so a message can render with the right chrome. */
  mode?: StylistMode;
  createdAt?: string;
}

export interface StylistResponse {
  /** Free-text answer for the chat bubble. */
  message: string;
  /** Best-guess intent for analytics + UI affordance. */
  intent: StylistUserIntent;
  /** Suggested next-step buttons. Empty array means no CTAs. */
  actions: StylistAction[];
  /** Optional structured product picks (used by future API mode). */
  recommendedProducts?: StylistRecommendedProduct[];
  /** Which engine produced this response. */
  mode: StylistMode;
  /** Short internal reasoning summary — never shown raw; could be logged. */
  reasoningSummary?: string;
}

export interface StylistContext {
  // ── counts ────────────────────────────────────────────────────
  savedFitCount: number;
  closetCount: number;
  wishlistCount: number;
  likedFeedCount: number;
  currentFitPieceCount: number;
  currentFitTotalCents: number;
  // ── what the user is wearing right now ────────────────────────
  currentFitCategories: Category[];
  currentFitMissingRequiredSlots: Category[];
  // ── wardrobe shape ────────────────────────────────────────────
  closetCategories: Category[];
  wardrobeMissingCategories: Category[];
  closetDistribution: Partial<Record<Category, number>>;
  // ── signals from saved fits + liked posts ─────────────────────
  topSavedVibes: string[];
  topBrands: string[];
  topCategories: Category[];
  budgetTendency: 'budget' | 'smart' | 'premium' | 'luxury' | 'unknown';
  // ── small summaries the UI can render as cards ────────────────
  recentSavedFitSummary: Array<{ id: string; title: string; itemCount: number; totalCents: number }>;
  recentWardrobeSummary: Array<{ id: string; productId: string; category: Category; brand: string; status: 'closet' | 'wishlist' }>;
  // ── meta ──────────────────────────────────────────────────────
  hasEnoughDataForStyleDNA: boolean;
  /** Real products available to recommend. This includes user-touched items
   * plus a small catalog preview so new users can still get real picks. */
  knownProducts: Product[];
}

export interface StylistSuggestion {
  intent: StylistUserIntent;
  title: string;
  body: string;
  prompt: string;
}
