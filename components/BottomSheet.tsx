'use client';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[440px] rounded-t-[28px] bg-surface-1 shadow-float flex flex-col max-h-[88dvh]"
          >
            <div className="pt-3 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-hairline-2" />
            </div>
            {title && (
              <div className="px-5 pt-2 pb-3 shrink-0">
                <h3 className="font-display text-xl text-ink">{title}</h3>
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-5 scrollbar-hide">{children}</div>
            {footer && <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] border-t border-hairline shrink-0">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
