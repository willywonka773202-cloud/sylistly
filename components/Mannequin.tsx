'use client';

import type { CSSProperties } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

const FRAME_COPY: Record<
  GeneratorFrame,
  {
    label: string;
    shoulderWidth: string;
    torsoWidth: string;
    hipWidth: string;
    legLeft: string;
    legRight: string;
  }
> = {
  masc: {
    label: 'Menswear frame',
    shoulderWidth: 'w-[142px]',
    torsoWidth: 'w-[92px]',
    hipWidth: 'w-[94px]',
    legLeft: 'left-[70px]',
    legRight: 'right-[70px]',
  },
  fem: {
    label: 'Womenswear frame',
    shoulderWidth: 'w-[118px]',
    torsoWidth: 'w-[76px]',
    hipWidth: 'w-[88px]',
    legLeft: 'left-[76px]',
    legRight: 'right-[76px]',
  },
  androgynous: {
    label: 'Neutral frame',
    shoulderWidth: 'w-[128px]',
    torsoWidth: 'w-[84px]',
    hipWidth: 'w-[92px]',
    legLeft: 'left-[73px]',
    legRight: 'right-[73px]',
  },
};

const BODY_MARKERS: Array<{ category: Category; label: string; className: string }> = [
  { category: 'hat', label: 'Hat', className: 'left-1/2 top-[22px] -translate-x-1/2' },
  { category: 'outer', label: 'Outer', className: 'left-6 top-[158px]' },
  { category: 'top', label: 'Top', className: 'right-6 top-[178px]' },
  { category: 'bottom', label: 'Bottom', className: 'left-7 top-[295px]' },
  { category: 'shoes', label: 'Shoes', className: 'right-8 bottom-[50px]' },
];

const ACCESSORY_CATEGORIES: Array<{ category: Category; label: string }> = [
  { category: 'bag', label: 'Bag' },
  { category: 'eyewear', label: 'Eyewear' },
  { category: 'jewelry', label: 'Jewelry' },
];

const COLOR_SWATCHES: Record<string, string> = {
  black: '#191817',
  white: '#f2eee8',
  cream: '#d8cbb6',
  beige: '#b89d7a',
  tan: '#a57f5f',
  brown: '#6f4d3a',
  grey: '#6e7177',
  gray: '#6e7177',
  silver: '#878e99',
  gold: '#b49345',
  navy: '#283750',
  blue: '#3b5d88',
  red: '#7b2d35',
  pink: '#b76a7d',
  green: '#55634d',
  olive: '#58604f',
};

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const mannequinStyle = skinTone ? ({ '--skin': skinTone } as CSSProperties) : undefined;
  const frame = FRAME_COPY[bodyType];
  const filled = Object.values(items).filter(Boolean).length;
  const heroItem = items.outer || items.top || items.bottom || items.shoes || null;

  return (
    <div
      className="relative h-[430px] w-full overflow-hidden rounded-[30px] border border-hairline bg-black"
      style={mannequinStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,.14),transparent_24%),radial-gradient(circle_at_50%_54%,rgba(232,54,93,.18),transparent_44%),linear-gradient(180deg,#171612,#090908_70%,#040404)]" />
      <div className="absolute inset-0 opacity-[.14] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="absolute left-1/2 top-16 h-[314px] w-[242px] -translate-x-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-24 h-[292px] w-[188px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="absolute left-4 top-4 z-30 max-w-[150px] rounded-2xl border border-hairline bg-black/55 p-3 shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-[.16em] text-muted">Fit profile</div>
        <div className="mt-1 font-serif text-[17px] font-semibold text-ink">{frame.label}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-2">
          {heroItem ? `${heroItem.brand} anchors this preview.` : 'Add a piece to start building the look.'}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-30 rounded-2xl border border-hairline bg-black/55 px-3 py-2 text-right shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="font-serif text-[22px] font-semibold leading-none text-ink">{filled}/8</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-muted">slots</div>
      </div>

      <div className="absolute left-1/2 top-[52px] z-10 h-[334px] w-[216px] -translate-x-1/2">
        <div className="absolute left-1/2 top-[290px] h-10 w-[172px] -translate-x-1/2 rounded-full bg-black/60 blur-md" />
        <div className="absolute left-1/2 top-[302px] h-5 w-[128px] -translate-x-1/2 rounded-full border border-white/10 bg-white/10" />

        <div className="absolute left-1/2 top-0 z-20 h-[58px] w-[54px] -translate-x-1/2 rounded-[24px_24px_18px_18px] skin shadow-[inset_-4px_-5px_12px_rgba(0,0,0,.22),0_14px_24px_rgba(0,0,0,.28)]" />
        <div className="absolute left-1/2 top-[53px] z-10 h-[18px] w-[18px] -translate-x-1/2 rounded skin" />
        <div className={`absolute left-1/2 top-[72px] z-10 h-[28px] -translate-x-1/2 rounded-[999px] skin ${frame.shoulderWidth}`} />
        <div className={`absolute left-1/2 top-[90px] z-10 h-[102px] -translate-x-1/2 rounded-[26px_26px_18px_18px] skin shadow-[inset_-5px_-6px_14px_rgba(0,0,0,.2)] ${frame.torsoWidth}`} />
        <div className="absolute left-[41px] top-[90px] z-10 h-[120px] w-[24px] rotate-[7deg] rounded-[14px] skin" />
        <div className="absolute right-[41px] top-[90px] z-10 h-[120px] w-[24px] -rotate-[7deg] rounded-[14px] skin" />
        <div className="absolute left-[37px] top-[202px] z-20 h-[20px] w-[20px] rounded-full skin" />
        <div className="absolute right-[37px] top-[202px] z-20 h-[20px] w-[20px] rounded-full skin" />
        <div className={`absolute left-1/2 top-[184px] z-10 h-[44px] -translate-x-1/2 rounded-[18px_18px_28px_28px] skin ${frame.hipWidth}`} />
        <div className={`absolute top-[220px] z-10 h-[112px] w-[32px] rounded-[13px_13px_18px_18px] skin ${frame.legLeft}`} />
        <div className={`absolute top-[220px] z-10 h-[112px] w-[32px] rounded-[13px_13px_18px_18px] skin ${frame.legRight}`} />
        <div className="absolute left-[56px] top-[320px] z-20 h-[17px] w-[56px] rounded-[10px_6px_14px_14px] skin" />
        <div className="absolute right-[56px] top-[320px] z-20 h-[17px] w-[56px] rounded-[6px_10px_14px_14px] skin" />

        <GarmentShape product={items.hat} category="hat" className="left-1/2 top-[8px] z-40 h-[34px] w-[92px] -translate-x-1/2" />
        <GarmentShape product={items.top} category="top" className="left-1/2 top-[74px] z-30 h-[132px] w-[142px] -translate-x-1/2" />
        <GarmentShape product={items.outer} category="outer" className="left-1/2 top-[70px] z-40 h-[150px] w-[168px] -translate-x-1/2" />
        <GarmentShape product={items.bottom} category="bottom" className="left-1/2 top-[186px] z-30 h-[152px] w-[112px] -translate-x-1/2" />
        <GarmentShape product={items.shoes} category="shoes" className="left-1/2 top-[308px] z-40 h-[40px] w-[130px] -translate-x-1/2" />

        <div className="pointer-events-none absolute left-1/2 top-[332px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[9px] uppercase tracking-[.18em] text-white/60 backdrop-blur">
          Studio fit preview
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-3">
        <div className="flex max-w-[170px] gap-2">
          {ACCESSORY_CATEGORIES.map((entry) => (
            <AccessoryTile key={entry.category} label={entry.label} product={items[entry.category]} />
          ))}
        </div>
        <SelectedLookStrip items={items} />
      </div>

      {BODY_MARKERS.map((marker) => {
        const hasItem = Boolean(items[marker.category]);
        return (
          <div
            key={marker.category}
            className={`absolute z-30 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.12em] backdrop-blur-md ${marker.className} ${
              hasItem
                ? 'border-accent/70 bg-accent/20 text-ink shadow-pink-glow'
                : 'border-hairline bg-black/35 text-muted-2'
            }`}
          >
            {marker.label}
          </div>
        );
      })}
    </div>
  );
}

function GarmentShape({
  product,
  category,
  className,
}: {
  product?: Product;
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes';
  className: string;
}) {
  if (!product) return <ShapePlaceholder category={category} className={className} />;

  const accent = pickAccentColor(product, category);
  const shapeClass = SHAPE_CLASSES[category];
  const variant = detectGarmentVariant(product, category);
  const label = category === 'outer' ? 'Layer' : category;

  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <div
        className={`relative h-full w-full overflow-hidden border border-white/12 shadow-[0_18px_42px_rgba(0,0,0,.38)] ${shapeClass}`}
        style={{ background: `linear-gradient(180deg, ${withAlpha(accent, 0.94)} 0%, ${withAlpha(accent, 0.72)} 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.12),transparent_44%),linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.22))]" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${withAlpha('#ffffff', 0.06)} 50%, transparent 100%)`,
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,.2), rgba(0,0,0,1))',
          }}
        />
        {renderGarmentDetails(category, variant, accent)}
        <div className="absolute inset-x-[14%] bottom-[8%] rounded-full border border-white/12 bg-black/28 px-2 py-1 text-center text-[8px] uppercase tracking-[.18em] text-white/70 backdrop-blur-sm">
          {label}
        </div>
      </div>
    </div>
  );
}

function ShapePlaceholder({
  category,
  className,
}: {
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes';
  className: string;
}) {
  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <div
        className={`relative h-full w-full overflow-hidden border border-dashed border-white/12 bg-black/12 shadow-[0_10px_24px_rgba(0,0,0,.2)] ${SHAPE_CLASSES[category]}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,.08),transparent_38%)]" />
        <div className="absolute inset-0 grid place-items-center text-[9px] uppercase tracking-[.18em] text-white/26">
          {category}
        </div>
      </div>
    </div>
  );
}

function AccessoryTile({ label, product }: { label: string; product?: Product }) {
  const accent = product ? pickAccentColor(product, 'bag') : '#252321';

  return (
    <div
      className={`h-[58px] w-[50px] overflow-hidden rounded-2xl border ${
        product ? 'border-white/12 shadow-pink-glow' : 'border-dashed border-white/14 bg-black/25'
      }`}
      style={product ? { background: `linear-gradient(180deg, ${withAlpha(accent, 0.84)} 0%, rgba(0,0,0,.78) 100%)` } : undefined}
      title={product ? `${product.brand} ${product.name}` : label}
    >
      {product ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImageUrl(product.imageUrl)}
            alt=""
            className="h-[40px] w-full object-cover p-1.5 opacity-70 saturate-0 mix-blend-luminosity"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = overlayFallback(product.brand);
            }}
          />
          <div className="truncate px-1 text-center text-[7px] uppercase tracking-[.1em] text-white/65">{label}</div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[7px] uppercase tracking-[.12em] text-white/30">
          {label}
        </div>
      )}
    </div>
  );
}

function SelectedLookStrip({
  items,
}: {
  items: Partial<Record<Category, Product>>;
}) {
  const displayProducts = [items.top, items.outer, items.bottom, items.shoes].filter(
    (product): product is Product => Boolean(product),
  ).slice(0, 4);

  if (!displayProducts.length) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-black/45 px-2 py-2 backdrop-blur-md">
      <div className="mb-1 text-[8px] uppercase tracking-[.18em] text-white/42">Placed</div>
      <div className="flex gap-1.5">
        {displayProducts.map((product) => (
          <div key={product.id} className="h-[44px] w-[36px] overflow-hidden rounded-xl border border-white/10 bg-black/35">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImageUrl(product.imageUrl)}
              alt=""
              className="h-full w-full object-cover opacity-70 saturate-0 mix-blend-luminosity"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.src = overlayFallback(product.brand);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function detectGarmentVariant(
  product: Product,
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes',
): string {
  const text = [
    product.brand,
    product.name,
    ...(Array.isArray(product.metadata?.styles) ? (product.metadata.styles as string[]) : []),
    ...(Array.isArray(product.metadata?.keywords) ? (product.metadata.keywords as string[]) : []),
  ]
    .join(' ')
    .toLowerCase();

  if (category === 'hat') {
    if (text.includes('beanie')) return 'beanie';
    if (text.includes('bucket')) return 'bucket';
    return 'cap';
  }

  if (category === 'top') {
    if (text.includes('hoodie')) return 'hoodie';
    if (text.includes('bodysuit') || text.includes('square neck')) return 'bodysuit';
    if (text.includes('oxford') || text.includes('button') || text.includes('shirt')) return 'shirt';
    if (text.includes('tank') || text.includes('rib')) return 'tank';
    return 'tee';
  }

  if (category === 'outer') {
    if (text.includes('puffer') || text.includes('nuptse')) return 'puffer';
    if (text.includes('trench') || text.includes('coat')) return 'trench';
    if (text.includes('blazer')) return 'blazer';
    if (text.includes('bomber')) return 'bomber';
    return 'jacket';
  }

  if (category === 'bottom') {
    if (text.includes('skirt')) return 'skirt';
    if (text.includes('short')) return 'shorts';
    if (text.includes('legging') || text.includes('align')) return 'leggings';
    return 'pants';
  }

  if (text.includes('heel') || text.includes('pump') || text.includes('slingback')) return 'heels';
  if (text.includes('boot') || text.includes('ugg') || text.includes('martens')) return 'boots';
  if (text.includes('clog') || text.includes('birkenstock') || text.includes('boston')) return 'clogs';
  return 'sneakers';
}

function renderGarmentDetails(
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes',
  variant: string,
  accent: string,
) {
  const line = withAlpha('#ffffff', 0.12);
  const shade = withAlpha('#000000', 0.14);

  if (category === 'hat') {
    if (variant === 'beanie') {
      return <div className="absolute inset-x-[18%] top-[58%] h-[10%] rounded-full bg-black/18" />;
    }
    if (variant === 'bucket') {
      return <div className="absolute inset-x-[8%] top-[54%] h-[12%] rounded-full bg-black/18" />;
    }
    return <div className="absolute left-[18%] right-[10%] top-[48%] h-[12%] rounded-full bg-black/18 [clip-path:polygon(0_0,100%_0,78%_100%,20%_100%)]" />;
  }

  if (category === 'top') {
    if (variant === 'tank') {
      return (
        <>
          <div className="absolute left-[28%] top-[8%] h-[22%] w-[8%] rounded-full bg-black/14" />
          <div className="absolute right-[28%] top-[8%] h-[22%] w-[8%] rounded-full bg-black/14" />
          <div className="absolute left-1/2 top-[16%] h-[16%] w-[20%] -translate-x-1/2 rounded-b-full border-x border-b" style={{ borderColor: line }} />
        </>
      );
    }
    if (variant === 'shirt') {
      return (
        <>
          <div className="absolute left-[36%] top-[6%] h-[20%] w-[12%] rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,100%_100%,38%_100%)]" />
          <div className="absolute right-[36%] top-[6%] h-[20%] w-[12%] -rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,62%_100%,0_100%)]" />
          <div className="absolute left-1/2 top-[22%] h-[56%] w-px -translate-x-1/2" style={{ backgroundColor: line }} />
        </>
      );
    }
    if (variant === 'hoodie') {
      return (
        <>
          <div className="absolute left-1/2 top-[6%] h-[22%] w-[28%] -translate-x-1/2 rounded-[999px_999px_18px_18px] border" style={{ borderColor: line, backgroundColor: withAlpha(accent, 0.38) }} />
          <div className="absolute left-1/2 top-[56%] h-[14%] w-[20%] -translate-x-1/2 rounded-[8px]" style={{ backgroundColor: shade, border: `1px solid ${line}` }} />
        </>
      );
    }
    if (variant === 'bodysuit') {
      return (
        <>
          <div className="absolute left-1/2 top-[14%] h-[16%] w-[20%] -translate-x-1/2 rounded-b-full border-x border-b" style={{ borderColor: line }} />
          <div className="absolute left-1/2 bottom-[4%] h-[18%] w-[18%] -translate-x-1/2 [clip-path:polygon(0_0,100%_0,62%_100%,38%_100%)]" style={{ backgroundColor: shade }} />
        </>
      );
    }
    return (
      <>
        <div className="absolute left-1/2 top-[14%] h-[14%] w-[20%] -translate-x-1/2 rounded-b-full border-x border-b" style={{ borderColor: line }} />
        <div className="absolute left-[14%] top-[22%] h-[18%] w-[18%] rounded-full border-t" style={{ borderColor: line }} />
        <div className="absolute right-[14%] top-[22%] h-[18%] w-[18%] rounded-full border-t" style={{ borderColor: line }} />
      </>
    );
  }

  if (category === 'outer') {
    if (variant === 'puffer') {
      return (
        <>
          {['24%', '40%', '56%', '72%'].map((top) => (
            <div key={top} className="absolute left-[10%] right-[10%] h-px" style={{ top, backgroundColor: line }} />
          ))}
        </>
      );
    }
    if (variant === 'trench') {
      return (
        <>
          <div className="absolute left-[34%] top-[10%] h-[24%] w-[12%] rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,100%_100%,38%_100%)]" />
          <div className="absolute right-[34%] top-[10%] h-[24%] w-[12%] -rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,62%_100%,0_100%)]" />
          <div className="absolute left-[28%] right-[28%] top-[48%] h-[6%] rounded-full" style={{ backgroundColor: shade }} />
        </>
      );
    }
    if (variant === 'blazer') {
      return (
        <>
          <div className="absolute left-[34%] top-[10%] h-[20%] w-[12%] rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,100%_100%,38%_100%)]" />
          <div className="absolute right-[34%] top-[10%] h-[20%] w-[12%] -rotate-[14deg] bg-black/16 [clip-path:polygon(0_0,100%_0,62%_100%,0_100%)]" />
          <div className="absolute left-1/2 top-[28%] h-[48%] w-px -translate-x-1/2" style={{ backgroundColor: line }} />
        </>
      );
    }
    if (variant === 'bomber') {
      return <div className="absolute left-[22%] right-[22%] bottom-[18%] h-[7%] rounded-full" style={{ backgroundColor: shade }} />;
    }
    return <div className="absolute left-1/2 top-[10%] h-[18%] w-[18%] -translate-x-1/2 rounded-b-full border-x border-b" style={{ borderColor: line }} />;
  }

  if (category === 'bottom') {
    if (variant === 'skirt') {
      return <div className="absolute left-[12%] right-[12%] top-[18%] h-px" style={{ backgroundColor: line }} />;
    }
    if (variant === 'shorts') {
      return (
        <>
          <div className="absolute left-1/2 top-[22%] bottom-[48%] w-px -translate-x-1/2" style={{ backgroundColor: line }} />
          <div className="absolute left-[18%] right-[18%] top-[16%] h-px" style={{ backgroundColor: line }} />
        </>
      );
    }
    return (
      <>
        <div className="absolute left-1/2 top-[10%] bottom-[12%] w-px -translate-x-1/2" style={{ backgroundColor: line }} />
        <div className="absolute left-[18%] top-[12%] bottom-[14%] w-px" style={{ backgroundColor: withAlpha('#ffffff', 0.06) }} />
        <div className="absolute right-[18%] top-[12%] bottom-[14%] w-px" style={{ backgroundColor: withAlpha('#ffffff', 0.06) }} />
      </>
    );
  }

  if (variant === 'heels') {
    return (
      <>
        <div className="absolute left-[34%] top-[66%] h-[16%] w-[2px]" style={{ backgroundColor: shade }} />
        <div className="absolute right-[34%] top-[66%] h-[16%] w-[2px]" style={{ backgroundColor: shade }} />
      </>
    );
  }

  if (variant === 'boots') {
    return (
      <>
        <div className="absolute left-[14%] top-[8%] bottom-[10%] w-px" style={{ backgroundColor: line }} />
        <div className="absolute right-[14%] top-[8%] bottom-[10%] w-px" style={{ backgroundColor: line }} />
      </>
    );
  }

  if (variant === 'clogs') {
    return (
      <>
        <div className="absolute left-[12%] top-[38%] h-px w-[28%]" style={{ backgroundColor: line }} />
        <div className="absolute right-[12%] top-[38%] h-px w-[28%]" style={{ backgroundColor: line }} />
      </>
    );
  }

  return (
    <>
      <div className="absolute left-[12%] top-[46%] h-px w-[30%]" style={{ backgroundColor: line }} />
      <div className="absolute right-[12%] top-[46%] h-px w-[30%]" style={{ backgroundColor: line }} />
    </>
  );
}

const SHAPE_CLASSES: Record<'hat' | 'top' | 'outer' | 'bottom' | 'shoes', string> = {
  hat: 'rounded-[52%_52%_32%_32%/70%_70%_30%_30%] [clip-path:polygon(8%_52%,18%_18%,82%_18%,92%_52%,84%_70%,16%_70%)]',
  top: 'rounded-[24px_24px_28px_28px] [clip-path:polygon(20%_12%,34%_4%,66%_4%,80%_12%,92%_26%,78%_36%,72%_95%,28%_95%,22%_36%,8%_26%)]',
  outer: 'rounded-[30px_30px_24px_24px] [clip-path:polygon(15%_8%,34%_2%,66%_2%,85%_8%,96%_24%,84%_36%,79%_100%,21%_100%,16%_36%,4%_24%)]',
  bottom: 'rounded-[18px_18px_28px_28px] [clip-path:polygon(18%_0,82%_0,74%_14%,72%_100%,54%_100%,50%_28%,46%_100%,28%_100%,26%_14%)]',
  shoes: '[clip-path:polygon(6%_62%,18%_34%,42%_34%,48%_60%,48%_82%,6%_82%,52%_62%,64%_34%,88%_34%,94%_60%,94%_82%,52%_82%)]',
};

function pickAccentColor(product: Product, fallbackCategory: Category): string {
  const metadataColors = Array.isArray(product.metadata?.colors)
    ? (product.metadata?.colors as string[])
    : [];

  for (const color of metadataColors) {
    const normalized = String(color).toLowerCase();
    if (COLOR_SWATCHES[normalized]) return COLOR_SWATCHES[normalized];
  }

  const brand = product.brand.toLowerCase();
  if (brand.includes('nike') || brand.includes('jordan')) return '#6f5140';
  if (brand.includes('zara') || brand.includes('aritzia')) return '#7c6a5a';
  if (brand.includes('stussy') || brand.includes('carhartt')) return '#54463a';
  if (brand.includes('prada') || brand.includes('saint laurent')) return '#1b1b1d';
  if (brand.includes('lululemon') || brand.includes('alo')) return '#8d6c68';

  const categoryFallback: Record<Category, string> = {
    hat: '#2a2a2e',
    outer: '#3b352f',
    top: '#4a433d',
    bottom: '#34363d',
    shoes: '#2f2b2b',
    bag: '#4b3f35',
    eyewear: '#2a292c',
    jewelry: '#7a6940',
  };

  return categoryFallback[fallbackCategory];
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const value = Math.max(0, Math.min(255, Math.round(alpha * 255))).toString(16).padStart(2, '0');
  return `#${normalized}${value}`;
}

function overlayFallback(label: string): string {
  const safeLabel = label.slice(0, 10).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#050505" />
      <rect x="14" y="14" width="152" height="192" rx="18" fill="#e8365d" opacity="0.14" />
      <circle cx="90" cy="82" r="34" fill="#fffefb" opacity="0.9" />
      <rect x="46" y="132" width="88" height="12" rx="6" fill="#fffefb" opacity="0.78" />
      <text x="90" y="170" text-anchor="middle" fill="#fffefb" font-family="Arial, sans-serif" font-size="16" font-weight="700">${safeLabel}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
