export type Category =
  | 'hat' | 'outer' | 'top' | 'bottom' | 'shoes' | 'bag' | 'eyewear' | 'jewelry';

export const CATEGORY_ORDER: Category[] = [
  'hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry',
];

export interface SearchIntent {
  category: Category;
  color?: string[];
  brand?: string[];
  style?: string[];
  priceMax?: number | null;
  priceMin?: number | null;
  gender?: 'masc' | 'fem' | 'androgynous' | null;
  keywords: string[];
}

export interface Product {
  id: string;                  // sha1(retailer_url)
  brand: string;
  name: string;
  category: Category;
  priceCents: number;
  currency: string;            // 'USD'
  retailer: string;
  retailerUrl: string;
  affiliateUrl?: string;       // Rakuten/Skimlinks-wrapped
  imageUrl: string;            // original merchant/catalog image
  imageTransparentUrl?: string; // real transparent PNG/WebP/AVIF asset when reviewed
  imageCutoutUrl?: string;      // optional alias for future cutout providers
  imageSource?: 'merchant' | 'searchapi' | 'manual' | 'generated' | 'transparent-pipeline';
  imageStatus?: 'original' | 'needs-cutout' | 'cutout-ready' | 'cutout-failed' | 'review-only' | 'quarantined';
  imageQualityFlags?: string[];
  imageUpdatedAt?: string;
  imageReviewNotes?: string;
  imageOriginalUrl?: string;   // debug
  inStock?: boolean;
  trusted?: boolean;
  vibes?: string[];
  occasions?: string[];
  colors?: string[];
  gender?: Array<'masc' | 'fem' | 'androgynous'>;
  searchTerms?: string[];
  sourceQuery?: string;
  productUrl?: string;
  googleShoppingUrl?: string;
  fallbackUrl?: string;
  imageQuality?: 'good' | 'ok' | 'missing';
  popularityScore?: number;
  metadata?: Record<string, unknown>;
}

export interface Fit {
  id: string;
  ownerId?: string;
  title?: string;
  vibe?: string;
  items: Partial<Record<Category, string>>;   // cat -> product id
  totalCents: number;
  coverUrl?: string;
  isPublic?: boolean;
  createdAt: string;
}

export interface Profile {
  id: string;
  handle?: string;
  skinTone: string;           // hex
  bodyType: 'masc' | 'fem' | 'androgynous' | 'custom';
  sizes: {
    top?: string;
    bottom?: { waist?: number; inseam?: number };
    shoe?: string;
  };
  stylePrefs: {
    vibes?: string[];
    budget?: 'low' | 'mid' | 'high' | 'luxury';
    brands?: string[];
  };
  isCreator: boolean;
}
