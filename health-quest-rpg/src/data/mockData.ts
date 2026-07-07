import type { Quest, Boss, Weakness, Skill, HealthStat, LedgerEntry, Achievement, PlayerProfile } from '../types';

export const quests: Quest[] = [
  { id: '1', title: 'Record Sleep', exp: 10, completed: false, icon: 'bedtime' },
  { id: '2', title: '30 min Walk', exp: 50, completed: false, icon: 'directions_walk' },
  { id: '3', title: 'Hydration Ritual', exp: 20, completed: true, icon: 'water_drop' },
  { id: '4', title: 'Track Nutrition', exp: 25, completed: false, icon: 'restaurant' },
  { id: '5', title: 'Meditation 10 min', exp: 30, completed: false, icon: 'self_improvement' },
];

export const activeBoss: Boss = {
  id: 'hypertension',
  name: 'Hypertension Boss',
  subtitle: 'Blood Pressure Spike',
  hpPercent: 78,
  reading: '145/90 mmHg',
  urgent: true,
};

export const bossWeaknesses: Weakness[] = [
  { label: 'Sodium Intake', severity: 'Critical', icon: 'restaurant' },
  { label: 'Sleep Quality', severity: 'Weak', icon: 'bedtime' },
  { label: 'Stress Levels', severity: 'Vulnerable', icon: 'self_improvement' },
];

export const bossSkills: Skill[] = [
  { name: 'Daily Sprint', effect: '+15 Heart Guard stat', icon: 'directions_run' },
  { name: 'DASH Scroll', effect: '2x damage vs. BP', icon: 'menu_book' },
  { name: 'Zen Pulse', effect: 'Pressure reduction', icon: 'air' },
  { name: 'Elixir of Life', effect: '2L daily hydration', icon: 'water_drop' },
];

export const healthStats: HealthStat[] = [
  { id: '1', gameName: 'Heart Core', realName: 'Heart Rate', value: '72 BPM Avg', status: 'Excellent', rarity: 'Exotic Rarity', icon: 'favorite' },
  { id: '2', gameName: 'Breath Essence', realName: 'Oxygen Sat.', value: '98% SpO₂', status: 'Healthy', rarity: 'Common Rarity', icon: 'air' },
  { id: '3', gameName: 'Blood Stream', realName: 'Blood Pressure', value: '142/95 mmHg', status: 'Needs Attention', rarity: 'Cursed?', icon: 'bloodtype' },
  { id: '4', gameName: 'Physical Might', realName: 'Daily Steps', value: '12,402 Steps', status: 'Excellent', rarity: 'Masterwork', icon: 'directions_walk' },
  { id: '5', gameName: 'Dream Forge', realName: 'Sleep Duration', value: '7h 22m Rest', status: 'Restored', rarity: 'Sturdy', icon: 'bedtime' },
];

export const ledgerEntries: LedgerEntry[] = [
  { date: 'Today', description: 'Completed Hydration Ritual', xp: 20 },
  { date: 'Yesterday', description: 'Walked 10,000+ steps', xp: 50 },
  { date: 'May 20', description: 'Logged full night sleep', xp: 10 },
  { date: 'May 19', description: 'Defeated Stress Minion', xp: 75 },
];

export const achievements: Achievement[] = [
  { id: '1', name: '7-Day Streak', icon: 'local_fire_department', unlocked: true },
  { id: '2', name: 'Sugar Slayer', icon: 'skull', unlocked: true },
  { id: '3', name: 'Mountain Mover', icon: 'hiking', unlocked: true },
  { id: '4', name: 'Dawn Breaker', icon: 'wb_sunny', unlocked: false },
  { id: '5', name: 'Master Chef', icon: 'restaurant', unlocked: false },
  { id: '6', name: 'Iron Will', icon: 'fitness_center', unlocked: false },
];

export const playerProfile: PlayerProfile = {
  name: 'Sir Arthur Wellness',
  title: 'The Consistent Wanderer',
  level: 14,
  vitality: 85,
  maxVitality: 100,
  wisdom: 92,
  bmi: 22.4,
  cardio: 'High',
  sleepHours: 7.5,
  focus: 'Calm',
};
