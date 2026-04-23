import type { Category, Product, SearchIntent } from './types';

type CatalogSeed = Omit<Product, 'affiliateUrl'> & {
  metadata?: Product['metadata'] & {
    colors?: string[];
    styles?: string[];
    vibes?: string[];
    keywords?: string[];
    featured?: boolean;
    source?: 'catalog';
  };
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function catalogImage(accent: string, label: string, chip: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111110" />
          <stop offset="100%" stop-color="#1e1d1b" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="36" fill="url(#bg)" />
      <rect x="18" y="18" width="284" height="284" rx="28" fill="${accent}" opacity="0.16" />
      <circle cx="160" cy="114" r="52" fill="${accent}" opacity="0.9" />
      <rect x="92" y="176" width="136" height="14" rx="7" fill="#fffefb" opacity="0.92" />
      <rect x="104" y="204" width="112" height="10" rx="5" fill="#fffefb" opacity="0.54" />
      <rect x="116" y="226" width="88" height="10" rx="5" fill="#fffefb" opacity="0.34" />
      <text x="28" y="42" fill="#fffefb" font-family="Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(chip)}</text>
      <text x="28" y="286" fill="#fffefb" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(label)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function product(seed: CatalogSeed): Product {
  return {
    ...seed,
    trusted: seed.trusted ?? true,
    metadata: {
      source: 'catalog',
      ...seed.metadata,
    },
  };
}

export const BRAND_CATALOG_PRODUCTS: Product[] = [
  product({
    id: 'catalog-hat-nike-club-cap',
    category: 'hat',
    brand: 'Nike',
    name: 'Club Unstructured Cap',
    priceCents: 3000,
    currency: 'USD',
    retailer: 'Nike',
    retailerUrl: 'https://www.nike.com/w?q=club%20cap',
    imageUrl: catalogImage('#ff5a7a', 'Club Cap', 'NIKE'),
    metadata: { colors: ['black', 'white'], styles: ['cap'], vibes: ['clean', 'streetwear'], keywords: ['baseball', 'dad hat'], featured: true },
  }),
  product({
    id: 'catalog-hat-adidas-bucket',
    category: 'hat',
    brand: 'Adidas',
    name: 'Trefoil Bucket Hat',
    priceCents: 2800,
    currency: 'USD',
    retailer: 'Adidas',
    retailerUrl: 'https://www.adidas.com/us/search?q=bucket%20hat',
    imageUrl: catalogImage('#d7dde8', 'Bucket Hat', 'ADIDAS'),
    metadata: { colors: ['black', 'white'], styles: ['bucket'], vibes: ['streetwear', 'summer'], keywords: ['bucket hat'] },
  }),
  product({
    id: 'catalog-hat-carhartt-beanie',
    category: 'hat',
    brand: 'Carhartt WIP',
    name: 'Acrylic Watch Beanie',
    priceCents: 2800,
    currency: 'USD',
    retailer: 'Carhartt WIP',
    retailerUrl: 'https://us.carhartt-wip.com/search?type=product&q=beanie',
    imageUrl: catalogImage('#f8b547', 'Watch Beanie', 'CARHARTT'),
    metadata: { colors: ['black', 'brown', 'orange'], styles: ['beanie'], vibes: ['streetwear', 'cozy'], keywords: ['watch hat', 'winter'] },
  }),
  product({
    id: 'catalog-hat-newera-yankees',
    category: 'hat',
    brand: 'New Era',
    name: 'NY Yankees 9FORTY Cap',
    priceCents: 3400,
    currency: 'USD',
    retailer: 'New Era',
    retailerUrl: 'https://www.neweracap.com/search?q=yankees%209forty',
    imageUrl: catalogImage('#6fa8ff', '9FORTY Cap', 'NEW ERA'),
    metadata: { colors: ['navy', 'black'], styles: ['cap'], vibes: ['streetwear', 'sporty'], keywords: ['yankees', 'baseball'] },
  }),
  product({
    id: 'catalog-hat-prada-bucket',
    category: 'hat',
    brand: 'Prada',
    name: 'Re-Nylon Bucket Hat',
    priceCents: 67500,
    currency: 'USD',
    retailer: 'Prada',
    retailerUrl: 'https://www.prada.com/us/en/search-result.html?query=bucket%20hat',
    imageUrl: catalogImage('#8be28b', 'Re-Nylon', 'PRADA'),
    metadata: { colors: ['black'], styles: ['bucket'], vibes: ['luxury', 'minimal'], keywords: ['nylon', 'designer'] },
  }),
  product({
    id: 'catalog-hat-acnestudios-logo-cap',
    category: 'hat',
    brand: 'Acne Studios',
    name: 'Face Logo Baseball Cap',
    priceCents: 23000,
    currency: 'USD',
    retailer: 'Acne Studios',
    retailerUrl: 'https://www.acnestudios.com/us/en/search?q=cap',
    imageUrl: catalogImage('#b790ff', 'Logo Cap', 'ACNE'),
    metadata: { colors: ['pink', 'black'], styles: ['cap'], vibes: ['clean', 'designer'], keywords: ['logo', 'baseball cap'] },
  }),
  product({
    id: 'catalog-hat-ralphlauren-cap',
    category: 'hat',
    brand: 'Polo Ralph Lauren',
    name: 'Chino Sports Cap',
    priceCents: 4980,
    currency: 'USD',
    retailer: 'Ralph Lauren',
    retailerUrl: 'https://www.ralphlauren.com/search?q=cap',
    imageUrl: catalogImage('#79a7ff', 'Sports Cap', 'POLO'),
    metadata: { colors: ['navy', 'white', 'tan'], styles: ['cap'], vibes: ['preppy', 'classic'], keywords: ['chino cap', 'polo hat'] },
  }),
  product({
    id: 'catalog-hat-hm-bucket',
    category: 'hat',
    brand: 'H&M',
    name: 'Cotton Twill Bucket Hat',
    priceCents: 1499,
    currency: 'USD',
    retailer: 'H&M',
    retailerUrl: 'https://www2.hm.com/en_us/search-results.html?q=bucket%20hat',
    imageUrl: catalogImage('#f2f2f2', 'Twill Bucket', 'H&M'),
    metadata: { colors: ['black', 'beige'], styles: ['bucket'], vibes: ['casual', 'vacation'], keywords: ['cotton hat'] },
  }),

  product({
    id: 'catalog-outer-northface-nuptse',
    category: 'outer',
    brand: 'The North Face',
    name: '1996 Retro Nuptse Jacket',
    priceCents: 33000,
    currency: 'USD',
    retailer: 'The North Face',
    retailerUrl: 'https://www.thenorthface.com/en-us/search?q=nuptse',
    imageUrl: catalogImage('#5ed2ff', 'Nuptse', 'TNF'),
    metadata: { colors: ['black', 'brown'], styles: ['puffer'], vibes: ['streetwear', 'winter'], keywords: ['retro', '700 fill'], featured: true },
  }),
  product({
    id: 'catalog-outer-carhartt-detroit',
    category: 'outer',
    brand: 'Carhartt WIP',
    name: 'Detroit Jacket',
    priceCents: 19800,
    currency: 'USD',
    retailer: 'Carhartt WIP',
    retailerUrl: 'https://us.carhartt-wip.com/search?type=product&q=detroit%20jacket',
    imageUrl: catalogImage('#ffbf52', 'Detroit', 'CARHARTT'),
    metadata: { colors: ['brown', 'black'], styles: ['jacket'], vibes: ['workwear', 'streetwear'], keywords: ['canvas', 'zip jacket'] },
  }),
  product({
    id: 'catalog-outer-levis-trucker',
    category: 'outer',
    brand: "Levi's",
    name: 'Original Trucker Jacket',
    priceCents: 9800,
    currency: 'USD',
    retailer: "Levi's",
    retailerUrl: 'https://www.levi.com/US/en_US/search?q=trucker%20jacket',
    imageUrl: catalogImage('#6fb2ff', 'Trucker', "LEVI'S"),
    metadata: { colors: ['blue', 'black'], styles: ['denim jacket'], vibes: ['casual', 'vintage'], keywords: ['denim', 'jacket'] },
  }),
  product({
    id: 'catalog-outer-zara-trench',
    category: 'outer',
    brand: 'Zara',
    name: 'Oversized Belted Trench Coat',
    priceCents: 15900,
    currency: 'USD',
    retailer: 'Zara',
    retailerUrl: 'https://www.zara.com/us/en/search?searchTerm=trench%20coat',
    imageUrl: catalogImage('#c6b79e', 'Trench', 'ZARA'),
    metadata: { colors: ['tan', 'beige'], styles: ['trench', 'coat'], vibes: ['clean', 'minimal'], keywords: ['oversized', 'belted'] },
  }),
  product({
    id: 'catalog-outer-arcteryx-beta',
    category: 'outer',
    brand: "Arc'teryx",
    name: 'Beta LT Jacket',
    priceCents: 40000,
    currency: 'USD',
    retailer: "Arc'teryx",
    retailerUrl: 'https://arcteryx.com/us/en/search?text=beta%20lt',
    imageUrl: catalogImage('#8de0c4', 'Beta LT', 'ARCTERYX'),
    metadata: { colors: ['black', 'olive'], styles: ['shell'], vibes: ['gorpcore', 'technical'], keywords: ['rain shell', 'waterproof'] },
  }),
  product({
    id: 'catalog-outer-adidas-firebird',
    category: 'outer',
    brand: 'Adidas',
    name: 'Firebird Track Jacket',
    priceCents: 8000,
    currency: 'USD',
    retailer: 'Adidas',
    retailerUrl: 'https://www.adidas.com/us/search?q=firebird%20track%20jacket',
    imageUrl: catalogImage('#dfe7f6', 'Firebird', 'ADIDAS'),
    metadata: { colors: ['black', 'blue', 'red'], styles: ['track jacket'], vibes: ['sporty', 'retro'], keywords: ['three stripes'] },
  }),
  product({
    id: 'catalog-outer-abercrombie-bomber',
    category: 'outer',
    brand: 'Abercrombie',
    name: 'Oversized Bomber Jacket',
    priceCents: 12000,
    currency: 'USD',
    retailer: 'Abercrombie',
    retailerUrl: 'https://www.abercrombie.com/shop/us/search?searchTerm=bomber%20jacket',
    imageUrl: catalogImage('#8b8478', 'Bomber', 'ABERCROMBIE'),
    metadata: { colors: ['black', 'olive'], styles: ['bomber'], vibes: ['date', 'streetwear'], keywords: ['oversized jacket'] },
  }),
  product({
    id: 'catalog-outer-aritzia-superpuff',
    category: 'outer',
    brand: 'Aritzia',
    name: 'The Super Puff',
    priceCents: 25000,
    currency: 'USD',
    retailer: 'Aritzia',
    retailerUrl: 'https://www.aritzia.com/us/en/search?q=super%20puff',
    imageUrl: catalogImage('#e8b3a8', 'Super Puff', 'ARITZIA'),
    metadata: { colors: ['black', 'brown', 'cream'], styles: ['puffer'], vibes: ['cozy', 'winter'], keywords: ['super puff', 'down jacket'] },
  }),

  product({
    id: 'catalog-top-nike-tee',
    category: 'top',
    brand: 'Nike',
    name: 'Sportswear Essential Tee',
    priceCents: 3500,
    currency: 'USD',
    retailer: 'Nike',
    retailerUrl: 'https://www.nike.com/w?q=sportswear%20tee',
    imageUrl: catalogImage('#ff6b88', 'Essential Tee', 'NIKE'),
    metadata: { colors: ['white', 'black', 'pink'], styles: ['tee'], vibes: ['clean', 'sporty'], keywords: ['t-shirt', 'basic tee'], featured: true },
  }),
  product({
    id: 'catalog-top-skims-tank',
    category: 'top',
    brand: 'Skims',
    name: 'Cotton Jersey Tank',
    priceCents: 3800,
    currency: 'USD',
    retailer: 'Skims',
    retailerUrl: 'https://skims.com/search?q=cotton%20jersey%20tank',
    imageUrl: catalogImage('#e5b1a5', 'Jersey Tank', 'SKIMS'),
    metadata: { colors: ['white', 'brown', 'cream'], styles: ['tank'], vibes: ['clean', 'minimal'], keywords: ['tank top', 'fitted'] },
  }),
  product({
    id: 'catalog-top-essentials-hoodie',
    category: 'top',
    brand: 'Essentials',
    name: 'Pullover Hoodie',
    priceCents: 11000,
    currency: 'USD',
    retailer: 'SSENSE',
    retailerUrl: 'https://www.ssense.com/en-us/search?q=essentials%20hoodie',
    imageUrl: catalogImage('#cfb493', 'Hoodie', 'ESSENTIALS'),
    metadata: { colors: ['grey', 'cream', 'black'], styles: ['hoodie'], vibes: ['cozy', 'streetwear'], keywords: ['fear of god', 'oversized'] },
  }),
  product({
    id: 'catalog-top-zara-corset',
    category: 'top',
    brand: 'Zara',
    name: 'Satin Corset Top',
    priceCents: 4990,
    currency: 'USD',
    retailer: 'Zara',
    retailerUrl: 'https://www.zara.com/us/en/search?searchTerm=corset%20top',
    imageUrl: catalogImage('#f48ebc', 'Corset Top', 'ZARA'),
    metadata: { colors: ['black', 'pink'], styles: ['corset', 'top'], vibes: ['night out', 'dressy'], keywords: ['strapless', 'satin'] },
  }),
  product({
    id: 'catalog-top-uniqlo-airism',
    category: 'top',
    brand: 'Uniqlo',
    name: 'AIRism Cotton Oversized Tee',
    priceCents: 2490,
    currency: 'USD',
    retailer: 'Uniqlo',
    retailerUrl: 'https://www.uniqlo.com/us/en/products/E465185-001/00',
    imageUrl: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/465185/feature/usgoods_465185_feature1.jpg',
    metadata: { colors: ['white', 'black', 'grey'], styles: ['tee', 'oversized'], vibes: ['clean', 'minimal'], keywords: ['basic', 'airism'] },
  }),
  product({
    id: 'catalog-top-aritzia-contour',
    category: 'top',
    brand: 'Aritzia',
    name: 'Contour Squareneck Bodysuit',
    priceCents: 5800,
    currency: 'USD',
    retailer: 'Aritzia',
    retailerUrl: 'https://www.aritzia.com/us/en/search?q=contour%20bodysuit',
    imageUrl: catalogImage('#d8b5aa', 'Contour', 'ARITZIA'),
    metadata: { colors: ['black', 'white', 'brown'], styles: ['bodysuit'], vibes: ['clean', 'going out'], keywords: ['square neck', 'fitted'] },
  }),
  product({
    id: 'catalog-top-stussy-tee',
    category: 'top',
    brand: 'Stussy',
    name: 'Basic Logo Tee',
    priceCents: 4500,
    currency: 'USD',
    retailer: 'Stussy',
    retailerUrl: 'https://www.stussy.com/search?q=tee',
    imageUrl: catalogImage('#ffd66c', 'Logo Tee', 'STUSSY'),
    metadata: { colors: ['white', 'black'], styles: ['graphic tee'], vibes: ['streetwear'], keywords: ['logo', 'tee'] },
  }),
  product({
    id: 'catalog-top-ralphlauren-oxford',
    category: 'top',
    brand: 'Polo Ralph Lauren',
    name: 'Classic Fit Oxford Shirt',
    priceCents: 12500,
    currency: 'USD',
    retailer: 'Ralph Lauren',
    retailerUrl: 'https://www.ralphlauren.com/search?q=oxford%20shirt',
    imageUrl: catalogImage('#b9d3ff', 'Oxford Shirt', 'POLO'),
    metadata: { colors: ['blue', 'white'], styles: ['button-down'], vibes: ['preppy', 'office'], keywords: ['oxford', 'shirt'] },
  }),
  product({
    id: 'catalog-top-hm-ribtank',
    category: 'top',
    brand: 'H&M',
    name: 'Rib-Knit Tank Top',
    priceCents: 999,
    currency: 'USD',
    retailer: 'H&M',
    retailerUrl: 'https://www2.hm.com/en_us/search-results.html?q=rib%20tank',
    imageUrl: catalogImage('#ece6de', 'Rib Tank', 'H&M'),
    metadata: { colors: ['white', 'black', 'beige'], styles: ['tank'], vibes: ['clean', 'summer'], keywords: ['basic tank', 'rib knit'] },
  }),
  product({
    id: 'catalog-top-lululemon-swiftly',
    category: 'top',
    brand: 'Lululemon',
    name: 'Swiftly Tech Short-Sleeve Shirt',
    priceCents: 6800,
    currency: 'USD',
    retailer: 'Lululemon',
    retailerUrl: 'https://shop.lululemon.com/search?Ntt=swiftly%20tech',
    imageUrl: catalogImage('#f09b93', 'Swiftly Tech', 'LULULEMON'),
    metadata: { colors: ['pink', 'black', 'white'], styles: ['athletic tee'], vibes: ['gym', 'sporty'], keywords: ['workout top', 'performance tee'] },
  }),
  product({
    id: 'catalog-top-alo-crop',
    category: 'top',
    brand: 'Alo',
    name: 'Alosoft Finesse Tee',
    priceCents: 5800,
    currency: 'USD',
    retailer: 'Alo',
    retailerUrl: 'https://www.aloyoga.com/search?q=tee',
    imageUrl: catalogImage('#ccb6ad', 'Finesse Tee', 'ALO'),
    metadata: { colors: ['black', 'cream'], styles: ['tee'], vibes: ['gym', 'clean'], keywords: ['studio top', 'soft tee'] },
  }),

  product({
    id: 'catalog-bottom-levis-501',
    category: 'bottom',
    brand: "Levi's",
    name: '501 Original Jeans',
    priceCents: 9800,
    currency: 'USD',
    retailer: "Levi's",
    retailerUrl: 'https://www.levi.com/US/en_US/search?q=501',
    imageUrl: catalogImage('#63a7ff', '501 Original', "LEVI'S"),
    metadata: { colors: ['blue', 'black'], styles: ['jeans'], vibes: ['casual', 'vintage'], keywords: ['straight leg', 'denim'], featured: true },
  }),
  product({
    id: 'catalog-bottom-dickies-874',
    category: 'bottom',
    brand: 'Dickies',
    name: '874 Work Pants',
    priceCents: 4500,
    currency: 'USD',
    retailer: 'Dickies',
    retailerUrl: 'https://www.dickies.com/search?q=874',
    imageUrl: catalogImage('#f4a32e', '874 Pant', 'DICKIES'),
    metadata: { colors: ['black', 'khaki', 'navy'], styles: ['work pants'], vibes: ['streetwear', 'workwear'], keywords: ['straight leg', 'pant'] },
  }),
  product({
    id: 'catalog-bottom-aritzia-effortless',
    category: 'bottom',
    brand: 'Aritzia',
    name: 'The Effortless Pant',
    priceCents: 14800,
    currency: 'USD',
    retailer: 'Aritzia',
    retailerUrl: 'https://www.aritzia.com/us/en/product/effortless-pant/91837.html',
    imageUrl: 'https://assets.aritzia.com/image/upload/c_crop%2Car_1920%3A2623%2Cg_south/q_auto%2Cf_auto%2Cdpr_auto/s22_04_a06_91837_19451_on_a',
    metadata: { colors: ['black', 'brown', 'beige'], styles: ['trouser'], vibes: ['clean', 'office'], keywords: ['wide leg', 'tailored'] },
  }),
  product({
    id: 'catalog-bottom-zara-slip-skirt',
    category: 'bottom',
    brand: 'Zara',
    name: 'Satin Midi Slip Skirt',
    priceCents: 4590,
    currency: 'USD',
    retailer: 'Zara',
    retailerUrl: 'https://www.zara.com/us/en/search?searchTerm=slip%20skirt',
    imageUrl: catalogImage('#f3a6c1', 'Slip Skirt', 'ZARA'),
    metadata: { colors: ['black', 'pink', 'cream'], styles: ['skirt', 'midi'], vibes: ['night out', 'clean'], keywords: ['satin', 'midi skirt'] },
  }),
  product({
    id: 'catalog-bottom-agolde-90s',
    category: 'bottom',
    brand: 'AGOLDE',
    name: '90s Pinch Waist Jeans',
    priceCents: 22800,
    currency: 'USD',
    retailer: 'Revolve',
    retailerUrl: 'https://www.revolve.com/r/Search.jsp?search=agolde%2090s',
    imageUrl: catalogImage('#b7d3ff', '90s Jean', 'AGOLDE'),
    metadata: { colors: ['blue'], styles: ['jeans'], vibes: ['clean', 'denim'], keywords: ['pinch waist', 'straight'] },
  }),
  product({
    id: 'catalog-bottom-nike-jogger',
    category: 'bottom',
    brand: 'Nike',
    name: 'Club Fleece Joggers',
    priceCents: 6000,
    currency: 'USD',
    retailer: 'Nike',
    retailerUrl: 'https://www.nike.com/w?q=fleece%20joggers',
    imageUrl: catalogImage('#8fd27f', 'Fleece Jogger', 'NIKE'),
    metadata: { colors: ['grey', 'black'], styles: ['joggers'], vibes: ['sporty', 'cozy'], keywords: ['sweatpants', 'fleece'] },
  }),
  product({
    id: 'catalog-bottom-madewell-wideleg',
    category: 'bottom',
    brand: 'Madewell',
    name: 'Superwide-Leg Jeans',
    priceCents: 13800,
    currency: 'USD',
    retailer: 'Madewell',
    retailerUrl: 'https://www.madewell.com/search?q=wide%20leg%20jeans',
    imageUrl: catalogImage('#a8c4ff', 'Wide-Leg', 'MADEWELL'),
    metadata: { colors: ['blue'], styles: ['jeans'], vibes: ['clean', 'casual'], keywords: ['superwide leg', 'denim'] },
  }),
  product({
    id: 'catalog-bottom-abercrombie-tailored',
    category: 'bottom',
    brand: 'Abercrombie',
    name: 'Sloane Tailored Pant',
    priceCents: 9000,
    currency: 'USD',
    retailer: 'Abercrombie',
    retailerUrl: 'https://www.abercrombie.com/shop/us/search?searchTerm=sloane%20pant',
    imageUrl: catalogImage('#b7ab98', 'Sloane Pant', 'ABERCROMBIE'),
    metadata: { colors: ['black', 'brown', 'grey'], styles: ['trouser'], vibes: ['office', 'clean'], keywords: ['tailored pant', 'sloane'] },
  }),
  product({
    id: 'catalog-bottom-lululemon-align',
    category: 'bottom',
    brand: 'Lululemon',
    name: 'Align High-Rise Pant',
    priceCents: 9800,
    currency: 'USD',
    retailer: 'Lululemon',
    retailerUrl: 'https://shop.lululemon.com/search?Ntt=align%20pant',
    imageUrl: catalogImage('#f0a19a', 'Align Pant', 'LULULEMON'),
    metadata: { colors: ['black', 'brown'], styles: ['leggings'], vibes: ['gym', 'wellness'], keywords: ['yoga pants', 'align'] },
  }),

  product({
    id: 'catalog-shoes-nike-af1',
    category: 'shoes',
    brand: 'Nike',
    name: "Air Force 1 '07",
    priceCents: 11500,
    currency: 'USD',
    retailer: 'Nike',
    retailerUrl: 'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr',
    imageUrl: 'https://static.nike.com/a/images/t_default/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png',
    metadata: { colors: ['white', 'black'], styles: ['sneakers'], vibes: ['clean', 'streetwear'], keywords: ['af1', 'low top'], featured: true },
  }),
  product({
    id: 'catalog-shoes-adidas-samba',
    category: 'shoes',
    brand: 'Adidas',
    name: 'Samba OG Shoes',
    priceCents: 10000,
    currency: 'USD',
    retailer: 'Adidas',
    retailerUrl: 'https://www.adidas.com/us/search?q=samba',
    imageUrl: catalogImage('#f3f4f6', 'Samba OG', 'ADIDAS'),
    metadata: { colors: ['black', 'white'], styles: ['sneakers'], vibes: ['streetwear', 'retro'], keywords: ['gum sole', 'soccer'] },
  }),
  product({
    id: 'catalog-shoes-newbalance-530',
    category: 'shoes',
    brand: 'New Balance',
    name: '530 Sneakers',
    priceCents: 10000,
    currency: 'USD',
    retailer: 'New Balance',
    retailerUrl: 'https://www.newbalance.com/search/?q=530',
    imageUrl: catalogImage('#c8ced6', '530', 'NEW BALANCE'),
    metadata: { colors: ['silver', 'white'], styles: ['sneakers'], vibes: ['clean', 'sporty'], keywords: ['running shoe', 'dad shoe'] },
  }),
  product({
    id: 'catalog-shoes-docmartens-1460',
    category: 'shoes',
    brand: 'Dr. Martens',
    name: '1460 Smooth Leather Boots',
    priceCents: 17000,
    currency: 'USD',
    retailer: 'Dr. Martens',
    retailerUrl: 'https://www.drmartens.com/us/en/search?text=1460',
    imageUrl: catalogImage('#f0c454', '1460 Boot', 'DOCS'),
    metadata: { colors: ['black'], styles: ['boots'], vibes: ['grunge', 'edgy'], keywords: ['combat boot', 'lace up'] },
  }),
  product({
    id: 'catalog-shoes-converse-chuck70',
    category: 'shoes',
    brand: 'Converse',
    name: 'Chuck 70 High Top',
    priceCents: 9000,
    currency: 'USD',
    retailer: 'Converse',
    retailerUrl: 'https://www.converse.com/search?searchTerm=chuck%2070',
    imageUrl: catalogImage('#ffd36c', 'Chuck 70', 'CONVERSE'),
    metadata: { colors: ['black', 'white'], styles: ['sneakers'], vibes: ['casual', 'retro'], keywords: ['high top', 'canvas'] },
  }),
  product({
    id: 'catalog-shoes-stevemadden-heel',
    category: 'shoes',
    brand: 'Steve Madden',
    name: 'Madden pointed slingback heel',
    priceCents: 11000,
    currency: 'USD',
    retailer: 'Steve Madden',
    retailerUrl: 'https://www.stevemadden.com/products/cary-black-leather',
    imageUrl: 'https://www.stevemadden.com/cdn/shop/files/STEVEMADDEN_SHOES_CARY_BLACK-LEATHER_01.jpg?v=1729613675',
    metadata: { colors: ['black', 'silver'], styles: ['heels'], vibes: ['night out', 'dressy'], keywords: ['pump', 'pointed toe'] },
  }),
  product({
    id: 'catalog-shoes-jordan-1low',
    category: 'shoes',
    brand: 'Jordan',
    name: 'Air Jordan 1 Low',
    priceCents: 11500,
    currency: 'USD',
    retailer: 'Nike',
    retailerUrl: 'https://www.nike.com/w?q=air%20jordan%201%20low',
    imageUrl: catalogImage('#ff8a74', 'Jordan 1 Low', 'JORDAN'),
    metadata: { colors: ['red', 'black', 'white'], styles: ['sneakers'], vibes: ['streetwear', 'sporty'], keywords: ['jordan', 'basketball'] },
  }),
  product({
    id: 'catalog-shoes-ugg-ultramini',
    category: 'shoes',
    brand: 'UGG',
    name: 'Classic Ultra Mini Boot',
    priceCents: 15000,
    currency: 'USD',
    retailer: 'UGG',
    retailerUrl: 'https://www.ugg.com/search?q=ultra%20mini',
    imageUrl: catalogImage('#d5b48d', 'Ultra Mini', 'UGG'),
    metadata: { colors: ['tan', 'black', 'brown'], styles: ['boots'], vibes: ['cozy', 'casual'], keywords: ['mini boot', 'shearling'] },
  }),
  product({
    id: 'catalog-shoes-birkenstock-boston',
    category: 'shoes',
    brand: 'Birkenstock',
    name: 'Boston Soft Footbed Clog',
    priceCents: 15800,
    currency: 'USD',
    retailer: 'Birkenstock',
    retailerUrl: 'https://www.birkenstock.com/us/search?q=boston',
    imageUrl: catalogImage('#c6aa85', 'Boston Clog', 'BIRKENSTOCK'),
    metadata: { colors: ['tan', 'brown'], styles: ['clogs'], vibes: ['cozy', 'minimal'], keywords: ['boston', 'soft footbed'] },
  }),

  product({
    id: 'catalog-bag-coach-tabby',
    category: 'bag',
    brand: 'Coach',
    name: 'Tabby Shoulder Bag 26',
    priceCents: 45000,
    currency: 'USD',
    retailer: 'Coach',
    retailerUrl: 'https://www.coach.com/search?q=tabby',
    imageUrl: catalogImage('#f0b15f', 'Tabby 26', 'COACH'),
    metadata: { colors: ['black', 'cream'], styles: ['shoulder bag'], vibes: ['clean', 'luxury'], keywords: ['tabby', 'shoulder bag'], featured: true },
  }),
  product({
    id: 'catalog-bag-telfar-shopping',
    category: 'bag',
    brand: 'Telfar',
    name: 'Medium Shopping Bag',
    priceCents: 20200,
    currency: 'USD',
    retailer: 'Telfar',
    retailerUrl: 'https://telfar.net/search?q=shopping%20bag',
    imageUrl: catalogImage('#d4d8de', 'Shopping Bag', 'TELFAR'),
    metadata: { colors: ['black', 'silver'], styles: ['tote'], vibes: ['streetwear', 'it-girl'], keywords: ['shopping bag', 'logo'] },
  }),
  product({
    id: 'catalog-bag-prada-renylon',
    category: 'bag',
    brand: 'Prada',
    name: 'Re-Nylon Re-Edition 2005 Bag',
    priceCents: 195000,
    currency: 'USD',
    retailer: 'Prada',
    retailerUrl: 'https://www.prada.com/us/en/search-result.html?query=re-nylon%20bag',
    imageUrl: catalogImage('#9de88c', 'Re-Edition', 'PRADA'),
    metadata: { colors: ['black'], styles: ['shoulder bag'], vibes: ['luxury', 'minimal'], keywords: ['nylon', 'designer'] },
  }),
  product({
    id: 'catalog-bag-longchamp-lepliage',
    category: 'bag',
    brand: 'Longchamp',
    name: 'Le Pliage Original Tote',
    priceCents: 15500,
    currency: 'USD',
    retailer: 'Longchamp',
    retailerUrl: 'https://www.longchamp.com/us/en/products/tote-bag-l-L1899089001.html',
    imageUrl: 'https://www.longchamp.com/dw/image/v2/BCVX_PRD/on/demandware.static/-/Sites-LC-master-catalog/default/dw159f0d70/images/DIS/L1899089001_0.png?q=100&sh=2000&sm=fit&sw=2000',
    metadata: { colors: ['black', 'navy', 'green'], styles: ['tote'], vibes: ['clean', 'travel'], keywords: ['foldable tote', 'nylon tote'] },
  }),
  product({
    id: 'catalog-bag-bottega-cassette',
    category: 'bag',
    brand: 'Bottega Veneta',
    name: 'Cassette Crossbody Bag',
    priceCents: 320000,
    currency: 'USD',
    retailer: 'Bottega Veneta',
    retailerUrl: 'https://www.bottegaveneta.com/en-us/search?q=cassette',
    imageUrl: catalogImage('#94d49d', 'Cassette', 'BOTTEGA'),
    metadata: { colors: ['green', 'black'], styles: ['crossbody'], vibes: ['luxury', 'minimal'], keywords: ['woven', 'intrecciato'] },
  }),
  product({
    id: 'catalog-bag-lululemon-beltbag',
    category: 'bag',
    brand: 'Lululemon',
    name: 'Everywhere Belt Bag 1L',
    priceCents: 3800,
    currency: 'USD',
    retailer: 'Lululemon',
    retailerUrl: 'https://shop.lululemon.com/search?Ntt=everywhere%20belt%20bag',
    imageUrl: catalogImage('#f39b8f', 'Belt Bag', 'LULULEMON'),
    metadata: { colors: ['black', 'pink', 'beige'], styles: ['belt bag'], vibes: ['sporty', 'casual'], keywords: ['crossbody', 'waist bag'] },
  }),
  product({
    id: 'catalog-bag-saintlaurent-le5a7',
    category: 'bag',
    brand: 'Saint Laurent',
    name: 'Le 5 A 7 Hobo Bag',
    priceCents: 290000,
    currency: 'USD',
    retailer: 'Saint Laurent',
    retailerUrl: 'https://www.ysl.com/en-us/search?q=le%205%20a%207',
    imageUrl: catalogImage('#111111', 'Le 5 A 7', 'YSL'),
    metadata: { colors: ['black'], styles: ['shoulder bag'], vibes: ['luxury', 'night'], keywords: ['hobo bag', 'ysl'] },
  }),
  product({
    id: 'catalog-bag-michaelkors-tote',
    category: 'bag',
    brand: 'Michael Kors',
    name: 'Jet Set Travel Tote',
    priceCents: 27800,
    currency: 'USD',
    retailer: 'Michael Kors',
    retailerUrl: 'https://www.michaelkors.com/search?q=jet%20set%20tote',
    imageUrl: catalogImage('#d1b285', 'Jet Set', 'MK'),
    metadata: { colors: ['brown', 'black'], styles: ['tote'], vibes: ['work', 'classic'], keywords: ['travel tote', 'jet set'] },
  }),

  product({
    id: 'catalog-eyewear-rayban-wayfarer',
    category: 'eyewear',
    brand: 'Ray-Ban',
    name: 'Original Wayfarer Classic',
    priceCents: 17000,
    currency: 'USD',
    retailer: 'Ray-Ban',
    retailerUrl: 'https://www.ray-ban.com/usa/search?query=wayfarer',
    imageUrl: catalogImage('#f99254', 'Wayfarer', 'RAY-BAN'),
    metadata: { colors: ['black'], styles: ['sunglasses'], vibes: ['clean', 'classic'], keywords: ['wayfarer', 'classic'], featured: true },
  }),
  product({
    id: 'catalog-eyewear-oakley-sutro',
    category: 'eyewear',
    brand: 'Oakley',
    name: 'Sutro Lite Sunglasses',
    priceCents: 19200,
    currency: 'USD',
    retailer: 'Oakley',
    retailerUrl: 'https://www.oakley.com/en-us/search?text=sutro',
    imageUrl: catalogImage('#92d7f0', 'Sutro Lite', 'OAKLEY'),
    metadata: { colors: ['black', 'silver'], styles: ['shield'], vibes: ['sporty', 'futuristic'], keywords: ['sport sunglasses', 'wraparound'] },
  }),
  product({
    id: 'catalog-eyewear-prada-symbole',
    category: 'eyewear',
    brand: 'Prada',
    name: 'Symbole Sunglasses',
    priceCents: 52000,
    currency: 'USD',
    retailer: 'Prada',
    retailerUrl: 'https://www.prada.com/us/en/search-result.html?query=sunglasses',
    imageUrl: catalogImage('#95e08f', 'Symbole', 'PRADA'),
    metadata: { colors: ['black'], styles: ['sunglasses'], vibes: ['luxury', 'editorial'], keywords: ['rectangle', 'logo'] },
  }),
  product({
    id: 'catalog-eyewear-gentlemonster-lang',
    category: 'eyewear',
    brand: 'Gentle Monster',
    name: 'Lang 01 Sunglasses',
    priceCents: 32000,
    currency: 'USD',
    retailer: 'Gentle Monster',
    retailerUrl: 'https://www.gentlemonster.com/us/shop/search?keyword=lang',
    imageUrl: catalogImage('#e2d9ee', 'Lang 01', 'GENTLE'),
    metadata: { colors: ['black'], styles: ['sunglasses'], vibes: ['fashion', 'clean'], keywords: ['oval', 'minimal'] },
  }),
  product({
    id: 'catalog-eyewear-warby-durand',
    category: 'eyewear',
    brand: 'Warby Parker',
    name: 'Durand Eyeglasses',
    priceCents: 9500,
    currency: 'USD',
    retailer: 'Warby Parker',
    retailerUrl: 'https://www.warbyparker.com/search?q=durand',
    imageUrl: catalogImage('#d4b793', 'Durand', 'WARBY'),
    metadata: { colors: ['brown', 'black'], styles: ['eyeglasses'], vibes: ['clean', 'smart'], keywords: ['optical', 'frame'] },
  }),
  product({
    id: 'catalog-eyewear-gucci-cateye',
    category: 'eyewear',
    brand: 'Gucci',
    name: 'Cat-Eye Acetate Sunglasses',
    priceCents: 43000,
    currency: 'USD',
    retailer: 'Gucci',
    retailerUrl: 'https://www.gucci.com/us/en/search?q=sunglasses',
    imageUrl: catalogImage('#d7a273', 'Cat-Eye', 'GUCCI'),
    metadata: { colors: ['black'], styles: ['cat eye'], vibes: ['glam', 'luxury'], keywords: ['acetate', 'statement'] },
  }),
  product({
    id: 'catalog-eyewear-versace-medusa',
    category: 'eyewear',
    brand: 'Versace',
    name: 'Medusa Biggie Sunglasses',
    priceCents: 34500,
    currency: 'USD',
    retailer: 'Versace',
    retailerUrl: 'https://www.versace.com/us/en-us/search/?text=sunglasses',
    imageUrl: catalogImage('#f1c36b', 'Medusa', 'VERSACE'),
    metadata: { colors: ['black', 'gold'], styles: ['sunglasses'], vibes: ['edgy', 'luxury'], keywords: ['statement shades', 'medusa'] },
  }),
  product({
    id: 'catalog-eyewear-quayaft',
    category: 'eyewear',
    brand: 'Quay',
    name: 'After Hours Sunglasses',
    priceCents: 8500,
    currency: 'USD',
    retailer: 'Quay',
    retailerUrl: 'https://www.quayaustralia.com/search?q=after%20hours',
    imageUrl: catalogImage('#d4c4aa', 'After Hours', 'QUAY'),
    metadata: { colors: ['black', 'brown'], styles: ['sunglasses'], vibes: ['night', 'festival'], keywords: ['oversized shades', 'quay'] },
  }),

  product({
    id: 'catalog-jewelry-mejuri-dome',
    category: 'jewelry',
    brand: 'Mejuri',
    name: 'Thin Dome Ring',
    priceCents: 9800,
    currency: 'USD',
    retailer: 'Mejuri',
    retailerUrl: 'https://mejuri.com/search?query=dome%20ring',
    imageUrl: catalogImage('#f4dd67', 'Dome Ring', 'MEJURI'),
    metadata: { colors: ['gold'], styles: ['ring'], vibes: ['clean', 'minimal'], keywords: ['gold ring', 'stacking'], featured: true },
  }),
  product({
    id: 'catalog-jewelry-pandora-hoops',
    category: 'jewelry',
    brand: 'Pandora',
    name: 'Sparkling Huggie Hoop Earrings',
    priceCents: 7500,
    currency: 'USD',
    retailer: 'Pandora',
    retailerUrl: 'https://us.pandora.net/en/search?q=huggie',
    imageUrl: catalogImage('#f8d1e2', 'Huggie Hoops', 'PANDORA'),
    metadata: { colors: ['silver', 'gold'], styles: ['earrings'], vibes: ['clean', 'feminine'], keywords: ['hoops', 'huggie'] },
  }),
  product({
    id: 'catalog-jewelry-swarovski-tennis',
    category: 'jewelry',
    brand: 'Swarovski',
    name: 'Tennis Deluxe Bracelet',
    priceCents: 12900,
    currency: 'USD',
    retailer: 'Swarovski',
    retailerUrl: 'https://www.swarovski.com/en-US/search/?text=tennis%20bracelet',
    imageUrl: catalogImage('#cad8ff', 'Tennis', 'SWAROVSKI'),
    metadata: { colors: ['silver'], styles: ['bracelet'], vibes: ['dressy', 'glam'], keywords: ['crystal', 'tennis bracelet'] },
  }),
  product({
    id: 'catalog-jewelry-tiffany-hearttag',
    category: 'jewelry',
    brand: 'Tiffany & Co.',
    name: 'Return to Tiffany Heart Tag Pendant',
    priceCents: 72500,
    currency: 'USD',
    retailer: 'Tiffany & Co.',
    retailerUrl: 'https://www.tiffany.com/search/?q=heart%20tag',
    imageUrl: catalogImage('#8bd7e9', 'Heart Tag', 'TIFFANY'),
    metadata: { colors: ['silver'], styles: ['necklace'], vibes: ['luxury', 'iconic'], keywords: ['pendant', 'heart tag'] },
  }),
  product({
    id: 'catalog-jewelry-analuisa-chain',
    category: 'jewelry',
    brand: 'Ana Luisa',
    name: 'Rope Chain Necklace',
    priceCents: 8500,
    currency: 'USD',
    retailer: 'Ana Luisa',
    retailerUrl: 'https://www.analuisa.com/search/?q=rope%20chain',
    imageUrl: catalogImage('#f3cc6f', 'Rope Chain', 'ANA LUISA'),
    metadata: { colors: ['gold'], styles: ['necklace'], vibes: ['clean', 'layered'], keywords: ['chain', 'gold necklace'] },
  }),
  product({
    id: 'catalog-jewelry-missoma-pearlhoop',
    category: 'jewelry',
    brand: 'Missoma',
    name: 'Pearl Ridge Hoop Earrings',
    priceCents: 14500,
    currency: 'USD',
    retailer: 'Missoma',
    retailerUrl: 'https://www.missoma.com/search?q=pearl%20hoop',
    imageUrl: catalogImage('#f5e7c8', 'Pearl Hoop', 'MISSOMA'),
    metadata: { colors: ['gold', 'cream'], styles: ['earrings'], vibes: ['coastal', 'dressy'], keywords: ['pearl', 'hoops'] },
  }),
  product({
    id: 'catalog-jewelry-kendra-scott-pendant',
    category: 'jewelry',
    brand: 'Kendra Scott',
    name: 'Elisa Pendant Necklace',
    priceCents: 7000,
    currency: 'USD',
    retailer: 'Kendra Scott',
    retailerUrl: 'https://www.kendrascott.com/search?q=elisa',
    imageUrl: catalogImage('#f0d88d', 'Elisa', 'KENDRA'),
    metadata: { colors: ['gold'], styles: ['necklace'], vibes: ['clean', 'giftable'], keywords: ['pendant', 'layering necklace'] },
  }),
  product({
    id: 'catalog-jewelry-davidyurman-cable',
    category: 'jewelry',
    brand: 'David Yurman',
    name: 'Cable Classics Bracelet',
    priceCents: 39500,
    currency: 'USD',
    retailer: 'David Yurman',
    retailerUrl: 'https://www.davidyurman.com/search?q=cable%20bracelet',
    imageUrl: catalogImage('#b9c8de', 'Cable', 'YURMAN'),
    metadata: { colors: ['silver'], styles: ['bracelet'], vibes: ['luxury', 'classic'], keywords: ['cable bracelet', 'signature'] },
  }),
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function scoreCatalogProduct(product: Product, intent: SearchIntent, rawQuery: string): number {
  const haystack = normalize([
    product.brand,
    product.name,
    product.retailer,
    ...(Array.isArray(product.metadata?.colors) ? (product.metadata.colors as string[]) : []),
    ...(Array.isArray(product.metadata?.styles) ? (product.metadata.styles as string[]) : []),
    ...(Array.isArray(product.metadata?.vibes) ? (product.metadata.vibes as string[]) : []),
    ...(Array.isArray(product.metadata?.keywords) ? (product.metadata.keywords as string[]) : []),
  ].join(' '));

  const queryTerms = new Set<string>([
    ...tokenize(rawQuery),
    ...(intent.brand || []).flatMap(tokenize),
    ...(intent.color || []).flatMap(tokenize),
    ...(intent.style || []).flatMap(tokenize),
    ...(intent.keywords || []).flatMap(tokenize),
  ]);

  let score = product.metadata?.featured ? 12 : 0;

  if (intent.priceMax && product.priceCents > intent.priceMax * 100) score -= 18;
  if (intent.priceMin && product.priceCents < intent.priceMin * 100) score -= 10;

  for (const term of queryTerms) {
    if (!term) continue;
    if (normalize(product.brand).includes(term)) score += 16;
    if (normalize(product.name).includes(term)) score += 12;
    else if (haystack.includes(term)) score += 8;
  }

  if ((intent.brand || []).some((brand) => normalize(product.brand) === normalize(brand))) {
    score += 24;
  }

  if ((intent.color || []).some((color) => haystack.includes(normalize(color)))) {
    score += 8;
  }

  if ((intent.style || []).some((style) => haystack.includes(normalize(style)))) {
    score += 10;
  }

  return score;
}

export function searchBrandCatalog(
  intent: SearchIntent,
  rawQuery: string,
  limit = 6,
): Product[] {
  const pool = BRAND_CATALOG_PRODUCTS.filter((product) => product.category === intent.category);
  if (!pool.length) return [];

  if (!rawQuery.trim()) {
    return pool.slice(0, limit);
  }

  const scored = pool
    .map((product) => ({
      product,
      score: scoreCatalogProduct(product, intent, rawQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!scored.length) return [];

  const matched = scored.slice(0, limit).map((entry) => entry.product);
  if (matched.length >= limit) return matched;

  const seen = new Set(matched.map((product) => product.id));
  const fallback = pool.filter((product) => !seen.has(product.id)).slice(0, limit - matched.length);
  return [...matched, ...fallback];
}
