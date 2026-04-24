'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Sparkles, Flame, TrendingUp, Crown, 
  Zap, Heart, Users, Clock, Gift, Star
} from 'lucide-react';

const TRENDING_STYLES = [
  { id: '1', occasion: 'street', label: 'Streetwear Hype', votes: 892, heat: 98 },
  { id: '2', occasion: 'night', label: 'Night Out', votes: 654, heat: 94 },
  { id: '3', occasion: 'date', label: 'Date Night', votes: 521, heat: 88 },
  { id: '4', occasion: 'edgy', label: 'Edgy Mood', votes: 445, heat: 82 },
  { id: '5', occasion: 'preppy', label: 'Classic Prep', votes: 312, heat: 75 },
];

const TOP_OCCASIONS = [
  { id: 'night', label: 'Night Out', icon: '🌙', color: 'from-purple-500' },
  { id: 'street', label: 'Streetwear', icon: '🔥', color: 'from-orange-500' },
  { id: 'date', label: 'Date', icon: '💕', color: 'from-pink-500' },
  { id: 'gym', label: 'Gym', icon: '💪', color: 'from-green-500' },
  { id: 'vacation', label: 'Vacation', icon: '✈️', color: 'from-blue-500' },
  { id: 'office', label: 'Office', icon: '💼', color: 'from-gray-500' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DiscoverPage() {
  const [greeting, setGreeting] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'top' | 'drops'>('trending');

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <main className="flex flex-col min-h-[100dvh] max-w-[440px] mx-auto bg-bg pb-20">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-12 pb-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">{greeting}</div>
            <h1 className="font-serif text-2xl font-semibold mt-1">Discover</h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-hairline">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-semibold text-orange-500">Live</span>
          </div>
        </div>
      </motion.header>

      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-2xl bg-surface-1 border border-hairline">
          {(['trending', 'top', 'drops'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition ${
                activeTab === tab 
                  ? 'bg-surface-2 text-ink' 
                  : 'text-muted'
              }`}
            >
              {tab === 'trending' && <TrendingUp className="w-3 h-3 inline mr-1" />}
              {tab === 'top' && <Crown className="w-3 h-3 inline mr-1" />}
              {tab === 'drops' && <Gift className="w-3 h-3 inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-2xl bg-gradient-to-r from-orange-500/20 to-accent/20 border border-orange-500/30 p-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-[10px] uppercase tracking-widest text-orange-500">Hot Right Now</span>
                </div>
                <div className="font-serif text-lg font-semibold mt-2">Trending Styles</div>
                <div className="text-xs text-muted mt-1">Most generated today</div>
              </div>

              {TRENDING_STYLES.map((style, index) => (
                <Link
                  key={style.id}
                  href={`/?occasion=${style.occasion}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-surface-2 border border-hairline"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold ${
                      index === 0 ? 'bg-orange-500 text-black' :
                      index === 1 ? 'bg-amber-500 text-black' :
                      index === 2 ? 'bg-zinc-400 text-black' :
                      'bg-surface-3 text-muted'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-xs text-muted uppercase">{style.occasion}</div>
                      <div className="font-semibold">{style.label}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-orange-500 text-xs">
                      <Flame size={12} />
                      <span className="font-semibold">{style.heat}%</span>
                    </div>
                    <div className="text-[10px] text-muted">{style.votes} votes</div>
                  </div>
                </Link>
              ))}
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
              <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 p-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span className="text-[10px] uppercase tracking-widest text-amber-500">Top Rated</span>
                </div>
                <div className="font-serif text-lg font-semibold mt-2">Best Occasions</div>
                <div className="text-xs text-muted mt-1">All time favorites</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {TOP_OCCASIONS.map((occ) => (
                  <Link
                    key={occ.id}
                    href={`/?occasion=${occ.id}`}
                    className="flex flex-col items-center p-4 rounded-2xl bg-surface-2 border border-hairline hover:border-accent/50 transition"
                  >
                    <span className="text-3xl">{occ.icon}</span>
                    <span className="font-semibold text-sm mt-2">{occ.label}</span>
                    <div className="flex items-center gap-1 mt-1 text-amber-500 text-xs">
                      <Star size={10} fill="currentColor" />
                      <span>Top</span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'drops' && (
            <motion.div
              key="drops"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-2xl bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 p-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent" />
                  <span className="text-[10px] uppercase tracking-widest text-accent">Daily Drops</span>
                </div>
                <div className="font-serif text-lg font-semibold mt-2">New Today</div>
                <div className="text-xs text-muted mt-1">Limited time only</div>
              </div>

              <div className="rounded-2xl bg-surface-2 border border-hairline p-4 text-center">
                <Gift className="w-10 h-10 text-accent mx-auto mb-2" />
                <div className="font-semibold">Coming Soon</div>
                <div className="text-xs text-muted mt-1">Check back daily for new drops</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-6 pt-4 border-t border-hairline">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              <span className="text-[10px] uppercase tracking-widest text-muted">Trending Searches</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {['Y2K aesthetic', 'quiet luxury', 'gorpcore', 'old money', 'coastal', 'minimal'].map((term) => (
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