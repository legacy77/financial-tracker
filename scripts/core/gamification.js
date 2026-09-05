// ============================================================
// scripts/core/gamification.js — XP, Level, Achievements, Streaks
// KelolaRacun Advanced Features
// ============================================================

import { getAll, put } from '../db.js';
import { getPouches } from '../services/pouchService.js';
import { publish } from './eventBus.js';

const STORE = 'gamification';

// XP thresholds per level
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 25000];

// XP rewards per action
const XP = {
  ADD_INCOME: 15,
  ADD_EXPENSE: 10,
  PAY_BILL: 50,
  ADD_BILL: 20,
  IMPORT_TRANSACTION: 5,
  STREAK_BONUS: 30  // per consecutive day
};

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: 'first_loot',
    name: 'First Loot',
    desc: 'Catat transaksi pertama',
    icon: '🌟',
    condition: (s) => s.totalTransactions >= 1
  },
  {
    id: 'five_transactions',
    name: 'Recorder',
    desc: 'Catat 10 transaksi',
    icon: '📝',
    condition: (s) => s.totalTransactions >= 10
  },
  {
    id: 'gold_hoarder',
    name: 'Gold Hoarder',
    desc: 'Total saldo > 5 juta',
    icon: '💰',
    condition: (s) => s.totalBalance >= 5000000
  },
  {
    id: 'rich_guild',
    name: 'Rich Guild',
    desc: 'Total saldo > 15 juta',
    icon: '👑',
    condition: (s) => s.totalBalance >= 15000000
  },
  {
    id: 'first_bill_paid',
    name: 'Disciplined',
    desc: 'Lunasi tagihan pertama',
    icon: '🛡️',
    condition: (s) => s.billsPaid >= 1
  },
  {
    id: 'five_bills_paid',
    name: 'Tribute Master',
    desc: 'Lunasi 5 tagihan',
    icon: '🏆',
    condition: (s) => s.billsPaid >= 5
  },
  {
    id: 'streak_3',
    name: 'Hot Streak',
    desc: 'Catat transaksi 3 hari berturut-turut',
    icon: '🔥',
    condition: (s) => s.currentStreak >= 3
  },
  {
    id: 'streak_7',
    name: 'On Fire',
    desc: 'Catat transaksi 7 hari berturut-turut',
    icon: '⚡',
    condition: (s) => s.currentStreak >= 7
  },
  {
    id: 'level_5',
    name: 'Veteran Guild',
    desc: 'Capai Guild Level 5',
    icon: '🎖️',
    condition: (s) => s.level >= 5
  },
  {
    id: 'level_10',
    name: 'Legendary Guild',
    desc: 'Capai Guild Level 10',
    icon: '🏅',
    condition: (s) => s.level >= 10
  }
];

function calcLevel(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function xpForNextLevel(level) {
  const next = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return next;
}

function xpProgress(xp, level) {
  const current = LEVEL_THRESHOLDS[level - 1] || 0;
  const next = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const progress = ((xp - current) / (next - current)) * 100;
  return Math.min(100, Math.max(0, progress));
}

export async function getState() {
  const all = await getAll(STORE);
  if (!all.length) {
    const initial = {
      id: 'state-1',
      xp: 0,
      level: 1,
      unlockedAchievements: [],
      lastTransactionDate: null,
      currentStreak: 0,
      longestStreak: 0,
      totalTransactions: 0,
      billsPaid: 0,
      totalBalance: 0,
      streakDates: [],
      updatedAt: new Date().toISOString()
    };
    await put(STORE, initial);
    return initial;
  }
  return all[0];
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  await put(STORE, state);
  return state;
}

async function checkStreak(state) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (!state.streakDates) state.streakDates = [];

  if (!state.streakDates.includes(today)) {
    if (state.streakDates.includes(yesterday)) {
      state.currentStreak += 1;
    } else {
      state.currentStreak = 1;
    }
    state.streakDates.push(today);
    // Keep only last 30 streak dates
    if (state.streakDates.length > 30) state.streakDates = state.streakDates.slice(-30);
  }
  if (state.currentStreak > state.longestStreak) state.longestStreak = state.currentStreak;
}

async function checkAchievements(state, stats) {
  const newUnlocks = [];
  for (const ach of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.includes(ach.id) && ach.condition(stats)) {
      state.unlockedAchievements.push(ach.id);
      newUnlocks.push(ach);
    }
  }
  return newUnlocks;
}

export async function addXP(action) {
  const state = await getState();
  let reward = XP[action] || 0;

  // Check for streak bonus
  if (action === 'ADD_INCOME' || action === 'ADD_EXPENSE') {
    await checkStreak(state);
    if (state.currentStreak >= 3) {
      reward += XP.STREAK_BONUS;
    }
  }

  if (reward === 0) return { state, leveledUp: false, newAchievements: [] };

  state.xp += reward;
  const oldLevel = state.level;
  state.level = calcLevel(state.xp);
  const leveledUp = state.level > oldLevel;

  // Get fresh stats for achievement check
  const pouches = await getPouches();
  const bills = await getAll('bills');
  const stats = {
    totalTransactions: state.totalTransactions,
    totalBalance: pouches.reduce((s, p) => s + (p.balance || 0), 0),
    billsPaid: bills.filter(b => b.status === 'Paid').length,
    currentStreak: state.currentStreak,
    level: state.level
  };

  const newAchievements = await checkAchievements(state, stats);
  await saveState(state);

  if (newAchievements.length > 0) {
    publish('gamification:achievement-unlocked', { achievements: newAchievements });
  }
  if (leveledUp) {
    publish('gamification:level-up', { level: state.level });
  }

  return { state, leveledUp, newAchievements };
}

export async function onTransactionAdded(type) {
  const state = await getState();
  state.totalTransactions += 1;
  state.lastTransactionDate = new Date().toISOString();
  await saveState(state);
  return addXP(type === 'Income' ? 'ADD_INCOME' : 'ADD_EXPENSE');
}

export async function onBillPaid() {
  const state = await getState();
  state.billsPaid += 1;
  await saveState(state);
  return addXP('PAY_BILL');
}

export async function onBillAdded() {
  return addXP('ADD_BILL');
}

export async function onTransactionsImported(count) {
  for (let i = 0; i < count; i++) await addXP('IMPORT_TRANSACTION');
  return getState();
}

export function getLevelInfo(state) {
  return {
    level: state.level,
    xp: state.xp,
    progress: xpProgress(state.xp, state.level),
    xpForNext: xpForNextLevel(state.level),
    xpNeeded: LEVEL_THRESHOLDS[state.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1],
    currentThreshold: LEVEL_THRESHOLDS[state.level - 1] || 0
  };
}

export function getAchievements(state) {
  return ACHIEVEMENTS.map(ach => ({
    ...ach,
    unlocked: state.unlockedAchievements.includes(ach.id)
  }));
}

export { LEVEL_THRESHOLDS, XP };
