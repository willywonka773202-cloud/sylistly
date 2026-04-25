import type { Product, Category, Gender } from './types';

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
  { id: 'h1', category: 'hat', brand: 'Nike', name: 'Club Unstructured Cap', priceCents: 3000, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#e8365d', 'Club Cap', 'NIKE'), gender: 'masc', trusted: true },
  { id: 'h2', category: 'hat', brand: 'Carhartt', name: 'Watch Hat', priceCents: 2500, currency: 'USD', retailer: 'Carhartt', retailerUrl: 'https://carhartt.com/', imageUrl: mockImage('#c2410c', 'Watch Hat', 'CARHARTT'), gender: 'masc', trusted: true },
  { id: 'h3', category: 'hat', brand: 'Stüssy', name: 'Stock Logo Cap', priceCents: 4200, currency: 'USD', retailer: 'Stüssy', retailerUrl: 'https://stussy.com/', imageUrl: mockImage('#0ea5e9', 'Stock Cap', 'STÜSSY'), gender: 'unisex', trusted: true },
  { id: 'h4', category: 'hat', brand: 'New Era', name: '9FORTY Snapback', priceCents: 3500, currency: 'USD', retailer: 'New Era', retailerUrl: 'https://newera.com/', imageUrl: mockImage('#1e293b', 'Snapback', 'NEW ERA'), gender: 'masc', trusted: true },
  { id: 'h5', category: 'hat', brand: 'Supreme', name: 'Box Logo 5-Panel', priceCents: 7800, currency: 'USD', retailer: 'Supreme', retailerUrl: 'https://supremenewyork.com/', imageUrl: mockImage('#f43f5e', '5-Panel', 'SUPREME'), gender: 'masc', trusted: true },
  { id: 'h6', category: 'hat', brand: 'Adidas', name: 'AdiAdjust Cl', priceCents: 2800, currency: 'USD', retailer: 'Adidas', retailerUrl: 'https://adidas.com/', imageUrl: mockImage('#f8fafc', 'AdiAdjust', 'ADIDAS'), gender: 'masc', trusted: true },
  { id: 'h7', category: 'hat', brand: 'Ralph Lauren', name: 'Beanie', priceCents: 4500, currency: 'USD', retailer: 'Ralph Lauren', retailerUrl: 'https://ralphlauren.com/', imageUrl: mockImage('#166534', 'Beanie', 'RL'), gender: 'fem', trusted: true },
  { id: 'h8', category: 'hat', brand: 'The North Face', name: 'Beanie', priceCents: 3800, currency: 'USD', retailer: 'The North Face', retailerUrl: 'https://thenorthface.com/', imageUrl: mockImage('#fbbf24', 'Beanie', 'TNF'), gender: 'unisex', trusted: true },
  { id: 'h9', category: 'hat', brand: 'Loro Piana', name: 'Cashmere Cap', priceCents: 35000, currency: 'USD', retailer: 'Loro Piana', retailerUrl: 'https://loropiana.com/', imageUrl: mockImage('#a16207', 'Cashmere', 'LORO PIANA'), gender: 'fem', trusted: true },
  { id: 'h10', category: 'hat', brand: 'Jacquemus', name: 'Le Chiquito', priceCents: 22500, currency: 'USD', retailer: 'Jacquemus', retailerUrl: 'https://jacquemus.com/', imageUrl: mockImage('#ec4899', 'Chiquito', 'JACQUEMUS'), gender: 'fem', trusted: true },
  { id: 't1', category: 'top', brand: 'Nike', name: 'Sportswear Crop Tee', priceCents: 3500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#fb7185', 'Crop Tee', 'NIKE'), gender: 'fem', trusted: true },
  { id: 't2', category: 'top', brand: 'Hanes', name: 'Eco Smart Tee', priceCents: 1800, currency: 'USD', retailer: 'Hanes', retailerUrl: 'https://hanes.com/', imageUrl: mockImage('#94a3b8', 'Eco Tee', 'HANES'), gender: 'masc', trusted: true },
  { id: 't3', category: 'top', brand: 'Essentials', name: 'Fear of God Hoodie', priceCents: 11000, currency: 'USD', retailer: 'SSENSE', retailerUrl: 'https://ssense.com/', imageUrl: mockImage('#d4a373', 'Hoodie', 'ESSENTIALS'), gender: 'masc', trusted: true },
  { id: 't4', category: 'top', brand: 'Uniqlo', name: 'U Crew Neck', priceCents: 2900, currency: 'USD', retailer: 'Uniqlo', retailerUrl: 'https://uniqlo.com/', imageUrl: mockImage('#f97316', 'U Crew', 'UNIQLO'), gender: 'unisex', trusted: true },
  { id: 't5', category: 'top', brand: 'Acne Studios', name: 'Soft Mohair', priceCents: 18500, currency: 'USD', retailer: 'Acne Studios', retailerUrl: 'https://acnestudios.com/', imageUrl: mockImage('#facc15', 'Mohair', 'ACNE'), gender: 'masc', trusted: true },
  { id: 't6', category: 'top', brand: 'Zara', name: 'Oversized Shirt', priceCents: 4900, currency: 'USD', retailer: 'Zara', retailerUrl: 'https://zara.com/', imageUrl: mockImage('#64748b', 'Oversized', 'ZARA'), gender: 'unisex', trusted: true },
  { id: 't7', category: 'top', brand: 'COS', name: 'Organic Cotton', priceCents: 6500, currency: 'USD', retailer: 'COS', retailerUrl: 'https://cos.com/', imageUrl: mockImage('#18181b', 'Cotton', 'COS'), gender: 'masc', trusted: true },
  { id: 't8', category: 'top', brand: 'Ganni', name: 'Silk Blouse', priceCents: 24500, currency: 'USD', retailer: 'Ganni', retailerUrl: 'https://ganni.com/', imageUrl: mockImage('#f472b6', 'Silk', 'GANNI'), gender: 'fem', trusted: true },
  { id: 't9', category: 'top', brand: 'Reformation', name: 'Ribbed Tank', priceCents: 8800, currency: 'USD', retailer: 'Reformation', retailerUrl: 'https://reformation.com/', imageUrl: mockImage('#34d399', 'Ribbed', 'REF'), gender: 'fem', trusted: true },
  { id: 't10', category: 'top', brand: 'Jacquemus', name: 'La Polo', priceCents: 16000, currency: 'USD', retailer: 'Jacquemus', retailerUrl: 'https://jacquemus.com/', imageUrl: mockImage('#f472b6', 'La Polo', 'JACQ'), gender: 'fem', trusted: true },
  { id: 'b1', category: 'bottom', brand: "Levi's", name: '501 Original', priceCents: 9800, currency: 'USD', retailer: "Levi's", retailerUrl: 'https://levi.com/', imageUrl: mockImage('#60a5fa', '501 Original', "LEVI'S"), gender: 'masc', trusted: true },
  { id: 'b2', category: 'bottom', brand: 'Dickies', name: 'Loose Fit Cargo Pant', priceCents: 6500, currency: 'USD', retailer: 'Dickies', retailerUrl: 'https://dickies.com/', imageUrl: mockImage('#f59e0b', 'Cargo Pant', 'DICKIES'), gender: 'masc', trusted: true },
  { id: 'b3', category: 'bottom', brand: 'Wrangler', name: 'Authentics', priceCents: 4500, currency: 'USD', retailer: 'Wrangler', retailerUrl: 'https://wrangler.com/', imageUrl: mockImage('#3b82f6', 'Authentics', 'WRANGLER'), gender: 'masc', trusted: true },
  { id: 'b4', category: 'bottom', brand: 'Nike', name: 'Air Fleece', priceCents: 7500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#a855f7', 'Air Fleece', 'NIKE'), gender: 'unisex', trusted: true },
  { id: 'b5', category: 'bottom', brand: "Levi's", name: 'Ribcage Wide Leg', priceCents: 8900, currency: 'USD', retailer: "Levi's", retailerUrl: 'https://levi.com/', imageUrl: mockImage('#3b82f6', 'Ribcage', "LEVI'S"), gender: 'fem', trusted: true },
  { id: 'b6', category: 'bottom', brand: 'Agolde', name: '90s Pinch Waist', priceCents: 16800, currency: 'USD', retailer: 'Agolde', retailerUrl: 'https://agolde.com/', imageUrl: mockImage('#6366f1', '90s Pinch', 'AGOLDE'), gender: 'fem', trusted: true },
  { id: 'b7', category: 'bottom', brand: 'Totême', name: 'Piqueparqu', priceCents: 24500, currency: 'USD', retailer: 'Totême', retailerUrl: 'https://toteme.com/', imageUrl: mockImage('#0f172a', 'Piqueparqu', 'TOTÊME'), gender: 'fem', trusted: true },
  { id: 'b8', category: 'bottom', brand: 'Acne Studios', name: 'Faya Wideleg', priceCents: 18900, currency: 'USD', retailer: 'Acne Studios', retailerUrl: 'https://acnestudios.com/', imageUrl: mockImage('#0f172a', 'Faya', 'ACNE'), gender: 'masc', trusted: true },
  { id: 'b9', category: 'bottom', brand: 'Reformation', name: 'Laidback Jersey', priceCents: 12800, currency: 'USD', retailer: 'Reformation', retailerUrl: 'https://reformation.com/', imageUrl: mockImage('#10b981', 'Laidback', 'REF'), gender: 'fem', trusted: true },
  { id: 'b10', category: 'bottom', brand: 'The Row', name: 'Amelie Pant', priceCents: 65000, currency: 'USD', retailer: 'The Row', retailerUrl: 'https://therow.com/', imageUrl: mockImage('#1e293b', 'Amelie', 'THE ROW'), gender: 'fem', trusted: true },
  { id: 's1', category: 'shoes', brand: 'Nike', name: "Air Force 1 '07", priceCents: 11500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#22c55e', 'Air Force 1', 'NIKE'), gender: 'masc', trusted: true },
  { id: 's2', category: 'shoes', brand: 'Nike', name: 'Dunk Low', priceCents: 11000, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#ef4444', 'Dunk Low', 'NIKE'), gender: 'masc', trusted: true },
  { id: 's3', category: 'shoes', brand: 'Adidas', name: 'Samba OG', priceCents: 10000, currency: 'USD', retailer: 'Adidas', retailerUrl: 'https://adidas.com/', imageUrl: mockImage('#f8fafc', 'Samba OG', 'ADIDAS'), gender: 'masc', trusted: true },
  { id: 's4', category: 'shoes', brand: 'Adidas', name: 'Gazelle', priceCents: 10000, currency: 'USD', retailer: 'Adidas', retailerUrl: 'https://adidas.com/', imageUrl: mockImage('#3b82f6', 'Gazelle', 'ADIDAS'), gender: 'masc', trusted: true },
  { id: 's5', category: 'shoes', brand: 'New Balance', name: '550', priceCents: 11000, currency: 'USD', retailer: 'New Balance', retailerUrl: 'https://newbalance.com/', imageUrl: mockImage('#ef4444', '550', 'NEW BAL'), gender: 'masc', trusted: true },
  { id: 's6', category: 'shoes', brand: 'New Balance', name: '2002R', priceCents: 13000, currency: 'USD', retailer: 'New Balance', retailerUrl: 'https://newbalance.com/', imageUrl: mockImage('#fcd34d', '2002R', 'NB'), gender: 'masc', trusted: true },
  { id: 's7', category: 'shoes', brand: 'Vans', name: 'Old Skool', priceCents: 7000, currency: 'USD', retailer: 'Vans', retailerUrl: 'https://vans.com/', imageUrl: mockImage('#1e293b', 'Old Skool', 'VANS'), gender: 'masc', trusted: true },
  { id: 's8', category: 'shoes', brand: 'Converse', name: 'Chuck 70 HI', priceCents: 8500, currency: 'USD', retailer: 'Converse', retailerUrl: 'https://converse.com/', imageUrl: mockImage('#0f172a', 'Chuck 70', 'CONVERSE'), gender: 'masc', trusted: true },
  { id: 's9', category: 'shoes', brand: 'Common Projects', name: 'Achilles Low', priceCents: 39500, currency: 'USD', retailer: 'Common Projects', retailerUrl: 'https://commonprojects.com/', imageUrl: mockImage('#f8fafc', 'Achilles', 'CP'), gender: 'masc', trusted: true },
  { id: 's10', category: 'shoes', brand: 'The Row', name: 'Logo Sneaker', priceCents: 45000, currency: 'USD', retailer: 'The Row', retailerUrl: 'https://therow.com/', imageUrl: mockImage('#f1f5f9', 'Logo', 'THE ROW'), gender: 'fem', trusted: true },
  { id: 's11', category: 'shoes', brand: 'Salomon', name: 'XT-6', priceCents: 14500, currency: 'USD', retailer: 'Salomon', retailerUrl: 'https://salomon.com/', imageUrl: mockImage('#f59e0b', 'XT-6', 'SALOMON'), gender: 'masc', trusted: true },
  { id: 's12', category: 'shoes', brand: 'Maison Margiela', name: 'Replica', priceCents: 42000, currency: 'USD', retailer: 'Maison Margiela', retailerUrl: 'https://maisonmargiela.com/', imageUrl: mockImage('#cbd5e1', 'Replica', 'MM'), gender: 'masc', trusted: true },
  { id: 's13', category: 'shoes', brand: 'Stuart Weitzman', name: 'Ninny', priceCents: 22900, currency: 'USD', retailer: 'Stuart Weitzman', retailerUrl: 'https://stuartweitzman.com/', imageUrl: mockImage('#78350f', 'Ninny', 'SW'), gender: 'fem', trusted: true },
  { id: 's14', category: 'shoes', brand: 'Jacquemus', name: 'Le Choc', priceCents: 19500, currency: 'USD', retailer: 'Jacquemus', retailerUrl: 'https://jacquemus.com/', imageUrl: mockImage('#f9a8d4', 'Le Choc', 'JACQ'), gender: 'fem', trusted: true },
  { id: 'o1', category: 'outer', brand: 'The North Face', name: 'Nuptse 700', priceCents: 33000, currency: 'USD', retailer: 'The North Face', retailerUrl: 'https://thenorthface.com/', imageUrl: mockImage('#0ea5e9', 'Nuptse 700', 'TNF'), gender: 'masc', trusted: true },
  { id: 'o2', category: 'outer', brand: 'Carhartt', name: 'Detroit Jacket', priceCents: 22900, currency: 'USD', retailer: 'Carhartt', retailerUrl: 'https://carhartt.com/', imageUrl: mockImage('#f97316', 'Detroit', 'CARHARTT'), gender: 'masc', trusted: true },
  { id: 'o3', category: 'outer', brand: 'Levi\'s', name: 'Sherpa Trucker', priceCents: 14900, currency: 'USD', retailer: "Levi's", retailerUrl: 'https://levi.com/', imageUrl: mockImage('#a16207', 'Sherpa', "LEVI'S"), gender: 'masc', trusted: true },
  { id: 'o4', category: 'outer', brand: 'Burberry', name: 'Gabardine Trench', priceCents: 189000, currency: 'USD', retailer: 'Burberry', retailerUrl: 'https://burberry.com/', imageUrl: mockImage('#84cc16', 'Trench', 'BURBERRY'), gender: 'masc', trusted: true },
  { id: 'o5', category: 'outer', brand: 'Arc\'teryx', name: 'Gamma MX', priceCents: 45000, currency: 'USD', retailer: "Arc'teryx", retailerUrl: 'https://arcteryx.com/', imageUrl: mockImage('#16a34a', 'Gamma', 'ARC'), gender: 'masc', trusted: true },
  { id: 'o6', category: 'outer', brand: 'Patagonia', name: 'Nano Puff', priceCents: 19900, currency: 'USD', retailer: 'Patagonia', retailerUrl: 'https://patagonia.com/', imageUrl: mockImage('#84cc16', 'Nano', 'PATAG'), gender: 'unisex', trusted: true },
  { id: 'o7', category: 'outer', brand: 'Uniqlo', name: 'Blocktech Coat', priceCents: 8900, currency: 'USD', retailer: 'Uniqlo', retailerUrl: 'https://uniqlo.com/', imageUrl: mockImage('#475569', 'Blocktech', 'UNIQLO'), gender: 'unisex', trusted: true },
  { id: 'o8', category: 'outer', brand: 'Totême', name: 'Shearling Coat', priceCents: 78000, currency: 'USD', retailer: 'Totême', retailerUrl: 'https://toteme.com/', imageUrl: mockImage('#f5f5f4', 'Shearling', 'TOTÊME'), gender: 'fem', trusted: true },
  { id: 'o9', category: 'outer', brand: 'Miu Miu', name: 'Logo Puffer', priceCents: 185000, currency: 'USD', retailer: 'Miu Miu', retailerUrl: 'https://miumiu.com/', imageUrl: mockImage('#ec4899', 'Logo', 'MIU MIU'), gender: 'fem', trusted: true },
  { id: 'o10', category: 'outer', brand: 'The Row', name: 'Oversized Coat', priceCents: 245000, currency: 'USD', retailer: 'The Row', retailerUrl: 'https://therow.com/', imageUrl: mockImage('#18181b', 'Coat', 'THE ROW'), gender: 'fem', trusted: true },
  { id: 'a1', category: 'bag', brand: 'Gucci', name: 'Jackie 1961', priceCents: 320000, currency: 'USD', retailer: 'Gucci', retailerUrl: 'https://gucci.com/', imageUrl: mockImage('#a855f7', 'Jackie', 'GUCCI'), gender: 'fem', trusted: true },
  { id: 'a2', category: 'bag', brand: 'The North Face', name: 'Bozer', priceCents: 5900, currency: 'USD', retailer: 'The North Face', retailerUrl: 'https://thenorthface.com/', imageUrl: mockImage('#eab308', 'Bozer', 'TNF'), gender: 'masc', trusted: true },
  { id: 'a3', category: 'bag', brand: 'Herschel', name: 'Supply Co', priceCents: 4500, currency: 'USD', retailer: 'Herschel', retailerUrl: 'https://herschel.com/', imageUrl: mockImage('#3b82f6', 'Supply', 'HERSCHEL'), gender: 'masc', trusted: true },
  { id: 'a4', category: 'bag', brand: 'Nike', name: 'Gym Club', priceCents: 5500, currency: 'USD', retailer: 'Nike', retailerUrl: 'https://nike.com/', imageUrl: mockImage('#1e293b', 'Gym', 'NIKE'), gender: 'masc', trusted: true },
  { id: 'a5', category: 'bag', brand: 'Calvin Klein', name: 'Tote', priceCents: 7500, currency: 'USD', retailer: 'Calvin Klein', retailerUrl: 'https://calvinklein.com/', imageUrl: mockImage('#1e293b', 'Tote', 'CK'), gender: 'unisex', trusted: true },
  { id: 'a6', category: 'bag', brand: 'Jacquemus', name: 'Le Nano', priceCents: 18500, currency: 'USD', retailer: 'Jacquemus', retailerUrl: 'https://jacquemus.com/', imageUrl: mockImage('#f472b6', 'Nano', 'JACQ'), gender: 'fem', trusted: true },
  { id: 'a7', category: 'bag', brand: 'Staud', name: 'Shirley', priceCents: 24500, currency: 'USD', retailer: 'Staud', retailerUrl: 'https://staud.com/', imageUrl: mockImage('#f9a8d4', 'Shirley', 'STAUD'), gender: 'fem', trusted: true },
  { id: 'a8', category: 'bag', brand: 'Coperni', name: 'Swipe', priceCents: 14500, currency: 'USD', retailer: 'Coperni', retailerUrl: 'https://coperni.com/', imageUrl: mockImage('#c084fc', 'Swipe', 'COPERNI'), gender: 'fem', trusted: true },
  { id: 'a9', category: 'bag', brand: 'Prada', name: 'Re-Edition', priceCents: 185000, currency: 'USD', retailer: 'Prada', retailerUrl: 'https://prada.com/', imageUrl: mockImage('#6366f1', 'Re-Edit', 'PRADA'), gender: 'fem', trusted: true },
  { id: 'a10', category: 'bag', brand: 'Bottega Veneta', name: 'Cassette', priceCents: 235000, currency: 'USD', retailer: 'Bottega Veneta', retailerUrl: 'https://bottegaveneta.com/', imageUrl: mockImage('#a855f7', 'Cassette', 'BV'), gender: 'masc', trusted: true },
  { id: 'e1', category: 'eyewear', brand: 'Ray-Ban', name: 'Wayfarer Classic', priceCents: 17000, currency: 'USD', retailer: 'Ray-Ban', retailerUrl: 'https://ray-ban.com/', imageUrl: mockImage('#f97316', 'Wayfarer', 'RAY-BAN'), gender: 'masc', trusted: true },
  { id: 'e2', category: 'eyewear', brand: 'Ray-Ban', name: 'Aviator', priceCents: 17000, currency: 'USD', retailer: 'Ray-Ban', retailerUrl: 'https://ray-ban.com/', imageUrl: mockImage('#ef4444', 'Aviator', 'RAY-BAN'), gender: 'masc', trusted: true },
  { id: 'e3', category: 'eyewear', brand: 'Oakley', name: 'Frogskin', priceCents: 15000, currency: 'USD', retailer: 'Oakley', retailerUrl: 'https://oakley.com/', imageUrl: mockImage('#f59e0b', 'Frogskin', 'OAKLEY'), gender: 'masc', trusted: true },
  { id: 'e4', category: 'eyewear', brand: 'Warby Parker', name: 'Haskell', priceCents: 9500, currency: 'USD', retailer: 'Warby Parker', retailerUrl: 'https://warbyparker.com/', imageUrl: mockImage('#6366f1', 'Haskell', 'WARBY'), gender: 'masc', trusted: true },
  { id: 'e5', category: 'eyewear', brand: 'Gentle Monster', name: 'Capsule', priceCents: 22500, currency: 'USD', retailer: 'Gentle Monster', retailerUrl: 'https://gentlemonster.com/', imageUrl: mockImage('#1e293b', 'Capsule', 'GM'), gender: 'masc', trusted: true },
  { id: 'e6', category: 'eyewear', brand: 'Thom Browne', name: 'Round', priceCents: 35000, currency: 'USD', retailer: 'Thom Browne', retailerUrl: 'https://thombrowne.com/', imageUrl: mockImage('#64748b', 'Round', 'TB'), gender: 'masc', trusted: true },
  { id: 'e7', category: 'eyewear', brand: 'Celine', name: 'Triomphe', priceCents: 22500, currency: 'USD', retailer: 'Celine', retailerUrl: 'https://celine.com/', imageUrl: mockImage('#f472b6', 'Triomphe', 'CELINE'), gender: 'fem', trusted: true },
  { id: 'e8', category: 'eyewear', brand: 'Gucci', name: 'Oversized GG', priceCents: 28000, currency: 'USD', retailer: 'Gucci', retailerUrl: 'https://gucci.com/', imageUrl: mockImage('#a855f7', 'Oversized', 'GUCCI'), gender: 'fem', trusted: true },
  { id: 'e9', category: 'eyewear', brand: 'Saint Laurent', name: 'SL 28', priceCents: 32000, currency: 'USD', retailer: 'Saint Laurent', retailerUrl: 'https://ysl.com/', imageUrl: mockImage('#1e293b', 'SL 28', 'YSL'), gender: 'fem', trusted: true },
  { id: 'e10', category: 'eyewear', brand: 'Prada', name: 'Symbole', priceCents: 25000, currency: 'USD', retailer: 'Prada', retailerUrl: 'https://prada.com/', imageUrl: mockImage('#1e293b', 'Symbole', 'PRADA'), gender: 'fem', trusted: true },
  { id: 'j1', category: 'jewelry', brand: 'Mejuri', name: 'Thin Dome Ring', priceCents: 9800, currency: 'USD', retailer: 'Mejuri', retailerUrl: 'https://mejuri.com/', imageUrl: mockImage('#fde047', 'Dome Ring', 'MEJURI'), gender: 'fem', trusted: true },
  { id: 'j2', category: 'jewelry', brand: 'Mejuri', name: 'Mini Hoops', priceCents: 6800, currency: 'USD', retailer: 'Mejuri', retailerUrl: 'https://mejuri.com/', imageUrl: mockImage('#fde047', 'Hoops', 'MEJURI'), gender: 'fem', trusted: true },
  { id: 'j3', category: 'jewelry', brand: 'Cartier', name: 'Love Bracelet', priceCents: 780000, currency: 'USD', retailer: 'Cartier', retailerUrl: 'https://cartier.com/', imageUrl: mockImage('#eab308', 'Love', 'CARTIER'), gender: 'masc', trusted: true },
  { id: 'j4', category: 'jewelry', brand: 'Cartier', name: 'Tank Watch', priceCents: 950000, currency: 'USD', retailer: 'Cartier', retailerUrl: 'https://cartier.com/', imageUrl: mockImage('#eab308', 'Tank', 'CARTIER'), gender: 'masc', trusted: true },
  { id: 'j5', category: 'jewelry', brand: 'Rolex', name: 'Submariner', priceCents: 1450000, currency: 'USD', retailer: 'Rolex', retailerUrl: 'https://rolex.com/', imageUrl: mockImage('#fcd34d', 'Sub', 'ROLEX'), gender: 'masc', trusted: true },
  { id: 'j6', category: 'jewelry', brand: 'Omega', name: 'Speedmaster', priceCents: 650000, currency: 'USD', retailer: 'Omega', retailerUrl: 'https://omega.com/', imageUrl: mockImage('#cbd5e1', 'Speed', 'OMEGA'), gender: 'masc', trusted: true },
  { id: 'j7', category: 'jewelry', brand: 'Tiffany', name: 'T Smile', priceCents: 18500, currency: 'USD', retailer: 'Tiffany', retailerUrl: 'https://tiffany.com/', imageUrl: mockImage('#60a5fa', 'T Smile', 'TIFFANY'), gender: 'fem', trusted: true },
  { id: 'j8', category: 'jewelry', brand: 'VCA', name: 'Alhambra', priceCents: 245000, currency: 'USD', retailer: 'Van Cleef', retailerUrl: 'https://vancleefarpels.com/', imageUrl: mockImage('#34d399', 'Alhambra', 'VCA'), gender: 'fem', trusted: true },
  { id: 'j9', category: 'jewelry', brand: 'Alyx', name: 'Chain Belt', priceCents: 14500, currency: 'USD', retailer: 'Alyx', retailerUrl: 'https://alyxstudio.com/', imageUrl: mockImage('#1e293b', 'Chain', 'ALYX'), gender: 'masc', trusted: true },
  { id: 'j10', category: 'jewelry', brand: 'Off-White', name: 'Industrial', priceCents: 22500, currency: 'USD', retailer: 'Off-White', retailerUrl: 'https://off---white.com/', imageUrl: mockImage('#fde047', 'Industrial', 'OFF-WHITE'), gender: 'masc', trusted: true },
];

export function mockSearch(category: Category, query: string, targetGender?: Gender): Product[] {
  const q = query.toLowerCase();
  let pool = MOCK_PRODUCTS.filter((p) => p.category === category);
  
  if (targetGender && targetGender !== 'unisex') {
    pool = pool.filter((p) => p.gender === targetGender || p.gender === 'unisex');
  }
  
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
