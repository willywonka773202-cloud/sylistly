/**
 * Stylist XP, levels, and daily quests — the honest progress loop. XP is earned
 * ONLY for real actions you actually take (swipe to a new fit, like, save, open a
 * drop, shop a bundle) and quests track REAL daily counts. No fake numbers, no
 * pay-to-progress, no loss-baiting — just visible progress for using the app.
 * All localStorage. See [[sylistly-dopamine-direction]].
 */

const XP_KEY = 'sylistly.xp.total';
const DAILY_KEY = 'sylistly.xp.daily';
const LEVEL_SEEN_KEY = 'sylistly.xp.level-seen';

function ls(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// ── Levels ───────────────────────────────────────────────────────────────────
export interface LevelTier {
  level: number;
  title: string;
  at: number; // cumulative XP needed to reach it
}

export const LEVELS: LevelTier[] = [
  { level: 1, title: 'Rookie', at: 0 },
  { level: 2, title: 'Curator', at: 120 },
  { level: 3, title: 'Tastemaker', at: 320 },
  { level: 4, title: 'Stylist', at: 640 },
  { level: 5, title: 'Editor', at: 1100 },
  { level: 6, title: 'Visionary', at: 1750 },
  { level: 7, title: 'Icon', at: 2600 },
];

export interface LevelState {
  level: number;
  title: string;
  xp: number;
  intoLevel: number; // xp earned within the current level
  span: number; // xp from this level to the next (0 if maxed)
  pct: number; // 0–100 progress to next
  nextTitle: string | null;
  maxed: boolean;
}

export function levelFor(xp: number): LevelState {
  let current = LEVELS[0];
  for (const tier of LEVELS) if (xp >= tier.at) current = tier;
  const next = LEVELS.find((t) => t.at > current.at && xp < t.at) ?? null;
  if (!next) {
    return { level: current.level, title: current.title, xp, intoLevel: xp - current.at, span: 0, pct: 100, nextTitle: null, maxed: true };
  }
  const span = next.at - current.at;
  const intoLevel = xp - current.at;
  return {
    level: current.level,
    title: current.title,
    xp,
    intoLevel,
    span,
    pct: Math.max(0, Math.min(100, Math.round((intoLevel / span) * 100))),
    nextTitle: next.title,
    maxed: false,
  };
}

export function getXp(): number {
  const store = ls();
  return store ? parseInt(store.getItem(XP_KEY) || '0', 10) || 0 : 0;
}

export function getLevel(): LevelState {
  return levelFor(getXp());
}

/**
 * Detects a tier crossing (Rookie → Curator → …) exactly once. Call right AFTER
 * any XP change (e.g. after bumpDaily). Returns the new LevelState the first time
 * the level exceeds the last-seen one, else null. The first call ever just
 * baselines to the current level so returning users aren't congratulated
 * retroactively. localStorage-backed, like the rest of the loop.
 */
export function consumeLevelUp(): LevelState | null {
  const store = ls();
  if (!store) return null;
  const current = getLevel();
  const raw = store.getItem(LEVEL_SEEN_KEY);
  if (raw === null) {
    store.setItem(LEVEL_SEEN_KEY, String(current.level));
    return null;
  }
  const lastSeen = parseInt(raw, 10) || 1;
  if (current.level > lastSeen) {
    store.setItem(LEVEL_SEEN_KEY, String(current.level));
    return current;
  }
  return null;
}

function addXp(amount: number): void {
  const store = ls();
  if (!store || amount <= 0) return;
  store.setItem(XP_KEY, String(getXp() + amount));
}

// ── Daily counters + quests ──────────────────────────────────────────────────
export type Metric = 'looksViewed' | 'likes' | 'saves' | 'dropsOpened' | 'bundlesShopped';

const ACTION_XP: Record<Metric, number> = {
  looksViewed: 1,
  likes: 5,
  saves: 8,
  dropsOpened: 12,
  bundlesShopped: 15,
};
const VIEW_XP_CAP = 40; // max XP/day from passive swiping (keeps it from being a grind)

interface DailyState {
  day: string;
  metrics: Partial<Record<Metric, number>>;
  quests: string[]; // claimed quest ids
}

export interface Quest {
  id: string;
  label: string;
  emoji: string;
  metric: Metric;
  target: number;
  xp: number;
}

export const DAILY_QUESTS: Quest[] = [
  { id: 'open-drop', label: "Open today's Drop", emoji: '🎁', metric: 'dropsOpened', target: 1, xp: 30 },
  { id: 'save-fit', label: 'Save a fit you love', emoji: '🔖', metric: 'saves', target: 1, xp: 20 },
  { id: 'like-3', label: 'Like 3 fits', emoji: '❤️', metric: 'likes', target: 3, xp: 20 },
];

function readDaily(): DailyState {
  const store = ls();
  const today = dayKey(new Date());
  const empty: DailyState = { day: today, metrics: {}, quests: [] };
  if (!store) return empty;
  try {
    const parsed = JSON.parse(store.getItem(DAILY_KEY) || 'null') as DailyState | null;
    if (!parsed || parsed.day !== today) return empty; // rolls over at midnight
    return { day: today, metrics: parsed.metrics || {}, quests: parsed.quests || [] };
  } catch {
    return empty;
  }
}

function writeDaily(state: DailyState): void {
  ls()?.setItem(DAILY_KEY, JSON.stringify(state));
}

export function getDaily(metric: Metric): number {
  return readDaily().metrics[metric] || 0;
}

/**
 * Record one real action: bumps the daily counter, grants the action's XP
 * (passive views are capped), and auto-claims any quest it completes. Returns
 * total XP gained (action + any quest), for an optional flourish.
 */
export function bumpDaily(metric: Metric, amount = 1): number {
  const store = ls();
  if (!store) return 0;
  const state = readDaily();
  const count = (state.metrics[metric] || 0) + amount;
  state.metrics[metric] = count;

  let gained = 0;
  // Action XP (passive views capped so swiping isn't a grind).
  if (metric !== 'looksViewed' || count <= VIEW_XP_CAP) gained += ACTION_XP[metric] * amount;

  // Quest completion (award once per day).
  for (const quest of DAILY_QUESTS) {
    if (quest.metric === metric && !state.quests.includes(quest.id) && count >= quest.target) {
      state.quests.push(quest.id);
      gained += quest.xp;
    }
  }

  writeDaily(state);
  if (gained > 0) addXp(gained);
  return gained;
}

export interface QuestStatus extends Quest {
  progress: number;
  done: boolean;
}

export function questStatus(): QuestStatus[] {
  const state = readDaily();
  return DAILY_QUESTS.map((quest) => {
    const have = state.metrics[quest.metric] || 0;
    return { ...quest, progress: Math.min(have, quest.target), done: have >= quest.target || state.quests.includes(quest.id) };
  });
}
