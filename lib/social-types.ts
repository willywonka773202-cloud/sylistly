/**
 * Domain model for the social AI fashion app.
 *
 * Pure types + plain-data taxonomy (no React / no icons) so this module is safe to
 * import anywhere (server or client). Icon maps live in `lib/style.ts`.
 *
 * These shapes intentionally mirror what a relational backend would store
 * (ClosetItem, Outfit, OutfitLayout, Creator, CommunityPost, Story, Comment,
 * PlannerEntry, StylePreference) so the seeded data layer can migrate to a DB later.
 */
import type { Category } from './types';
import type { GarmentShape } from './garment-art';

export type AestheticId =
  | 'minimalist'
  | 'streetwear'
  | 'oldmoney'
  | 'athletic'
  | 'preppy'
  | 'businesscasual'
  | 'goingout'
  | 'summer'
  | 'winter'
  | 'campus'
  | 'gym'
  | 'datenight'
  | 'travel'
  | 'formal'
  | 'cozy'
  | 'y2k'
  | 'coastal'
  | 'edgy'
  | 'casual';

export type OccasionKey =
  | 'work'
  | 'school'
  | 'gym'
  | 'date'
  | 'party'
  | 'travel'
  | 'formal'
  | 'casual'
  | 'interview'
  | 'dinner';

export type Formality = 'lounge' | 'casual' | 'smart' | 'formal';
export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'all';
export type Warmth = 'cool' | 'mid' | 'warm';
export type Visibility = 'private' | 'friends' | 'public';
export type LayoutPreset = 'editorial' | 'grid' | 'story' | 'flatlay' | 'catalog' | 'streetwear';

export interface ClosetItem {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory: string;
  shape: GarmentShape;
  color: string; // primary hex (drives the SVG fallback art)
  colorName: string;
  secondaryColor?: string;
  imageUrl?: string; // real product photo when available; falls back to garment art
  retailerUrl?: string;
  tags: AestheticId[];
  formality: Formality;
  season: Season;
  warmth: Warmth;
  priceCents?: number;
  shopUrl?: string;
  ownerId: string; // 'me' for the user, otherwise a creator id
  source: 'seed' | 'user';
  favorite?: boolean;
  createdAt: string;
}

export interface OutfitLayoutItem {
  itemId: string;
  /** unique instance key (lets the same garment be placed more than once) */
  key?: string;
  /** center position as a fraction of canvas size (0..1) — resolution independent */
  x: number;
  y: number;
  /** relative scale, 1 = base size */
  scale: number;
  /** degrees */
  rotation: number;
  z: number;
  flip?: boolean;
}

export interface Outfit {
  id: string;
  title: string;
  caption?: string;
  itemIds: string[];
  layout: OutfitLayoutItem[];
  background: string; // canvas background key
  preset?: LayoutPreset;
  occasion?: OccasionKey;
  aesthetics: AestheticId[];
  visibility: Visibility;
  ownerId: string;
  scheduledDate?: string; // ISO yyyy-mm-dd for planner
  storyEnabled?: boolean;
  createdAt: string;
  likes: number;
  saves: number;
  source: 'seed' | 'user';
}

export interface Creator {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  motif: GarmentShape; // garment used as avatar motif
  bio: string;
  aesthetics: AestheticId[];
  followers: number;
  following: number;
  verified?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  creatorId: string;
  outfitId: string;
  caption: string;
  likes: number;
  saves: number;
  comments: Comment[];
  occasion?: OccasionKey;
  type: 'outfit' | 'clothes';
  createdAt: string;
}

export interface Story {
  id: string;
  creatorId: string;
  outfitId: string;
  label: string;
  createdAt: string;
}

export interface PlannerEntry {
  date: string; // yyyy-mm-dd
  outfitId: string;
  occasion?: OccasionKey;
}

/** Running style-preference model learned from swipes (the "Style DNA"). */
export interface StyleDNA {
  colors: Record<string, number>;
  categories: Partial<Record<Category, number>>;
  aesthetics: Partial<Record<AestheticId, number>>;
  formalitySum: number;
  formalityCount: number;
  likes: number;
  dislikes: number;
  superlikes: number;
  seen: string[]; // outfit ids already swiped
}

export interface SwipeEvent {
  outfitId: string;
  action: 'like' | 'dislike' | 'superlike' | 'save';
  at: string;
}

/* ---------- taxonomy (plain data) ---------- */

export const AESTHETICS: Array<{ id: AestheticId; label: string; blurb: string; swatch: string }> = [
  { id: 'minimalist', label: 'Clean Minimalist', blurb: 'Neutral, sharp, considered', swatch: '#d9d3c7' },
  { id: 'streetwear', label: 'Streetwear', blurb: 'Oversized, layered, bold', swatch: '#2b2b2b' },
  { id: 'oldmoney', label: 'Old Money', blurb: 'Quiet luxury, heritage', swatch: '#8a7a52' },
  { id: 'athletic', label: 'Athletic', blurb: 'Performance, sporty, sleek', swatch: '#3f6b8a' },
  { id: 'preppy', label: 'Preppy', blurb: 'Collegiate, classic, crisp', swatch: '#1d3f6b' },
  { id: 'businesscasual', label: 'Business Casual', blurb: 'Polished but easy', swatch: '#4a4a55' },
  { id: 'goingout', label: 'Going Out', blurb: 'Night-ready, eye-catching', swatch: '#7a2f4a' },
  { id: 'summer', label: 'Summer', blurb: 'Light, airy, sunlit', swatch: '#e0b878' },
  { id: 'winter', label: 'Winter', blurb: 'Layered, warm, moody', swatch: '#4a5560' },
  { id: 'campus', label: 'Campus', blurb: 'Everyday student energy', swatch: '#9a6a3f' },
  { id: 'gym', label: 'Gym', blurb: 'Move-ready matching sets', swatch: '#2f5d52' },
  { id: 'datenight', label: 'Date Night', blurb: 'Flirty and memorable', swatch: '#a23f57' },
  { id: 'travel', label: 'Travel', blurb: 'Comfortable, put-together', swatch: '#6b8a7a' },
  { id: 'formal', label: 'Formal', blurb: 'Tailored, elegant, dressed up', swatch: '#1c1c22' },
  { id: 'cozy', label: 'Cozy', blurb: 'Soft, off-duty, warm', swatch: '#b89a7a' },
  { id: 'y2k', label: 'Y2K', blurb: 'Playful, nostalgic, daring', swatch: '#c95fa0' },
  { id: 'coastal', label: 'Coastal', blurb: 'Breezy, sandy, relaxed', swatch: '#7aa6c2' },
  { id: 'edgy', label: 'Edgy', blurb: 'Dark, sharp, statement', swatch: '#222026' },
  { id: 'casual', label: 'Casual', blurb: 'Easy everyday staples', swatch: '#b8a98a' },
];

export const OCCASIONS_SOCIAL: Array<{ key: OccasionKey; label: string; emoji: string }> = [
  { key: 'work', label: 'Work', emoji: '💼' },
  { key: 'school', label: 'School', emoji: '🎓' },
  { key: 'gym', label: 'Gym', emoji: '💪' },
  { key: 'date', label: 'Date', emoji: '💕' },
  { key: 'party', label: 'Party', emoji: '🎉' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'formal', label: 'Formal', emoji: '👔' },
  { key: 'casual', label: 'Casual', emoji: '☀️' },
  { key: 'interview', label: 'Interview', emoji: '🤝' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
];

export const FORMALITY_ORDER: Formality[] = ['lounge', 'casual', 'smart', 'formal'];
export const FORMALITY_LABELS: Record<Formality, string> = {
  lounge: 'Lounge',
  casual: 'Casual',
  smart: 'Smart',
  formal: 'Formal',
};

export const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; blurb: string }> = [
  { value: 'private', label: 'Only me', blurb: 'Stays in your closet' },
  { value: 'friends', label: 'Friends', blurb: 'People you follow each other' },
  { value: 'public', label: 'Everyone', blurb: 'Shows in the community feed' },
];

/** Curated color swatches for the editor + add-item flow. */
export const COLOR_SWATCHES: Array<{ hex: string; name: string }> = [
  { hex: '#1c1b19', name: 'Black' },
  { hex: '#3a3733', name: 'Charcoal' },
  { hex: '#6f6a62', name: 'Slate' },
  { hex: '#a39d92', name: 'Stone' },
  { hex: '#d8d2c6', name: 'Greige' },
  { hex: '#efe9dc', name: 'Cream' },
  { hex: '#f6f3ee', name: 'White' },
  { hex: '#7b5e44', name: 'Espresso' },
  { hex: '#b08a5e', name: 'Camel' },
  { hex: '#d9b27c', name: 'Sand' },
  { hex: '#9c2f2f', name: 'Brick' },
  { hex: '#c2554e', name: 'Terracotta' },
  { hex: '#b94a6b', name: 'Rose' },
  { hex: '#7a2f4a', name: 'Plum' },
  { hex: '#2f4a6b', name: 'Navy' },
  { hex: '#3f6b8a', name: 'Denim' },
  { hex: '#5f7a6b', name: 'Sage' },
  { hex: '#2f5d52', name: 'Forest' },
  { hex: '#b8893b', name: 'Mustard' },
  { hex: '#c9a98a', name: 'Tan' },
];

export const CANVAS_BACKGROUNDS: Array<{ key: string; label: string; css: string }> = [
  { key: 'paper', label: 'Paper', css: 'linear-gradient(168deg,#ffffff 0%,#f7f2ea 100%)' },
  { key: 'cream', label: 'Cream', css: 'linear-gradient(168deg,#f6f3ee 0%,#ece4d6 100%)' },
  { key: 'sand', label: 'Sand', css: 'linear-gradient(168deg,#efe6d6 0%,#e2d4bd 100%)' },
  { key: 'sage', label: 'Sage', css: 'linear-gradient(168deg,#eaeee6 0%,#d6ddca 100%)' },
  { key: 'blush', label: 'Blush', css: 'linear-gradient(168deg,#f7ece8 0%,#f0d9d2 100%)' },
  { key: 'ink', label: 'Ink', css: 'linear-gradient(168deg,#23211c 0%,#15140f 100%)' },
];

export function canvasBackgroundCss(key: string): string {
  return CANVAS_BACKGROUNDS.find((b) => b.key === key)?.css || CANVAS_BACKGROUNDS[0].css;
}

export function backgroundIsDark(key: string): boolean {
  return key === 'ink';
}
