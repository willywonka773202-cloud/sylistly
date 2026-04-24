'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useRouter } from 'next/navigation';
import { 
  Bookmark, RotateCcw, ShoppingBag, Trash2, Sparkles, 
  ChevronRight, Share2, Copy, Flame, Calendar 
} from 'lucide-react';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';

function formatDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SavedPage() {
  const fits = useSavedFits((state) => state.fits);
  const removeFit = useSavedFits((state) => state.removeFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  const router = useRouter();

  const totalSaved = fits.reduce((sum, fit) => sum + fit.totalCents, 0);

  async function copyShareLink(fitId: string) {
    const url = `${window.location.origin}/fit/${fitId}`;
    await navigator.clipboard.writeText(url);
    alert('Share link copied!');
  }

  return (
    <main className="flex flex-col min-h-[100dvh] max-w-[440px] mx-auto bg-bg pb-20">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-14 pb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">Your Collection</div>
            <h1 className="font-serif text-2xl font-semibold mt-1">Saved Fits</h1>
          </div>
          {fits.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted">Total value</div>
              <div className="font-serif text-xl font-semibold text-emerald">${(totalSaved / 100).toLocaleString()}</div>
            </div>
          )}
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto px-4">
        <AnimatePresence mode="wait">
          {fits.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <div className="rounded-3xl bg-surface-1 border border-hairline p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <Bookmark className="w-8 h-8 text-accent" />
                </div>
                <h2 className="font-serif text-xl font-semibold">No fits saved yet</h2>
                <p className="text-sm text-muted mt-2 mb-6">
                  Generate a look and save it to build your collection
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-semibold text-sm"
                >
                  <Sparkles size={16} />
                  Generate your first fit
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="fits"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {fits.map((fit, index) => (
                <motion.div
                  key={fit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl bg-surface-1 border border-hairline overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-accent" />
                          <span className="text-[10px] uppercase tracking-widest text-muted">
                            {fit.itemCount} pieces
                          </span>
                          <span className="text-[10px] text-muted">·</span>
                          <span className="text-[10px] text-muted">{formatDate(fit.createdAt)}</span>
                        </div>
                        <h3 className="font-semibold text-lg mt-2">{fit.title}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="font-serif text-xl text-emerald">
                            ${(fit.totalCents / 100).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyShareLink(fit.id)}
                          className="w-9 h-9 rounded-xl bg-surface-2 border border-hairline flex items-center justify-center text-muted hover:text-accent transition"
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          onClick={() => removeFit(fit.id)}
                          className="w-9 h-9 rounded-xl bg-surface-2 border border-hairline flex items-center justify-center text-muted hover:text-red-500 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {Object.entries(fit.items).map(([cat]) => (
                        <span
                          key={cat[0]}
                          className="px-2 py-1 rounded-full bg-surface-2 text-[9px] uppercase tracking-wider text-muted"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex border-t border-hairline">
                    <button
                      onClick={() => {
                        replaceItems(fit.items);
                        router.push('/');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-hairline text-sm font-medium hover:bg-surface-2 transition"
                    >
                      <RotateCcw size={16} />
                      Load
                    </button>
                    <button
                      onClick={() => {
                        const products = Object.values(fit.items)
                          .filter((p): p is NonNullable<typeof p> => Boolean(p))
                          .map((p) => ({
                            id: p.id,
                            brand: p.brand,
                            name: p.name,
                            retailer: p.retailer,
                            url: p.affiliateUrl || p.retailerUrl,
                            priceCents: p.priceCents,
                          }))
                          .filter((p) => Boolean(p.url));
                        setCheckoutTitle(fit.title);
                        setCheckoutProducts(products);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-hairline text-sm font-medium hover:bg-surface-2 transition"
                    >
                      <ShoppingBag size={16} />
                      Shop
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium hover:bg-surface-2 transition"
                    >
                      <Copy size={16} />
                      Clone
                    </button>
                  </div>
                </motion.div>
              ))}

              <div className="rounded-2xl bg-surface-2 border border-hairline p-4 text-center">
                <p className="text-xs text-muted">
                  <Flame className="inline w-3 h-3 mr-1" />
                  {fits.length} look{fits.length !== 1 ? 's' : ''} saved
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}