/**
 * Procedural garment art engine.
 *
 * Produces recognizable, color-aware clothing silhouettes as fully self-contained
 * SVG data URLs. Each is its own isolated document (rendered via <img src>), so
 * fixed gradient/filter ids never collide. This is the visual backbone of the app:
 * closet items, outfit collages, swipe cards, stories and community posts all draw
 * from it. No network, no broken images, always renders, builds clean.
 */

export type GarmentShape =
  // tops
  | 'tee' | 'longsleeve' | 'shirt' | 'hoodie' | 'sweater' | 'tank' | 'blouse' | 'polo' | 'crop' | 'dress'
  // outerwear
  | 'jacket' | 'coat' | 'blazer' | 'puffer' | 'cardigan' | 'trench'
  // bottoms
  | 'pants' | 'jeans' | 'shorts' | 'skirt' | 'trousers' | 'joggers' | 'leggings'
  // shoes
  | 'sneaker' | 'boot' | 'heel' | 'loafer' | 'sandal' | 'runner'
  // bags
  | 'tote' | 'crossbody' | 'shoulderbag' | 'backpack' | 'clutch'
  // hats
  | 'cap' | 'beanie' | 'bucket' | 'fedora'
  // eyewear
  | 'sunglasses' | 'glasses'
  // jewelry / accessories
  | 'necklace' | 'watch' | 'hoops' | 'ring' | 'chain' | 'belt';

import type { Category } from './types';

interface Palette {
  base: string;
  light: string;
  lighter: string;
  dark: string;
  deep: string;
  line: string;
}

/* ---------- color helpers ---------- */

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h || '888888', 16);
  if (Number.isNaN(int)) return [136, 136, 136];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  );
}

const lighten = (hex: string, amt: number) => mix(hex, [255, 255, 255], amt);
const darken = (hex: string, amt: number) => mix(hex, [10, 9, 7], amt);

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
}

function palette(color: string): Palette {
  const light = isLight(color);
  return {
    base: color,
    light: lighten(color, light ? 0.06 : 0.16),
    lighter: lighten(color, light ? 0.14 : 0.3),
    dark: darken(color, light ? 0.1 : 0.18),
    deep: darken(color, light ? 0.2 : 0.34),
    line: darken(color, light ? 0.28 : 0.46),
  };
}

/* ---------- shape library ---------- */
/* Each returns inner SVG markup, drawn in a 200x240 viewBox, fill="url(#g)" for the
   main fabric, stroke seams using P.line. The wrapper supplies gradient + shadow. */

const SHAPES: Record<GarmentShape, (P: Palette) => string> = {
  tee: (P) => `
    <path d="M62 52 L44 60 L30 92 L52 102 L58 90 L58 184 Q58 192 66 192 L134 192 Q142 192 142 184 L142 90 L148 102 L170 92 L156 60 L138 52 Q119 70 100 70 Q81 70 62 52 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M62 52 Q81 70 100 70 Q119 70 138 52" fill="none" stroke="${P.line}" stroke-width="2" opacity=".5"/>
    <path d="M70 72 Q100 84 130 72" fill="none" stroke="${P.deep}" stroke-width="1.3" opacity=".4"/>`,
  longsleeve: (P) => `
    <path d="M64 52 L40 62 L22 150 L44 158 L58 96 L58 184 Q58 192 66 192 L134 192 Q142 192 142 184 L142 96 L156 158 L178 150 L160 62 L136 52 Q118 70 100 70 Q82 70 64 52 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M64 52 Q82 70 100 70 Q118 70 136 52" fill="none" stroke="${P.line}" stroke-width="2" opacity=".5"/>`,
  shirt: (P) => `
    <path d="M64 50 L42 60 L30 96 L50 104 L58 92 L58 186 Q58 192 64 192 L136 192 Q142 192 142 186 L142 92 L150 104 L170 96 L158 60 L136 50 L118 64 L100 76 L82 64 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M82 64 L94 58 L100 76 L106 58 L118 64" fill="${P.light}" stroke="${P.line}" stroke-width="1.2"/>
    <line x1="100" y1="76" x2="100" y2="190" stroke="${P.deep}" stroke-width="1.3" opacity=".5"/>
    ${[96, 116, 136, 156, 176].map((y) => `<circle cx="100" cy="${y}" r="2" fill="${P.line}"/>`).join('')}`,
  hoodie: (P) => `
    <path d="M62 56 L40 66 L26 100 L48 110 L58 96 L58 184 Q58 192 66 192 L134 192 Q142 192 142 184 L142 96 L152 110 L174 100 L160 66 L138 56 Q132 78 100 80 Q68 78 62 56 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M62 56 Q70 84 100 86 Q130 84 138 56 L132 52 Q116 70 100 70 Q84 70 68 52 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1.2"/>
    <rect x="74" y="120" width="52" height="34" rx="8" fill="${P.dark}" opacity=".55"/>
    <line x1="92" y1="86" x2="92" y2="116" stroke="${P.line}" stroke-width="3" stroke-linecap="round"/>
    <line x1="108" y1="86" x2="108" y2="116" stroke="${P.line}" stroke-width="3" stroke-linecap="round"/>`,
  sweater: (P) => `
    <path d="M64 54 L40 64 L24 140 L46 148 L58 92 L58 182 Q58 190 66 190 L134 190 Q142 190 142 182 L142 92 L154 148 L176 140 L160 64 L136 54 Q118 72 100 72 Q82 72 64 54 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M64 54 Q82 72 100 72 Q118 72 136 54 L130 64 Q116 78 100 78 Q84 78 70 64 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    ${[100, 116, 132, 148, 164, 180].map((y) => `<path d="M60 ${y} Q100 ${y + 6} 140 ${y}" fill="none" stroke="${P.deep}" stroke-width="1" opacity=".32"/>`).join('')}`,
  tank: (P) => `
    <path d="M74 56 L66 64 L62 186 Q62 192 68 192 L132 192 Q138 192 138 186 L134 64 L126 56 Q124 86 100 88 Q76 86 74 56 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M74 56 Q78 80 100 82 Q122 80 126 56" fill="none" stroke="${P.line}" stroke-width="1.6" opacity=".5"/>`,
  blouse: (P) => `
    <path d="M66 54 L44 64 L32 100 L52 108 L60 94 L58 186 Q58 192 64 192 L136 192 Q142 192 142 186 L140 94 L148 108 L168 100 L156 64 L134 54 Q117 74 100 74 Q83 74 66 54 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.3"/>
    <path d="M66 54 Q83 74 100 74 Q117 74 134 54" fill="none" stroke="${P.line}" stroke-width="1.6" opacity=".5"/>
    <path d="M84 96 Q100 110 116 96" fill="none" stroke="${P.deep}" stroke-width="1" opacity=".4"/>`,
  polo: (P) => `
    <path d="M64 52 L44 62 L32 96 L52 104 L58 92 L58 186 Q58 192 64 192 L136 192 Q142 192 142 186 L142 92 L148 104 L168 96 L156 62 L136 52 L118 62 L100 74 L82 62 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M82 62 L96 58 L100 92 L104 58 L118 62" fill="${P.dark}" stroke="${P.line}" stroke-width="1.1"/>
    ${[80, 90].map((y) => `<circle cx="100" cy="${y}" r="1.8" fill="${P.line}"/>`).join('')}`,
  crop: (P) => `
    <path d="M62 54 L44 62 L30 92 L52 102 L58 90 L58 140 Q58 146 64 146 L136 146 Q142 146 142 140 L142 90 L148 102 L170 92 L156 62 L138 54 Q119 72 100 72 Q81 72 62 54 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M62 54 Q81 72 100 72 Q119 72 138 54" fill="none" stroke="${P.line}" stroke-width="1.8" opacity=".5"/>`,
  dress: (P) => `
    <path d="M70 50 L52 60 L40 96 L58 104 L66 90 Q60 150 46 210 Q70 224 100 224 Q130 224 154 210 Q140 150 134 90 L142 104 L160 96 L148 60 L130 50 Q116 68 100 68 Q84 68 70 50 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M70 50 Q84 68 100 68 Q116 68 130 50" fill="none" stroke="${P.line}" stroke-width="1.8" opacity=".5"/>
    <path d="M66 110 Q100 124 134 110" fill="none" stroke="${P.deep}" stroke-width="1.2" opacity=".4"/>`,
  jacket: (P) => `
    <path d="M60 52 L38 62 L26 104 L48 114 L56 98 L56 188 Q56 192 60 192 L96 192 L96 96 L104 96 L104 192 L140 192 Q144 192 144 188 L144 98 L152 114 L174 104 L162 62 L140 52 L116 64 L100 70 L84 64 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <line x1="100" y1="70" x2="100" y2="192" stroke="${P.deep}" stroke-width="2" opacity=".55"/>
    <path d="M84 64 L96 72 L96 96 M116 64 L104 72 L104 96" fill="none" stroke="${P.line}" stroke-width="1.4"/>`,
  coat: (P) => `
    <path d="M58 50 L36 62 L24 116 L46 126 L54 104 L52 214 Q52 218 56 218 L96 218 L96 96 L104 96 L104 218 L144 218 Q148 218 148 214 L146 104 L154 126 L176 116 L164 62 L142 50 L116 64 L100 72 L84 64 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <line x1="100" y1="72" x2="100" y2="218" stroke="${P.deep}" stroke-width="2" opacity=".5"/>
    <path d="M84 64 L96 74 L96 110 M116 64 L104 74 L104 110" fill="none" stroke="${P.line}" stroke-width="1.4"/>
    ${[118, 150, 182].map((y) => `<circle cx="92" cy="${y}" r="2.2" fill="${P.line}"/>`).join('')}`,
  blazer: (P) => `
    <path d="M60 50 L40 60 L28 102 L48 112 L56 96 L56 196 Q56 200 60 200 L98 200 L92 110 L100 90 L108 110 L102 200 L140 200 Q144 200 144 196 L144 96 L152 112 L172 102 L160 60 L140 50 L118 60 L100 72 L82 60 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M82 60 L100 72 L92 110 L78 96 Z M118 60 L100 72 L108 110 L122 96 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1.1" opacity=".85"/>
    <rect x="120" y="150" width="18" height="3" rx="1.5" fill="${P.deep}" opacity=".5"/>`,
  puffer: (P) => `
    <path d="M58 56 L36 68 L28 110 L50 118 L58 102 L58 186 Q58 192 64 192 L136 192 Q142 192 142 186 L142 102 L150 118 L172 110 L164 68 L142 56 Q120 70 100 72 Q80 70 58 56 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    ${[88, 112, 136, 160, 184].map((y) => `<path d="M58 ${y} Q100 ${y + 7} 142 ${y}" fill="none" stroke="${P.deep}" stroke-width="2.2" opacity=".4" stroke-linecap="round"/>`).join('')}
    <line x1="100" y1="74" x2="100" y2="190" stroke="${P.deep}" stroke-width="1.6" opacity=".45"/>`,
  cardigan: (P) => `
    <path d="M62 54 L40 64 L28 138 L48 146 L58 96 L58 186 Q58 192 64 192 L96 192 L96 92 L104 92 L104 192 L136 192 Q142 192 142 186 L142 96 L152 146 L172 138 L160 64 L138 54 L116 64 L100 72 L84 64 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <line x1="100" y1="72" x2="100" y2="192" stroke="${P.deep}" stroke-width="1.6" opacity=".5"/>
    ${[110, 134, 158, 182].map((y) => `<circle cx="96" cy="${y}" r="1.8" fill="${P.line}"/>`).join('')}`,
  trench: (P) => `
    <path d="M58 50 L38 62 L26 118 L48 128 L54 106 L52 214 Q52 218 56 218 L96 218 L96 92 L104 92 L104 218 L144 218 Q148 218 148 214 L146 106 L152 128 L174 118 L162 62 L142 50 L116 66 L100 74 L84 66 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M84 66 L100 76 L100 120 M116 66 L100 76" fill="none" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="66" y="120" width="68" height="6" rx="3" fill="${P.deep}" opacity=".5"/>
    <rect x="118" y="150" width="16" height="3" rx="1.5" fill="${P.deep}" opacity=".45"/>`,
  pants: (P) => `
    <path d="M66 56 L134 56 L138 70 L122 220 Q120 226 114 226 L108 226 Q104 226 104 220 L100 120 L96 220 Q96 226 92 226 L86 226 Q80 226 78 220 L62 70 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <line x1="100" y1="64" x2="100" y2="120" stroke="${P.deep}" stroke-width="1.3" opacity=".45"/>
    <rect x="64" y="56" width="72" height="9" rx="3" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>`,
  trousers: (P) => `
    <path d="M64 56 L136 56 L140 72 L126 222 Q125 226 121 226 L110 226 Q106 226 106 222 L100 118 L94 222 Q94 226 90 226 L79 226 Q75 226 74 222 L60 72 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <line x1="84" y1="72" x2="92" y2="220" stroke="${P.lighter}" stroke-width="1.3" opacity=".5"/>
    <line x1="116" y1="72" x2="108" y2="220" stroke="${P.lighter}" stroke-width="1.3" opacity=".5"/>
    <rect x="62" y="56" width="76" height="8" rx="3" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>`,
  jeans: (P) => `
    <path d="M66 56 L134 56 L138 70 L124 220 Q122 226 116 226 L108 226 Q104 226 104 220 L100 122 L96 220 Q96 226 90 226 L84 226 Q78 226 76 220 L62 70 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="64" y="56" width="72" height="10" rx="3" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    <path d="M72 74 Q84 80 88 96" fill="none" stroke="${P.lighter}" stroke-width="1.3" opacity=".55"/>
    <path d="M128 74 Q116 80 112 96" fill="none" stroke="${P.lighter}" stroke-width="1.3" opacity=".55"/>
    <line x1="100" y1="66" x2="100" y2="120" stroke="${P.deep}" stroke-width="1.2" opacity=".4" stroke-dasharray="2 3"/>`,
  joggers: (P) => `
    <path d="M68 56 L132 56 L136 72 L126 200 Q132 214 116 220 L110 222 Q104 222 104 214 L100 130 L96 214 Q96 222 90 222 L84 220 Q68 214 74 200 L64 72 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="66" y="56" width="68" height="9" rx="4" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    <path d="M76 200 Q82 210 90 212 M124 200 Q118 210 110 212" fill="none" stroke="${P.deep}" stroke-width="2" opacity=".4"/>`,
  leggings: (P) => `
    <path d="M70 56 L130 56 L134 72 L120 222 Q119 226 115 226 L108 226 Q105 226 105 222 L100 128 L95 222 Q95 226 92 226 L85 226 Q81 226 80 222 L66 72 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="68" y="56" width="64" height="8" rx="3" fill="${P.dark}"/>
    <line x1="100" y1="64" x2="100" y2="126" stroke="${P.lighter}" stroke-width="1" opacity=".4"/>`,
  shorts: (P) => `
    <path d="M64 64 L136 64 L140 78 L130 150 Q128 156 122 156 L108 156 Q104 156 104 150 L100 110 L96 150 Q96 156 92 156 L78 156 Q72 156 70 150 L60 78 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="62" y="64" width="76" height="9" rx="3" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    <line x1="100" y1="72" x2="100" y2="110" stroke="${P.deep}" stroke-width="1.2" opacity=".4"/>`,
  skirt: (P) => `
    <path d="M72 64 L128 64 L132 78 L150 196 Q100 214 50 196 L68 78 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="70" y="64" width="60" height="9" rx="3" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    ${[100, 120, 150].map((x) => `<path d="M${x} 80 L${x + (x - 100) * 0.3} 198" stroke="${P.deep}" stroke-width="1" opacity=".3"/>`).join('')}`,
  sneaker: (P) => `
    <path d="M34 150 Q30 124 56 118 Q74 114 96 128 Q126 146 162 150 Q176 152 176 166 L176 182 Q176 190 166 190 L44 190 Q34 190 32 180 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M32 176 L176 176 L176 184 Q176 190 166 190 L44 190 Q34 190 32 182 Z" fill="${P.lighter}" stroke="${P.line}" stroke-width="1"/>
    <path d="M60 124 Q78 122 96 132 M70 132 Q86 132 100 140 M82 140 Q96 142 110 148" stroke="${P.deep}" stroke-width="1.6" fill="none" opacity=".5"/>
    <ellipse cx="150" cy="160" rx="16" ry="9" fill="${P.dark}" opacity=".5"/>`,
  runner: (P) => `
    <path d="M30 150 Q28 122 58 116 Q80 112 104 130 Q134 150 168 152 Q180 154 180 168 L180 180 Q180 188 170 188 L40 188 Q28 188 28 178 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M28 174 Q104 184 180 174 L180 182 Q180 188 170 188 L40 188 Q28 188 28 180 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1"/>
    <path d="M58 122 Q88 124 116 144 Q140 158 168 156" fill="none" stroke="${P.lighter}" stroke-width="3" opacity=".6"/>`,
  boot: (P) => `
    <path d="M70 60 L120 60 L124 150 Q150 152 158 168 L162 182 Q162 190 152 190 L70 190 Q62 190 62 182 L62 70 Q62 60 70 60 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M62 178 L162 178 L162 184 Q162 190 152 190 L70 190 Q62 190 62 182 Z" fill="${P.deep}"/>
    <line x1="124" y1="150" x2="62" y2="150" stroke="${P.deep}" stroke-width="1.3" opacity=".4"/>`,
  heel: (P) => `
    <path d="M40 132 Q70 120 150 150 Q166 156 166 168 Q166 176 150 176 L70 176 Q44 176 40 150 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M150 176 L152 200 Q152 206 146 206 Q140 206 140 200 L142 172 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1.1"/>
    <path d="M46 140 Q72 130 120 146" fill="none" stroke="${P.lighter}" stroke-width="2" opacity=".5"/>`,
  loafer: (P) => `
    <path d="M40 146 Q40 126 70 124 Q120 122 156 146 Q168 154 168 166 Q168 176 156 176 L54 176 Q40 176 40 162 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M40 168 L168 168 L168 170 Q168 176 156 176 L54 176 Q40 176 40 164 Z" fill="${P.deep}"/>
    <rect x="78" y="132" width="30" height="6" rx="3" fill="${P.dark}" opacity=".7"/>`,
  sandal: (P) => `
    <path d="M40 160 Q40 150 52 150 L150 150 Q166 150 166 162 Q166 174 150 174 L52 174 Q40 174 40 164 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M60 150 Q90 120 120 150 M80 150 Q104 128 128 150" fill="none" stroke="${P.dark}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`,
  tote: (P) => `
    <path d="M58 96 L142 96 L150 196 Q150 202 144 202 L56 202 Q50 202 50 196 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M76 96 Q76 58 100 58 Q124 58 124 96" fill="none" stroke="${P.line}" stroke-width="4"/>
    <path d="M58 110 L142 110" stroke="${P.deep}" stroke-width="1" opacity=".3"/>`,
  crossbody: (P) => `
    <path d="M62 110 L138 110 Q146 110 146 118 L146 184 Q146 192 138 192 L62 192 Q54 192 54 184 L54 118 Q54 110 62 110 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M62 110 Q70 78 100 76 Q130 78 138 110" fill="none" stroke="${P.line}" stroke-width="3.5"/>
    <path d="M54 134 L146 134" stroke="${P.deep}" stroke-width="1.2" opacity=".35"/>
    <rect x="92" y="138" width="16" height="10" rx="2" fill="${P.dark}"/>`,
  shoulderbag: (P) => `
    <path d="M56 118 L144 118 Q150 118 150 126 L150 190 Q150 196 144 196 L56 196 Q50 196 50 190 L50 126 Q50 118 56 118 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M70 118 Q70 92 100 92 Q130 92 130 118" fill="none" stroke="${P.line}" stroke-width="5"/>
    <rect x="88" y="116" width="24" height="8" rx="3" fill="${P.dark}"/>`,
  backpack: (P) => `
    <path d="M58 96 Q58 80 76 80 L124 80 Q142 80 142 96 L142 196 Q142 202 136 202 L64 202 Q58 202 58 196 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="74" y="120" width="52" height="50" rx="8" fill="${P.dark}" opacity=".5"/>
    <path d="M86 80 Q80 60 70 58 M114 80 Q120 60 130 58" fill="none" stroke="${P.line}" stroke-width="4"/>`,
  clutch: (P) => `
    <path d="M48 130 L152 130 Q158 130 158 136 L158 176 Q158 182 152 182 L48 182 Q42 182 42 176 L42 136 Q42 130 48 130 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M42 150 L158 150" stroke="${P.deep}" stroke-width="1.3" opacity=".4"/>
    <rect x="92" y="146" width="16" height="9" rx="3" fill="${P.dark}"/>`,
  cap: (P) => `
    <path d="M48 132 Q48 88 100 88 Q152 88 152 132 L152 136 Q100 126 48 136 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M48 134 Q24 138 22 150 Q40 150 52 142 Z" fill="${P.dark}" stroke="${P.line}" stroke-width="1.2"/>
    <circle cx="100" cy="92" r="4" fill="${P.dark}"/>`,
  beanie: (P) => `
    <path d="M52 140 Q52 84 100 84 Q148 84 148 140 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="48" y="138" width="104" height="20" rx="9" fill="${P.dark}" stroke="${P.line}" stroke-width="1.2"/>
    ${[68, 84, 100, 116, 132].map((x) => `<line x1="${x}" y1="98" x2="${x}" y2="138" stroke="${P.deep}" stroke-width="1" opacity=".3"/>`).join('')}`,
  bucket: (P) => `
    <path d="M64 96 Q64 84 100 84 Q136 84 136 96 L136 122 L150 152 Q100 164 50 152 L64 122 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <path d="M50 150 Q100 162 150 150" fill="none" stroke="${P.deep}" stroke-width="1.4" opacity=".4"/>`,
  fedora: (P) => `
    <path d="M62 122 Q62 86 100 86 Q138 86 138 122 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <ellipse cx="100" cy="128" rx="60" ry="14" fill="${P.dark}" stroke="${P.line}" stroke-width="1.2"/>
    <path d="M62 118 Q100 126 138 118" fill="none" stroke="${P.deep}" stroke-width="5" opacity=".5"/>`,
  sunglasses: (P) => `
    <path d="M36 110 Q36 138 64 138 Q92 138 92 112 L92 108 Q100 102 108 108 L108 112 Q108 138 136 138 Q164 138 164 110 Q164 100 150 98 L112 98 Q100 100 88 98 L50 98 Q36 100 36 110 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.6"/>
    <ellipse cx="64" cy="116" rx="20" ry="16" fill="${P.deep}" opacity=".55"/>
    <ellipse cx="136" cy="116" rx="20" ry="16" fill="${P.deep}" opacity=".55"/>`,
  glasses: (P) => `
    <g fill="none" stroke="${P.base}" stroke-width="5">
      <circle cx="66" cy="118" r="24"/>
      <circle cx="134" cy="118" r="24"/>
      <path d="M90 116 Q100 108 110 116"/>
      <path d="M42 110 L26 102 M158 110 L174 102"/>
    </g>`,
  necklace: (P) => `
    <path d="M58 80 Q100 156 142 80" fill="none" stroke="url(#g)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="100" cy="150" r="12" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <circle cx="100" cy="150" r="5" fill="${P.lighter}" opacity=".8"/>`,
  chain: (P) => `
    <path d="M56 78 Q100 168 144 78" fill="none" stroke="url(#g)" stroke-width="8" stroke-linecap="round"/>
    <path d="M56 78 Q100 168 144 78" fill="none" stroke="${P.deep}" stroke-width="2" stroke-dasharray="3 5" opacity=".5"/>`,
  watch: (P) => `
    <rect x="84" y="74" width="32" height="40" rx="8" fill="${P.dark}" stroke="${P.line}" stroke-width="1.4"/>
    <circle cx="100" cy="120" r="34" fill="url(#g)" stroke="${P.line}" stroke-width="2"/>
    <circle cx="100" cy="120" r="24" fill="${P.lighter}"/>
    <line x1="100" y1="120" x2="100" y2="104" stroke="${P.deep}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="100" y1="120" x2="113" y2="120" stroke="${P.deep}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="84" y="126" width="32" height="40" rx="8" fill="${P.dark}" stroke="${P.line}" stroke-width="1.4"/>`,
  hoops: (P) => `
    <circle cx="72" cy="120" r="26" fill="none" stroke="url(#g)" stroke-width="7"/>
    <circle cx="128" cy="120" r="26" fill="none" stroke="url(#g)" stroke-width="7"/>
    <circle cx="72" cy="94" r="3" fill="${P.dark}"/>
    <circle cx="128" cy="94" r="3" fill="${P.dark}"/>`,
  ring: (P) => `
    <circle cx="100" cy="128" r="34" fill="none" stroke="url(#g)" stroke-width="9"/>
    <path d="M82 102 L100 84 L118 102 Z" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <circle cx="100" cy="92" r="6" fill="${P.lighter}" opacity=".9"/>`,
  belt: (P) => `
    <rect x="34" y="108" width="132" height="24" rx="8" fill="url(#g)" stroke="${P.line}" stroke-width="1.4"/>
    <rect x="86" y="100" width="40" height="40" rx="8" fill="${P.dark}" stroke="${P.line}" stroke-width="1.6"/>
    <rect x="98" y="112" width="16" height="16" rx="3" fill="none" stroke="${P.lighter}" stroke-width="2.4"/>`,
};

/* category fallback shape */
const CATEGORY_FALLBACK: Record<Category, GarmentShape> = {
  hat: 'cap',
  outer: 'jacket',
  top: 'tee',
  bottom: 'pants',
  shoes: 'sneaker',
  bag: 'tote',
  eyewear: 'sunglasses',
  jewelry: 'necklace',
};

export function defaultShapeForCategory(category: Category): GarmentShape {
  return CATEGORY_FALLBACK[category] || 'tee';
}

/* ---------- wrapper ---------- */

function wrapSvg(inner: string, P: Palette, opts: { shadow: boolean; pad: number }): string {
  const shadow = opts.shadow
    ? `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
         <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#16140f" flood-opacity="0.26"/>
       </filter>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="${P.lighter}"/>
        <stop offset="42%" stop-color="${P.base}"/>
        <stop offset="100%" stop-color="${P.dark}"/>
      </linearGradient>
      ${shadow}
    </defs>
    <g ${opts.shadow ? 'filter="url(#sh)"' : ''} transform="translate(0,${opts.pad})">${inner}</g>
  </svg>`.replace(/\s+/g, ' ').trim();
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface GarmentArtOptions {
  color?: string;
  shadow?: boolean;
}

/** Raw SVG string for a garment shape. */
export function garmentSvg(shape: GarmentShape, options: GarmentArtOptions = {}): string {
  const color = options.color || '#8a8a86';
  const P = palette(color);
  const draw = SHAPES[shape] || SHAPES.tee;
  return wrapSvg(draw(P), P, { shadow: options.shadow ?? true, pad: 0 });
}

/** Data URL for a garment shape — use as <img src>. */
export function garmentArt(shape: GarmentShape, color = '#8a8a86', shadow = true): string {
  return toDataUrl(garmentSvg(shape, { color, shadow }));
}

/** Convenience: build art from a closet-item-like object. */
export function itemArt(item: { shape?: GarmentShape; category: Category; color?: string }, shadow = true): string {
  const shape = item.shape || defaultShapeForCategory(item.category);
  return garmentArt(shape, item.color || '#8a8a86', shadow);
}
