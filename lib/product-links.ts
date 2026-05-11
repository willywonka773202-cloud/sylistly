import type { Product } from './types';

function isValidHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

type BrandSearchFn = (productName: string, brandName?: string) => string;

const BRAND_SEARCH_URLS: Record<string, BrandSearchFn> = {
  'h&m': (n) => `https://www2.hm.com/en_us/search-results.html?q=${encodeURIComponent(n)}`,
  'adidas': (n) => `https://www.adidas.com/us/search?q=${encodeURIComponent(n)}`,
  'alo': (n) => `https://www.aloyoga.com/search?q=${encodeURIComponent(n)}`,
  'alo yoga': (n) => `https://www.aloyoga.com/search?q=${encodeURIComponent(n)}`,
  'carhartt': (n) => `https://www.carhartt.com/search?q=${encodeURIComponent(n)}`,
  'aritzia': (n) => `https://www.aritzia.com/us/en/search?q=${encodeURIComponent(n)}`,
  'lululemon': (n) => `https://www.lululemon.com/en-us/search?q=${encodeURIComponent(n)}`,
  'fashion nova': (n) => `https://www.fashionnova.com/pages/search?q=${encodeURIComponent(n)}`,
  'nordstrom': (n, b) => `https://www.nordstrom.com/sr?keyword=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  "abercrombie & fitch": (n) => `https://www.abercrombie.com/shop/SearchDisplay?searchTerm=${encodeURIComponent(n)}`,
  'abercrombie': (n) => `https://www.abercrombie.com/shop/SearchDisplay?searchTerm=${encodeURIComponent(n)}`,
  'dickies': (n) => `https://www.dickies.com/search?q=${encodeURIComponent(n)}`,
  'nike': (n) => `https://www.nike.com/search?q=${encodeURIComponent(n)}`,
  'birkenstock': (n) => `https://www.birkenstock.com/us/search/?q=${encodeURIComponent(n)}`,
  'stussy': (n) => `https://www.stussy.com/search?q=${encodeURIComponent(n)}`,
  'farfetch': (n, b) => `https://www.farfetch.com/shopping/search/?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'farfetch.com': (n, b) => `https://www.farfetch.com/shopping/search/?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'mejuri': (n) => `https://mejuri.com/search?q=${encodeURIComponent(n)}`,
  'mejuri us': (n) => `https://mejuri.com/search?q=${encodeURIComponent(n)}`,
  "macy's": (n, b) => `https://www.macys.com/shop/featured/${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'ugg': (n) => `https://www.ugg.com/search?q=${encodeURIComponent(n)}`,
  'michael kors': (n) => `https://www.michaelkors.com/search/?q=${encodeURIComponent(n)}`,
  'end. clothing': (n) => `https://www.endclothing.com/us/search?q=${encodeURIComponent(n)}`,
  'end clothing': (n) => `https://www.endclothing.com/us/search?q=${encodeURIComponent(n)}`,
  'gucci': (n) => `https://www.gucci.com/us/en/search?q=${encodeURIComponent(n)}`,
  'oakley': (n) => `https://www.oakley.com/en-us/search?q=${encodeURIComponent(n)}`,
  'ray-ban': (n) => `https://www.ray-ban.com/usa/search?q=${encodeURIComponent(n)}`,
  'new era cap': (n) => `https://www.neweracap.com/search?q=${encodeURIComponent(n)}`,
  'new era': (n) => `https://www.neweracap.com/search?q=${encodeURIComponent(n)}`,
  'miansai': (n) => `https://miansai.com/search?q=${encodeURIComponent(n)}`,
  'pandora jewelry': (n) => `https://us.pandora.net/search?q=${encodeURIComponent(n)}`,
  'pandora': (n) => `https://us.pandora.net/search?q=${encodeURIComponent(n)}`,
  'swarovski usa': (n) => `https://www.swarovski.com/en-US/search?q=${encodeURIComponent(n)}`,
  'swarovski': (n) => `https://www.swarovski.com/en-US/search?q=${encodeURIComponent(n)}`,
  'tiffany & co.': (n) => `https://www.tiffany.com/jewelry/search/?q=${encodeURIComponent(n)}`,
  'tiffany & co': (n) => `https://www.tiffany.com/jewelry/search/?q=${encodeURIComponent(n)}`,
  'vitaly': (n) => `https://vitalydesign.com/search?q=${encodeURIComponent(n)}`,
  'zara': (n) => `https://www.zara.com/us/en/search?q=${encodeURIComponent(n)}`,
  'uniqlo': (n) => `https://www.uniqlo.com/us/en/search?searchtext=${encodeURIComponent(n)}`,
  'gap': (n) => `https://www.gap.com/browse/search.do?searchText=${encodeURIComponent(n)}`,
  'old navy': (n) => `https://oldnavy.gap.com/browse/search.do?searchText=${encodeURIComponent(n)}`,
  'ralph lauren': (n) => `https://www.ralphlauren.com/search?q=${encodeURIComponent(n)}`,
  'polo ralph lauren': (n) => `https://www.ralphlauren.com/search?q=${encodeURIComponent(n)}`,
  'the north face': (n) => `https://www.thenorthface.com/search?q=${encodeURIComponent(n)}`,
  'north face': (n) => `https://www.thenorthface.com/search?q=${encodeURIComponent(n)}`,
  'patagonia': (n) => `https://www.patagonia.com/search/?q=${encodeURIComponent(n)}`,
  'champion': (n) => `https://www.champion.com/search?q=${encodeURIComponent(n)}`,
  'vans': (n) => `https://www.vans.com/en-us/search?q=${encodeURIComponent(n)}`,
  'converse': (n) => `https://www.converse.com/c/search?searchTerm=${encodeURIComponent(n)}`,
  'new balance': (n) => `https://www.newbalance.com/search?q=${encodeURIComponent(n)}`,
  'under armour': (n) => `https://www.underarmour.com/en-us/search?q=${encodeURIComponent(n)}`,
  'puma': (n) => `https://us.puma.com/en_US/search?q=${encodeURIComponent(n)}`,
  'columbia': (n) => `https://www.columbia.com/search?q=${encodeURIComponent(n)}`,
  'timberland': (n) => `https://www.timberland.com/shop/timberlandus/en/search?q=${encodeURIComponent(n)}`,
  'dr. martens': (n) => `https://www.drmartens.com/us/en/search?q=${encodeURIComponent(n)}`,
  'dr martens': (n) => `https://www.drmartens.com/us/en/search?q=${encodeURIComponent(n)}`,
  "levi's": (n) => `https://www.levi.com/US/en_US/search?q=${encodeURIComponent(n)}`,
  'levis': (n) => `https://www.levi.com/US/en_US/search?q=${encodeURIComponent(n)}`,
  'urban outfitters': (n) => `https://www.urbanoutfitters.com/search?q=${encodeURIComponent(n)}`,
  'free people': (n) => `https://www.freepeople.com/search/?q=${encodeURIComponent(n)}`,
  'anthropologie': (n) => `https://www.anthropologie.com/en-us/search?q=${encodeURIComponent(n)}`,
  'banana republic': (n) => `https://bananarepublic.gap.com/browse/search.do?searchText=${encodeURIComponent(n)}`,
  "j.crew": (n) => `https://www.jcrew.com/r/search?q=${encodeURIComponent(n)}`,
  'madewell': (n) => `https://www.madewell.com/search?q=${encodeURIComponent(n)}`,
  'ssense': (n, b) => `https://www.ssense.com/en-us/search?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'revolve': (n, b) => `https://www.revolve.com/search.php?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'asos': (n, b) => `https://www.asos.com/us/search/?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'os': (n) => `https://www.offwhite.com/en-us/search?q=${encodeURIComponent(n)}`,
  'off-white': (n) => `https://www.offwhite.com/en-us/search?q=${encodeURIComponent(n)}`,
  'balenciaga': (n) => `https://www.balenciaga.com/en-us/search?q=${encodeURIComponent(n)}`,
  'saint laurent': (n) => `https://www.ysl.com/en-us/search?q=${encodeURIComponent(n)}`,
  'bottega veneta': (n) => `https://www.bottegaveneta.com/en-us/search?q=${encodeURIComponent(n)}`,
  'prada': (n) => `https://www.prada.com/us/en/search.html?q=${encodeURIComponent(n)}`,
  'versace': (n) => `https://www.versace.com/us/en-us/search?q=${encodeURIComponent(n)}`,
  "arc'teryx": (n) => `https://arcteryx.com/en-US/search?q=${encodeURIComponent(n)}`,
  'arcteryx': (n) => `https://arcteryx.com/en-US/search?q=${encodeURIComponent(n)}`,
  'ann taylor': (n) => `https://www.anntaylor.com/search/cat.do?N=0&searchStr=${encodeURIComponent(n)}`,
  "kohl's": (n) => `https://www.kohls.com/search/submit.jsp?query=${encodeURIComponent(n)}`,
  'kohls': (n) => `https://www.kohls.com/search/submit.jsp?query=${encodeURIComponent(n)}`,
  "men's wearhouse": (n) => `https://www.menswearhouse.com/search?q=${encodeURIComponent(n)}`,
  'mens wearhouse': (n) => `https://www.menswearhouse.com/search?q=${encodeURIComponent(n)}`,
  'express': (n) => `https://www.express.com/search?searchTerms=${encodeURIComponent(n)}`,
  'banana republic factory': (n) => `https://bananarepublic.gap.com/browse/search.do?searchText=${encodeURIComponent(n)}`,
  'dr. martens us': (n) => `https://www.drmartens.com/us/en/search?q=${encodeURIComponent(n)}`,
  'ssense.com': (n, b) => `https://www.ssense.com/en-us/search?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'nordstrom.com': (n, b) => `https://www.nordstrom.com/sr?keyword=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
  'endource': (n, b) => `https://www.endclothing.com/us/search?q=${encodeURIComponent(b ? `${b} ${n}` : n)}`,
};

const RESALE_KEYWORDS = ['poshmark', 'ebay', 'etsy', 'depop', 'grailed', 'vestiaire', 'thredup', 'tradesy', 'vinted'];

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9&.'\s-]/g, '').trim();
}

function isResaleMarketplace(product: Product): boolean {
  const key = normalizeKey(product.retailer || product.brand || '');
  return RESALE_KEYWORDS.some((kw) => key.includes(kw));
}

function getBrandRetailerUrl(product: Product): string | null {
  if (isResaleMarketplace(product)) return null;

  const retailerKey = normalizeKey(product.retailer || '');
  const retailerFn = BRAND_SEARCH_URLS[retailerKey];
  if (retailerFn) return retailerFn(product.name, product.brand !== product.retailer ? product.brand : undefined);

  const brandKey = normalizeKey(product.brand || '');
  const brandFn = BRAND_SEARCH_URLS[brandKey];
  if (brandFn) return brandFn(product.name);

  return null;
}

export function getProductOutboundUrl(product: Product): string {
  const metadata = (product.metadata || {}) as Record<string, unknown>;
  const retailerLanding = typeof metadata.retailerUrl === 'string' ? metadata.retailerUrl : '';
  const sourceUrl = typeof metadata.sourceUrl === 'string' ? metadata.sourceUrl : '';
  const googleShoppingUrl = typeof metadata.googleShoppingUrl === 'string' ? metadata.googleShoppingUrl : '';
  const fallbackUrl = typeof metadata.fallbackUrl === 'string' ? metadata.fallbackUrl : '';

  if (isValidHttpUrl(product.productUrl)) return product.productUrl;
  if (isValidHttpUrl(product.retailerUrl)) return product.retailerUrl;
  if (isValidHttpUrl(retailerLanding)) return retailerLanding;
  if (isValidHttpUrl(sourceUrl)) return sourceUrl;
  if (isValidHttpUrl(product.affiliateUrl)) return product.affiliateUrl;
  if (isValidHttpUrl(product.googleShoppingUrl)) return product.googleShoppingUrl;
  if (isValidHttpUrl(product.fallbackUrl)) return product.fallbackUrl;
  if (isValidHttpUrl(googleShoppingUrl)) return googleShoppingUrl;
  if (isValidHttpUrl(fallbackUrl)) return fallbackUrl;

  const brandUrl = getBrandRetailerUrl(product);
  if (brandUrl) return brandUrl;

  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${product.brand} ${product.name}`)}`;
}
