'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Ruler, WandSparkles, Sparkles, ChevronRight, 
  Check, User, Settings, Bell, Shield, HelpCircle, Trash2, ExternalLink, Flame
} from 'lucide-react';
import { useProfile } from '@/store/profile';

const SKIN_TONES = [
  { hex: '#f5d0b5', label: 'Light' },
  { hex: '#ddb192', label: 'Medium-Light' },
  { hex: '#c9a98a', label: 'Medium' },
  { hex: '#a47757', label: 'Medium-Dark' },
  { hex: '#7d553e', label: 'Dark' },
  { hex: '#4b3025', label: 'Deep' },
];

const BODY_TYPES = [
  { id: 'masc', label: 'Masculine', icon: '👨' },
  { id: 'fem', label: 'Feminine', icon: '👩' },
  { id: 'androgynous', label: 'Neutral', icon: '🧑' },
] as const;

const BUDGETS = [
  { id: 'low', label: 'Budget', range: 'Under $100' },
  { id: 'mid', label: 'Mid-Range', range: '$100-300' },
  { id: 'high', label: 'Premium', range: '$300-500' },
  { id: 'luxury', label: 'Luxury', range: '$500+' },
] as const;

const STYLE_PERSONAS = [
  { id: 'minimal', label: 'Minimalist', description: 'Clean lines, neutral colors' },
  { id: 'street', label: 'Streetwear', description: 'Hype, oversized, urban' },
  { id: 'classic', label: 'Classic', description: 'Timeless, preppy' },
  { id: 'edgy', label: 'Edgy', description: 'Dark, bold, statement' },
] as const;

export default function ProfilePage() {
  const profile = useProfile((state) => state.profile);
  const setSkinTone = useProfile((state) => state.setSkinTone);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setBudget = useProfile((state) => state.setBudget);

  return (
    <main className="flex flex-col min-h-[100dvh] max-w-[440px] mx-auto bg-bg pb-20">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-14 pb-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-hot flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold">Profile</h1>
            <p className="text-sm text-muted">Customize your style DNA</p>
          </div>
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-surface-1 border border-hairline p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-lg">Your Look</h2>
          </div>

          <div className="mb-5">
            <div className="text-xs uppercase tracking-widest text-muted mb-3">Skin Tone</div>
            <div className="flex gap-2">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.hex}
                  onClick={() => setSkinTone(tone.hex)}
                  className={`flex-1 py-2 rounded-xl border-2 transition ${
                    profile.skinTone === tone.hex 
                      ? 'border-accent' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: tone.hex + '30' }}
                >
                  <span className={`text-[10px] ${profile.skinTone === tone.hex ? 'text-accent' : 'text-muted'}`}>
                    {tone.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted mb-3">Body Frame</div>
            <div className="flex gap-2">
              {BODY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setBodyType(type.id)}
                  className={`flex-1 py-3 rounded-xl border transition ${
                    profile.bodyType === type.id
                      ? 'bg-accent border-accent text-white'
                      : 'bg-surface-2 border-hairline text-muted-2 hover:border-hairline-2'
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  <span className="block text-[10px] mt-1">{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl bg-surface-1 border border-hairline p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <WandSparkles className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-lg">Budget</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {BUDGETS.map((budget) => (
              <button
                key={budget.id}
                onClick={() => setBudget(budget.id)}
                className={`p-3 rounded-xl border text-left transition ${
                  profile.stylePrefs.budget === budget.id
                    ? 'bg-accent/10 border-accent'
                    : 'bg-surface-2 border-hairline hover:border-hairline-2'
                }`}
              >
                <div className={`font-semibold ${profile.stylePrefs.budget === budget.id ? 'text-accent' : 'text-ink'}`}>
                  {budget.label}
                </div>
                <div className="text-xs text-muted mt-0.5">{budget.range}</div>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl bg-surface-1 border border-hairline p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <Flame className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-lg">Style Persona</h2>
          </div>

          <div className="space-y-2">
            {STYLE_PERSONAS.map((persona) => (
              <button
                key={persona.id}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-hairline hover:border-accent/50 transition"
              >
                <div className="text-left">
                  <div className="font-semibold text-sm">{persona.label}</div>
                  <div className="text-xs text-muted">{persona.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl bg-surface-1 border border-hairline divide-y divide-hairline overflow-hidden"
        >
          <button className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition">
            <Settings className="w-5 h-5 text-muted" />
            <span className="flex-1 text-left text-sm">Settings</span>
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition">
            <Bell className="w-5 h-5 text-muted" />
            <span className="flex-1 text-left text-sm">Notifications</span>
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition">
            <Shield className="w-5 h-5 text-muted" />
            <span className="flex-1 text-left text-sm">Privacy</span>
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition">
            <HelpCircle className="w-5 h-5 text-muted" />
            <span className="flex-1 text-left text-sm">Help & Support</span>
            <ChevronRight className="w-4 h-4 text-muted" />
          </button>
        </motion.section>

        <div className="py-4 text-center">
          <p className="text-xs text-muted">Sylistly v0.2.0</p>
          <p className="text-[10px] text-muted/50 mt-1">Build Your Vibe</p>
        </div>
      </div>
    </main>
  );
}