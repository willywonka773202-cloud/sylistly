'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Sparkles, Flame, TrendingUp, Calendar, 
  Crown, Zap, Heart, Users, RefreshCw 
} from 'lucide-react';
import { getFeaturedCatalogProducts, getCollectionsFor } from '@/lib/catalog';
import { OCCASIONS, type OccasionId } from '@/lib/occasions';

const TRENDING_STYLES = [
  { id: '1', occasion: 'street', label: 'Hype Beast', votes: 847, heat: 98 },
  { id: '2', occasion: 'night', label: 'Night Velvet', votes: 623, heat: 92 },
  { id: '3', occasion: 'date', label: 'Date Night Drip', votes: 512, heat: 89 },
  { id: '4', occasion: 'edgy', label: 'Dark Mode', votes: 489, heat: 85 },
  { id: '5', occasion: 'preppy', label: 'Old Money', votes: 367, heat: 78 },
];

const DAILY_DROPS = [
  { id: 'miami', label: 'Miami Vice', occasion: 'vacation', discount: '25% off' },
  { id: 'date', label: 'Date Essentials', occasion: 'dateright', discount: 'Bundle' },
  { id: 'gym', label: 'Summer Shred', occasion: 'gym', discount: '20% off' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DiscoverPage() {
  const [greeting, setGreeting] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'daily' | 'top'>('trending');

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const featuredProducts = getFeaturedCatalogProducts(6);

  return (
    <main className="flex flex-col min-h-[100dvh] max-w-[440px] mx-auto bg-bg pb-20">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-14 pb-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">{greeting}</div>
            <h1 className="font-serif text-2xl font-semibold mt-1">Discover</h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-hairline">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-semibold text-orange-500">247online</span>
          </div>
        </div>
      </motion.header>

      <div className="px-4 mb-4">
        <div className="flex gap-2 p-1 rounded-2xl bg-surface-1 border border-hairline">
          {(['trending', 'daily', 'top'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition ${
                activeTab === tab 
                  ? 'bg-surface-2 text-ink' 
                  : 'text-muted hover:text-muted-2'
              }`}
            >
              {tab === 'trending' && <TrendingUp className="w-3 h-3 inline mr-1" />}
              {tab === 'daily' && <Calendar className="w-3 h-3 inline mr-1" />}
              {tab === 'top' && <Crown className="w-3 h-3 inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeTab === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-3xl bg-gradient-to-r from-orange-500/20 to-accent/20 border border-orange-500/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-[10px] uppercase tracking-widest text-orange-500">Hot Now</span>
                </div>
                <div className="font-serif text-xl font-semibold">Trending on Sylistly</div>
                <div className="text-sm text-muted mt-1">See what everyone's generating today</div>
              </div>

              {TRENDING_STYLES.map((style, index) => (
                <motion.div
                  key={style.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl bg-surface-1 border border-hairline p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-orange-500 text-bg' :
                        index === 1 ? 'bg-amber-500 text-bg' :
                        index === 2 ? 'bg-zinc-400 text-bg' :
                        'bg-surface-3 text-muted'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-muted">{style.occasion}</div>
                        <div className="font-semibold text-base">{style.label}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-orange-500 text-xs">
                        <Flame size={12} />
                        <span className="font-semibold">{style.heat}%</span>
                      </div>
                      <div className="text-[10px] text-muted">{style.votes} votes</div>
                    </div>
                  </div>
                  <Link
                    href={`/?occasion=${style.occasion}`}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-2 border border-hairline text-[11px] font-medium text-muted hover:border-accent hover:text-accent transition"
                  >
                    Try this vibe
                    <ArrowRight size={14} />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-3xl bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-accent" />
                  <span className="text-[10px] uppercase tracking-widest text-accent">Daily Drops</span>
                </div>
                <div className="font-serif text-xl font-semibold">Today's Picks</div>
                <div className="text-sm text-muted mt-1">Limited time offers</div>
              </div>

              {DAILY_DROPS.map((drop) => (
                <div
                  key={drop.id}
                  className="rounded-2xl bg-surface-1 border border-hairline p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-accent">{drop.discount}</div>
                      <div className="font-semibold text-base mt-1">{drop.label}</div>
                      <div className="text-xs text-muted mt-1 capitalize">{drop.occasion} occasion</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                      <Zap size={12} className="inline" /> Drop
                    </div>
                  </div>
                  <Link
                    href={`/?occasion=${drop.occasion}`}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white font-semibold text-xs uppercase tracking-wider"
                  >
                    Generate now
                    <Sparkles size={14} />
                  </Link>
                </div>
              ))}

              <div className="rounded-2xl bg-surface-2 border border-hairline p-4 text-center">
                <RefreshCw className="w-5 h-5 text-muted mx-auto mb-2" />
                <div className="text-xs text-muted">New drops every 24 hours</div>
              </div>
            </motion.div>
          )}

          {activeTab === 'top' && (
            <motion.div
              key="top"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-3xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span className="text-[10px] uppercase tracking-widest text-amber-500">All-Time Favs</span>
                </div>
                <div className="font-serif text-xl font-semibold">Top Rated Looks</div>
                <div className="text-sm text-muted mt-1">Community favorites</div>
              </div>

              {OCCASIONS.slice(0, 6).map((occasion, index) => (
                <Link
                  key={occasion.id}
                  href={`/?occasion=${occasion.id}`}
                  className="block rounded-2xl bg-surface-1 border border-hairline p-4 hover:border-amber-500/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <occasion.icon className={`w-6 h-6 ${index === 0 ? 'text-amber-500' : 'text-muted'}`} />
                    <div className="flex-1">
                      <div className="font-semibold text-base">{occasion.label}</div>
                      <div className="text-xs text-muted">{occasion.slots.length} pieces</div>
                    </div>
                    {index < 3 && (
                      <div className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold">
                        <Crown size={10} className="inline mr-1" />
                        Top {index + 1}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-6 rounded-3xl bg-surface-1 border border-hairline p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              <span className="text-[10px] uppercase tracking-widest text-muted">Popular Searches</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {['Y2K aesthetic', 'Quiet luxury', 'Streetwear', 'Old money', 'Gorpcore', 'Coastal grandma'].map((term) => (
              <Link
                key={term}
                href={`/?query=${encodeURIComponent(term)}`}
                className="px-3 py-1.5 rounded-full bg-surface-2 border border-hairline text-[11px] text-muted hover:border-accent hover:text-accent transition"
              >
                {term}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}