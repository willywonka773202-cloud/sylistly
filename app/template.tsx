'use client';
import { motion } from 'framer-motion';

// Re-mounts on every route change → gives each screen a subtle fade-in.
// Opacity-only (no transform) so it never creates a containing block for
// fixed/sticky overlays (sheets, nav).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.26, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
