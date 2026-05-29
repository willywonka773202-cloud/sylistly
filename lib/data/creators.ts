import type { Creator } from '../social-types';

/** Seeded creator profiles (the "users" who post). 12 distinct aesthetics. */
export const CREATORS: Creator[] = [
  { id: 'maya', handle: 'mayachen', name: 'Maya Chen', avatarColor: '#b89466', motif: 'coat', bio: 'Quiet luxury. Neutral palettes, considered tailoring.', aesthetics: ['minimalist', 'oldmoney', 'businesscasual'], followers: 48200, following: 312, verified: true },
  { id: 'devon', handle: 'devonruns', name: 'Devon Park', avatarColor: '#26262a', motif: 'puffer', bio: 'Downtown layers + sneakers that matter.', aesthetics: ['streetwear', 'edgy', 'athletic'], followers: 72500, following: 480, verified: true },
  { id: 'sofia', handle: 'sofiarossi', name: 'Sofia Rossi', avatarColor: '#a23f57', motif: 'dress', bio: 'Night-out edits & date-night fits.', aesthetics: ['datenight', 'goingout', 'formal'], followers: 61300, following: 521, verified: true },
  { id: 'kai', handle: 'kaitrains', name: 'Kai Tanaka', avatarColor: '#2f5d52', motif: 'sneaker', bio: 'Performance sets. Train hard, look sharp.', aesthetics: ['athletic', 'gym', 'streetwear'], followers: 38900, following: 210 },
  { id: 'noah', handle: 'noahbennett', name: 'Noah Bennett', avatarColor: '#1d3f6b', motif: 'blazer', bio: 'East-coast prep. Oxford shirts forever.', aesthetics: ['preppy', 'businesscasual', 'oldmoney'], followers: 29400, following: 188, verified: true },
  { id: 'lena', handle: 'lenaortiz', name: 'Lena Ortiz', avatarColor: '#7aa6c2', motif: 'dress', bio: 'Sun, salt, and linen. Coastal forever.', aesthetics: ['coastal', 'summer', 'travel'], followers: 41700, following: 366 },
  { id: 'theo', handle: 'theoadler', name: 'Theo Adler', avatarColor: '#3a3733', motif: 'boot', bio: 'Moody layers for cold cities.', aesthetics: ['edgy', 'winter', 'minimalist'], followers: 33200, following: 142 },
  { id: 'ivy', handle: 'ivynakamura', name: 'Ivy Nakamura', avatarColor: '#c95fa0', motif: 'crop', bio: 'Y2K revival & playful going-out fits.', aesthetics: ['y2k', 'goingout', 'summer'], followers: 88100, following: 612, verified: true },
  { id: 'marcus', handle: 'marcuslee', name: 'Marcus Lee', avatarColor: '#8a7a52', motif: 'coat', bio: 'Heritage tailoring. Old money, new rules.', aesthetics: ['oldmoney', 'formal', 'businesscasual'], followers: 54600, following: 96, verified: true },
  { id: 'priya', handle: 'priyashah', name: 'Priya Shah', avatarColor: '#9a6a3f', motif: 'backpack', bio: 'Campus to airport. Easy everyday style.', aesthetics: ['campus', 'travel', 'casual'], followers: 26800, following: 401 },
  { id: 'jules', handle: 'julesmoreau', name: 'Jules Moreau', avatarColor: '#4a4a55', motif: 'blazer', bio: 'Minimal workwear. Black, white, repeat.', aesthetics: ['businesscasual', 'minimalist', 'formal'], followers: 45100, following: 233, verified: true },
  { id: 'remy', handle: 'remycole', name: 'Remy Cole', avatarColor: '#b27a35', motif: 'jacket', bio: 'Workwear & thrift. Texture over logos.', aesthetics: ['streetwear', 'edgy', 'campus'], followers: 31500, following: 277 },
];

export const CREATOR_BY_ID: Map<string, Creator> = new Map(CREATORS.map((c) => [c.id, c]));

export const ME_CREATOR: Creator = {
  id: 'me',
  handle: 'you',
  name: 'You',
  avatarColor: '#c2554e',
  motif: 'tee',
  bio: 'Building my Style DNA on Sylistly.',
  aesthetics: ['minimalist', 'streetwear', 'casual'],
  followers: 128,
  following: 184,
};

export function getCreator(id: string): Creator | undefined {
  if (id === 'me') return ME_CREATOR;
  return CREATOR_BY_ID.get(id);
}
