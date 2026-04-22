import type { Product, Category } from './types';

/**
 * Local-dev fallback dataset.
 * Used when SERPAPI_KEY is missing, or to bootstrap demos.
 * Mirrors the product database in the single-file prototype.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mockImage(accent: string, label: string, chip: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d0d0c" />
          <stop offset="100%" stop-color="#1b1b19" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="36" fill="url(#bg)" />
      <rect x="18" y="18" width="284" height="284" rx="28" fill="${accent}" opacity="0.16" />
      <circle cx="160" cy="122" r="58" fill="${accent}" opacity="0.88" />
      <rect x="84" y="192" width="152" height="14" rx="7" fill="#fffefb" opacity="0.9" />
      <rect x="98" y="218" width="124" height="10" rx="5" fill="#fffefb" opacity="0.45" />
      <rect x="112" y="242" width="96" height="10" rx="5" fill="#fffefb" opacity="0.28" />
      <text x="32" y="42" fill="#fffefb" font-family="Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(chip)}</text>
      <text x="32" y="286" fill="#fffefb" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(label)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const MOCK_PRODUCTS: Product[] = [
  { id: 'h1', category: 'hat', brand: 'Nike', name: 'Club Unstructured Cap', priceCents: 3000, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#e8365d', 'Club Cap', 'NIKE'), trusted: true },
  { id: 'h5', category: 'hat', brand: 'Supreme', name: 'Box Logo 5-Panel', priceCents: 7800, currency: 'USD', retailer: 'Supreme', retailerUrl: 'https://supremenewyork.com/', imageUrl: mockImage('#f43f5e', '5-Panel', 'SUPREME'), trusted: true },
  { id: 't1', category: 'top', brand: 'Nike', name: 'Sportswear Crop Tee', priceCents: 3500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#fb7185', 'Crop Tee', 'NIKE'), trusted: true },
  { id: 't3', category: 'top', brand: 'Essentials', name: 'Fear of God Hoodie', priceCents: 11000, currency: 'USD', retailer: 'SSENSE', retailerUrl: 'https://ssense.com/', imageUrl: mockImage('#d4a373', 'Hoodie', 'ESSENTIALS'), trusted: true },
  { id: 'b2', category: 'bottom', brand: "Levi's", name: '501 Original', priceCents: 9800, currency: 'USD', retailer: "Levi's", retailerUrl: 'https://levi.com/', imageUrl: mockImage('#60a5fa', '501 Original', "LEVI'S"), trusted: true },
  { id: 'b5', category: 'bottom', brand: 'Dickies', name: 'Loose Fit Cargo Pant', priceCents: 6500, currency: 'USD', retailer: 'Dickies', retailerUrl: 'https://dickies.com/', imageUrl: mockImage('#f59e0b', 'Cargo Pant', 'DICKIES'), trusted: true },
  { id: 's1', category: 'shoes', brand: 'Nike', name: "Air Force 1 '07", priceCents: 11500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#22c55e', 'Air Force 1', 'NIKE'), trusted: true },
  { id: 's3', category: 'shoes', brand: 'Adidas', name: 'Samba OG', priceCents: 10000, currency: 'USD', retailer: 'Adidas', retailerUrl: 'https://adidas.com/', imageUrl: mockImage('#f8fafc', 'Samba OG', 'ADIDAS'), trusted: true },
  { id: 'o2', category: 'outer', brand: 'The North Face', name: 'Nuptse 700', priceCents: 33000, currency: 'USD', retailer: 'The North Face', retailerUrl: 'https://thenorthface.com/', imageUrl: mockImage('#0ea5e9', 'Nuptse 700', 'TNF'), trusted: true },
  { id: 'o4', category: 'outer', brand: 'Burberry', name: 'Gabardine Trench Coat', priceCents: 189000, currency: 'USD', retailer: 'Burberry', retailerUrl: 'https://burberry.com/', imageUrl: mockImage('#84cc16', 'Trench Coat', 'BURBERRY'), trusted: true },
  { id: 'a1', category: 'bag', brand: 'Gucci', name: 'Jackie 1961 Shoulder', priceCents: 320000, currency: 'USD', retailer: 'Gucci', retailerUrl: 'https://gucci.com/', imageUrl: mockImage('#a855f7', 'Jackie 1961', 'GUCCI'), trusted: true },
  { id: 'a5', category: 'eyewear', brand: 'Ray-Ban', name: 'Wayfarer Classic', priceCents: 17000, currency: 'USD', retailer: 'Ray-Ban', retailerUrl: 'https://ray-ban.com/', imageUrl: mockImage('#f97316', 'Wayfarer', 'RAY-BAN'), trusted: true },
  { id: 'j1', category: 'jewelry', brand: 'Mejuri', name: 'Thin Dome Ring', priceCents: 9800, currency: 'USD', retailer: 'Mejuri', retailerUrl: 'https://mejuri.com/', imageUrl: mockImage('#fde047', 'Dome Ring', 'MEJURI'), trusted: true },
];

export function mockSearch(category: Category, query: string): Product[] {
  const q = query.toLowerCase();
  const pool = MOCK_PRODUCTS.filter((p) => p.category === category);
  if (!q) return pool.slice(0, 6);
  const matches = pool
    .map((p) => ({
      p,
      s: scoreMatch(p, q),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.p);

  if (!matches.length) return pool.slice(0, 6);

  const seen = new Set(matches.map((product) => product.id));
  const rest = pool.filter((product) => !seen.has(product.id));
  return [...matches, ...rest].slice(0, 6);
}

function scoreMatch(p: Product, q: string): number {
  const hay = `${p.brand} ${p.name}`.toLowerCase();
  return q.split(/\s+/).reduce((acc, t) => (hay.includes(t) ? acc + 10 : acc), 0);
}
