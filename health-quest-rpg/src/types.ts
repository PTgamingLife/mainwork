export type Screen = 'dashboard' | 'boss' | 'inventory' | 'profile';

export interface Quest {
  id: string;
  title: string;
  exp: number;
  completed: boolean;
  icon: string;
}

export interface Boss {
  id: string;
  name: string;
  subtitle: string;
  hpPercent: number;
  reading: string;
  urgent: boolean;
}

export interface Weakness {
  label: string;
  severity: 'Critical' | 'Weak' | 'Vulnerable';
  icon: string;
}

export interface Skill {
  name: string;
  effect: string;
  icon: string;
}

export interface HealthStat {
  id: string;
  gameName: string;
  realName: string;
  value: string;
  status: 'Excellent' | 'Healthy' | 'Needs Attention' | 'Restored';
  rarity: 'Exotic Rarity' | 'Common Rarity' | 'Masterwork' | 'Sturdy' | 'Cursed?';
  icon: string;
}

export interface LedgerEntry {
  date: string;
  description: string;
  xp: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  unlocked: boolean;
}

export interface PlayerProfile {
  name: string;
  title: string;
  level: number;
  vitality: number;
  maxVitality: number;
  wisdom: number;
  bmi: number;
  cardio: string;
  sleepHours: number;
  focus: string;
}
