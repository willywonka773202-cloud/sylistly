import type { Category } from './types';

export interface CatalogSeedQuery {
  brand: string;
  category: Category;
  queries: string[];
  keywords?: string[];
}

export const PHOTO_CATALOG_SEEDS: CatalogSeedQuery[] = [
  { brand: 'Nike', category: 'top', queries: ['nike sportswear tee', 'nike club fleece hoodie', 'nike rib tank'] },
  { brand: 'Nike', category: 'bottom', queries: ['nike club fleece joggers', 'nike cargo pants', 'nike shorts'] },
  { brand: 'Nike', category: 'shoes', queries: ['nike air force 1', 'nike vomero', 'nike dunk low'] },
  { brand: 'Nike', category: 'hat', queries: ['nike club cap', 'nike beanie'] },
  { brand: 'Nike', category: 'bag', queries: ['nike crossbody bag', 'nike backpack'] },

  { brand: 'Adidas', category: 'top', queries: ['adidas baby tee', 'adidas track top', 'adidas tank top'] },
  { brand: 'Adidas', category: 'bottom', queries: ['adidas track pants', 'adidas cargo pants'] },
  { brand: 'Adidas', category: 'shoes', queries: ['adidas samba', 'adidas gazelle', 'adidas campus 00s'] },
  { brand: 'Adidas', category: 'outer', queries: ['adidas firebird track jacket'] },

  { brand: 'Zara', category: 'top', queries: ['zara satin top', 'zara cardigan', 'zara corset top'] },
  { brand: 'Zara', category: 'bottom', queries: ['zara wide leg trousers', 'zara midi skirt', 'zara jeans'] },
  { brand: 'Zara', category: 'outer', queries: ['zara trench coat', 'zara faux leather jacket', 'zara bomber jacket'] },
  { brand: 'Zara', category: 'shoes', queries: ['zara slingback heel', 'zara loafers'] },
  { brand: 'Zara', category: 'bag', queries: ['zara shoulder bag', 'zara tote bag'] },

  { brand: 'H&M', category: 'top', queries: ['h&m rib knit tank top', 'h&m oversized tee', 'h&m cardigan'] },
  { brand: 'H&M', category: 'bottom', queries: ['h&m linen pants', 'h&m mini skirt', 'h&m wide jeans'] },
  { brand: 'H&M', category: 'outer', queries: ['h&m blazer', 'h&m trench coat'] },
  { brand: 'H&M', category: 'hat', queries: ['h&m bucket hat', 'h&m baseball cap'] },

  { brand: 'Uniqlo', category: 'top', queries: ['uniqlo airism oversized tee', 'uniqlo u tee', 'uniqlo oxford shirt'] },
  { brand: 'Uniqlo', category: 'bottom', queries: ['uniqlo pleated wide pants', 'uniqlo cargo pants'] },
  { brand: 'Uniqlo', category: 'outer', queries: ['uniqlo utility jacket', 'uniqlo puffer jacket'] },

  { brand: 'Lululemon', category: 'top', queries: ['lululemon swiftly tech short sleeve', 'lululemon align tank', 'lululemon define jacket'] },
  { brand: 'Lululemon', category: 'bottom', queries: ['lululemon align high rise pant', 'lululemon dance studio pant'] },
  { brand: 'Lululemon', category: 'bag', queries: ['lululemon everywhere belt bag'] },

  { brand: 'Alo', category: 'top', queries: ['alo cropped tee', 'alo airbrush bra', 'alo hoodie'] },
  { brand: 'Alo', category: 'bottom', queries: ['alo leggings', 'alo sweatpants'] },

  { brand: 'Skims', category: 'top', queries: ['skims cotton jersey tank', 'skims bodysuit', 'skims tee'] },
  { brand: 'Skims', category: 'bottom', queries: ['skims cotton fleece jogger', 'skims leggings'] },

  { brand: 'Aritzia', category: 'top', queries: ['aritzia contour bodysuit', 'aritzia babaton top'] },
  { brand: 'Aritzia', category: 'bottom', queries: ['aritzia effortless pant', 'aritzia denim forum jeans'] },
  { brand: 'Aritzia', category: 'outer', queries: ['aritzia super puff', 'aritzia blazer'] },

  { brand: 'Abercrombie', category: 'top', queries: ['abercrombie essential tee', 'abercrombie sweater vest', 'abercrombie oxford shirt'] },
  { brand: 'Abercrombie', category: 'bottom', queries: ['abercrombie sloane pant', 'abercrombie 90s straight jeans'] },
  { brand: 'Abercrombie', category: 'outer', queries: ['abercrombie bomber jacket', 'abercrombie leather jacket'] },

  { brand: 'Polo Ralph Lauren', category: 'top', queries: ['polo ralph lauren oxford shirt', 'polo ralph lauren cable knit sweater', 'polo tee'] },
  { brand: 'Polo Ralph Lauren', category: 'bottom', queries: ['polo ralph lauren chino pant'] },
  { brand: 'Polo Ralph Lauren', category: 'hat', queries: ['polo ralph lauren sports cap'] },

  { brand: "Levi's", category: 'bottom', queries: ["levi's 501 original jeans", "levi's baggy dad jeans", "levi's skirt"] },
  { brand: "Levi's", category: 'outer', queries: ["levi's trucker jacket"] },

  { brand: 'Dickies', category: 'bottom', queries: ['dickies 874 work pants', 'dickies cargo pants'] },
  { brand: 'Carhartt WIP', category: 'outer', queries: ['carhartt wip detroit jacket', 'carhartt active jacket'] },
  { brand: 'Carhartt WIP', category: 'bottom', queries: ['carhartt wip double knee pant'] },
  { brand: 'Stussy', category: 'top', queries: ['stussy basic tee', 'stussy hoodie'] },
  { brand: 'Stussy', category: 'hat', queries: ['stussy cap', 'stussy beanie'] },

  { brand: 'The North Face', category: 'outer', queries: ['north face nuptse jacket', 'north face shell jacket'] },
  { brand: "Arc'teryx", category: 'outer', queries: ["arc'teryx beta lt jacket", "arc'teryx atom hoody"] },

  { brand: 'New Balance', category: 'shoes', queries: ['new balance 530', 'new balance 9060', 'new balance 1906r'] },
  { brand: 'Jordan', category: 'shoes', queries: ['air jordan 1 low', 'jordan 4 retro'] },
  { brand: 'Converse', category: 'shoes', queries: ['converse chuck 70 high top'] },
  { brand: 'Dr. Martens', category: 'shoes', queries: ['dr martens 1460 boot', 'dr martens adrian loafer'] },
  { brand: 'UGG', category: 'shoes', queries: ['ugg ultra mini boot', 'ugg tasman slipper'] },
  { brand: 'Birkenstock', category: 'shoes', queries: ['birkenstock boston clog', 'birkenstock arizona sandal'] },
  { brand: 'Steve Madden', category: 'shoes', queries: ['steve madden slingback heel', 'steve madden loafers'] },

  { brand: 'Coach', category: 'bag', queries: ['coach tabby shoulder bag', 'coach tote bag'] },
  { brand: 'Telfar', category: 'bag', queries: ['telfar shopping bag'] },
  { brand: 'Longchamp', category: 'bag', queries: ['longchamp le pliage tote'] },
  { brand: 'Michael Kors', category: 'bag', queries: ['michael kors jet set tote'] },
  { brand: 'Saint Laurent', category: 'bag', queries: ['saint laurent le 5 a 7 bag'] },
  { brand: 'Prada', category: 'bag', queries: ['prada re nylon re edition bag'] },
  { brand: 'Bottega Veneta', category: 'bag', queries: ['bottega veneta cassette bag'] },

  { brand: 'Ray-Ban', category: 'eyewear', queries: ['ray ban wayfarer'] },
  { brand: 'Oakley', category: 'eyewear', queries: ['oakley sutro lite'] },
  { brand: 'Gentle Monster', category: 'eyewear', queries: ['gentle monster lang 01'] },
  { brand: 'Versace', category: 'eyewear', queries: ['versace medusa biggie sunglasses'] },
  { brand: 'Gucci', category: 'eyewear', queries: ['gucci cat eye sunglasses'] },

  { brand: 'Mejuri', category: 'jewelry', queries: ['mejuri dome ring', 'mejuri hoop earrings'] },
  { brand: 'Pandora', category: 'jewelry', queries: ['pandora huggie hoop earrings'] },
  { brand: 'Swarovski', category: 'jewelry', queries: ['swarovski tennis bracelet'] },
  { brand: 'Tiffany & Co.', category: 'jewelry', queries: ['tiffany heart tag pendant'] },
  { brand: 'Missoma', category: 'jewelry', queries: ['missoma pearl hoop earrings'] },
];
