'use client';
import { motion } from 'framer-motion';

interface SkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'rect';
  width?: string | number;
  height?: string | number;
  className?: string;
}

const VARIANTS = {
  text: 'rounded-lg h-4',
  card: 'rounded-2xl h-32',
  avatar: 'rounded-full w-12 h-12',
  rect: 'rounded-xl',
};

export function Skeleton({ 
  variant = 'rect', 
  width = '100%', 
  height,
  className = '' 
}: SkeletonProps) {
  const defaultHeights = {
    text: 'h-4',
    card: 'h-32',
    avatar: 'w-12 h-12',
    rect: 'h-16',
  };

  return (
    <div 
      className={`animate-shimmer bg-surface-2 ${VARIANTS[variant]} ${className}`}
      style={{ 
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height || defaultHeights[variant]
      }}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
      <div className="flex gap-3">
        <Skeleton variant="rect" width={96} height={112} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <div className="flex gap-2 pt-2">
            <Skeleton width={60} height={24} className="rounded-full" />
            <Skeleton width={80} height={24} className="rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OutfitCardSkeleton() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 p-4">
      <div className="flex gap-3">
        <div className="space-y-1">
          <Skeleton width={120} height={180} className="rounded-xl" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" />
          <div className="grid grid-cols-4 gap-1">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} width={56} height={56} className="rounded-lg" />
            ))}
          </div>
          <Skeleton variant="text" width="50%" className="mt-4" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MannequinSkeleton() {
  return (
    <div className="flex gap-4 items-start">
      <div className="relative">
        <Skeleton width={120} height={320} className="rounded-2xl" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-3 rounded-full bg-black/30 blur-sm" />
      </div>
      <div className="flex-1 space-y-1.5">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} height={36} className="rounded-lg" />
        ))}
      </div>
    </div>
  );
}