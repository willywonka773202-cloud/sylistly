'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  threshold = 80 
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, threshold], [0, 180]);
  const opacity = useTransform(y, [0, threshold], [0, 1]);

  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0) {
        setStartY(e.touches[0].clientY);
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || el.scrollTop > 0) {
        setIsPulling(false);
        return;
      }
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 0) {
        y.set(Math.min(deltaY * 0.3, threshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      setIsPulling(false);
      y.set(0);
      
      if (threshold && y.get() ? y.get() >= threshold : false) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, isPulling, onRefresh, threshold, y]);

  return (
    <div ref={scrollRef} className="relative overflow-y-auto h-full">
      <motion.div
        style={{ rotate, opacity }}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
      >
        <RefreshCw 
          size={20} 
          className={isRefreshing ? 'animate-spin text-accent' : 'text-muted'} 
        />
      </motion.div>
      {children}
    </div>
  );
}