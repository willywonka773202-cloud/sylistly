'use client';

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { Footprints, Glasses, PackageSearch, Shirt, ShoppingBag, Sparkles, Watch } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';
import { hasUsableProductImage, isRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

type ProductImageMode = 'contain' | 'cover';
type ProductImageSize = 'sm' | 'md' | 'lg' | 'hero';

const failedImageKeys = new Set<string>();

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Layer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

const CATEGORY_ICONS: Record<Category, ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  hat: PackageSearch,
  outer: Shirt,
  top: Shirt,
  bottom: PackageSearch,
  shoes: Footprints,
  bag: ShoppingBag,
  eyewear: Glasses,
  jewelry: Watch,
};

const CATEGORY_BACKGROUNDS: Record<Category, string> = {
  hat: 'from-[#edf7ee] via-[#fffaf2] to-[#eadfd5]',
  outer: 'from-[#ece7df] via-[#fff8ef] to-[#d9d0c7]',
  top: 'from-[#fff2f5] via-[#fffaf4] to-[#eadfd5]',
  bottom: 'from-[#edf4fb] via-[#fffaf4] to-[#d9d0c7]',
  shoes: 'from-[#f3f0eb] via-[#fffaf4] to-[#d4ccc3]',
  bag: 'from-[#fff2df] via-[#fffaf4] to-[#ead4ba]',
  eyewear: 'from-[#f2f2f2] via-[#fffaf4] to-[#dad4ce]',
  jewelry: 'from-[#f8efff] via-[#fff7f3] to-[#ead7ee]',
};

const SIZE_CLASSES: Record<ProductImageSize, string> = {
  sm: 'text-[8px]',
  md: 'text-[9px]',
  lg: 'text-[10px]',
  hero: 'text-[12px]',
};

const ICON_WRAP_CLASSES: Record<ProductImageSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  hero: 'h-16 w-16',
};

const ICON_SIZES: Record<ProductImageSize, number> = {
  sm: 16,
  md: 18,
  lg: 23,
  hero: 31,
};

function imageFailureKey(product?: Product, imageUrl?: string, cutout?: boolean): string {
  return `${product?.id || 'image'}::${imageUrl || product?.imageUrl || ''}::${cutout ? 'cutout' : 'plain'}`;
}

function normalizeCategory(value?: Category | string): Category {
  if (
    value === 'hat'
    || value === 'outer'
    || value === 'top'
    || value === 'bottom'
    || value === 'shoes'
    || value === 'bag'
    || value === 'eyewear'
    || value === 'jewelry'
  ) {
    return value;
  }
  return 'top';
}

function getDisplayName(product?: Product, name?: string): string {
  return product?.name || name || 'Catalog item';
}

export function getCleanProductImageUrl(product: Product, cutout = false): string {
  if (!hasUsableProductImage(product)) return '';
  return cutout
    ? proxiedImageUrl(product.imageUrl, { cutout: true, category: product.category })
    : proxiedImageUrl(product.imageUrl);
}

export function ProductFallbackTile({
  product,
  category,
  name,
  brand,
  className,
  size = 'md',
}: {
  product?: Product;
  category?: Category | string;
  name?: string;
  brand?: string;
  className?: string;
  size?: ProductImageSize;
}) {
  const normalizedCategory = normalizeCategory(category || product?.category);
  const Icon = CATEGORY_ICONS[normalizedCategory] || Sparkles;
  const label = CATEGORY_LABELS[normalizedCategory] || 'Piece';
  const displayBrand = product?.brand || brand || 'Sylistly Pick';

  return (
    <div
      className={`relative grid h-full w-full place-items-center overflow-hidden bg-[#fdfaf8] ${className || ''}`}
      aria-label={`${displayBrand} ${getDisplayName(product, name)} image unavailable`}
    >
      <div className="flex flex-col items-center gap-1.5 opacity-20 grayscale">
        <Icon size={ICON_SIZES[size] * 0.8} strokeWidth={1.5} />
        <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}

export function SafeProductImage({
  product,
  imageUrl,
  category,
  name,
  brand,
  className,
  wrapperClassName,
  loading = 'lazy',
  mode = 'contain',
  size = 'md',
  cutout = false,
  onAvailable,
  onUnavailable,
}: {
  product?: Product;
  imageUrl?: string;
  category?: Category | string;
  name?: string;
  brand?: string;
  className?: string;
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  mode?: ProductImageMode;
  size?: ProductImageSize;
  cutout?: boolean;
  onAvailable?: (product: Product) => void;
  onUnavailable?: (product: Product) => void;
}) {
  const normalizedCategory = normalizeCategory(category || product?.category);
  const rawImageUrl = imageUrl || product?.imageUrl || '';
  const renderable = isRenderableProduct(product);
  const failureKey = useMemo(
    () => imageFailureKey(product, rawImageUrl, cutout),
    [product?.id, rawImageUrl, cutout],
  );
  const [imageOk, setImageOk] = useState(() => Boolean(rawImageUrl) && renderable && !failedImageKeys.has(failureKey));

  const src = imageOk && rawImageUrl
    ? (cutout && product
        ? proxiedImageUrl(rawImageUrl, { cutout: true, category: normalizedCategory })
        : proxiedImageUrl(rawImageUrl))
    : '';

  useEffect(() => {
    const nextKey = imageFailureKey(product, rawImageUrl, cutout);
    setImageOk(Boolean(rawImageUrl) && isRenderableProduct(product) && !failedImageKeys.has(nextKey));
  }, [product?.id, rawImageUrl, cutout, product]);

  function markUnavailable() {
    failedImageKeys.add(failureKey);
    setImageOk(false);
    if (product) onUnavailable?.(product);
  }

  if (!src || !renderable) {
    return (
      <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]'}>
        <ProductFallbackTile
          product={product}
          category={normalizedCategory}
          name={name}
          brand={brand}
          size={size}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product?.brand || brand || 'Sylistly'} ${product?.name || name || 'product'}`}
        loading={loading}
        referrerPolicy="no-referrer"
        className={className || `h-full w-full ${mode === 'cover' ? 'object-cover' : 'object-contain'} p-2.5`}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth < 32 || image.naturalHeight < 32) {
            markUnavailable();
            return;
          }
          if (product) onAvailable?.(product);
        }}
        onError={markUnavailable}
      />
    </div>
  );
}

export function ProductImage(props: Parameters<typeof SafeProductImage>[0] & { product: Product }) {
  return <SafeProductImage {...props} />;
}
