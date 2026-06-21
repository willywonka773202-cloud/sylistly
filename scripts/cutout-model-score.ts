// Body-MODEL likelihood score for a cutout image — a person wearing the clothes
// (skin/limbs/head) vs a clean flat-lay garment. Used by the catalog dedup to
// pick the CLEANEST variant when the same product was scraped many times.
//
// Heuristic (raw-pixel, no API): a model photo has skin in a MID range (not a
// uniformly-warm garment) alongside a dark garment mass, or skin concentrated
// up top (a head/shoulders). Returns 0 for clean garment cutouts. Tan/cream
// GARMENTS read as ~uniform skin and correctly score ~0 (they're not mid-range).
import sharp from 'sharp';
import { existsSync } from 'node:fs';

export interface CutoutModelMetrics {
  skinPct: number;
  darkPct: number;
  topSkinPct: number;
  modelScore: number;
}

function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 60) return false; // too dark
  if (max - min < 12) return false; // greyscale (white/grey/black garments)
  if (!(r > g && g >= b)) return false; // skin is warm: R>G>=B
  if (r - b < 12) return false;
  if (b > r * 0.86) return false; // cut cool-creeping beige
  let h: number;
  const d = max - min;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  if (h > 50) return false; // skin hue band
  const sat = (max - min) / max;
  return sat >= 0.12 && sat <= 0.75;
}

/** Score one cutout PNG. Returns all-zero metrics if the file is unreadable. */
export async function cutoutModelMetrics(absPath: string): Promise<CutoutModelMetrics> {
  const zero = { skinPct: 0, darkPct: 0, topSkinPct: 0, modelScore: 0 };
  if (!absPath || !existsSync(absPath)) return zero;
  try {
    const { data, info } = await sharp(absPath)
      .resize(72, 72, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    const W = info.width;
    const topRows = Math.floor(info.height * 0.28);
    let nonTransparent = 0;
    let skin = 0;
    let dark = 0;
    let topSkin = 0;
    for (let i = 0; i < data.length; i += ch) {
      const a = ch === 4 ? data[i + 3] : 255;
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      nonTransparent++;
      if (Math.max(r, g, b) < 55) dark++;
      if (isSkin(r, g, b)) {
        skin++;
        const py = Math.floor(i / ch / W);
        if (py < topRows) topSkin++;
      }
    }
    if (!nonTransparent) return zero;
    const skinPct = (skin / nonTransparent) * 100;
    const darkPct = (dark / nonTransparent) * 100;
    const topSkinPct = (topSkin / nonTransparent) * 100;
    const midSkin = skinPct >= 5 && skinPct <= 48;
    let modelScore = 0;
    if (midSkin && darkPct >= 14) modelScore += darkPct + skinPct;
    if (midSkin && topSkinPct >= 4) modelScore += topSkinPct * 3;
    return { skinPct, darkPct, topSkinPct, modelScore };
  } catch {
    return zero;
  }
}

export async function cutoutModelScore(absPath: string): Promise<number> {
  return (await cutoutModelMetrics(absPath)).modelScore;
}
