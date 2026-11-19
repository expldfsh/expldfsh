import type { DayCount } from './types.ts';

/**
 * Activity levels. A day is level k when its count >= LEVEL_MIN[k].
 *   0: none · 1: 1 · 2: 2-3 · 3: 4-8 · 4: 9-29 · 5: 30+
 * Fixed (not quantile-based) so a window's colour means the same thing every day.
 */
export const LEVEL_MIN = [0, 1, 2, 4, 9, 30] as const;

export function level(count: number): number {
  let l = 0;
  for (let k = 1; k < LEVEL_MIN.length; k++) if (count >= LEVEL_MIN[k]!) l = k;
  return l;
}

const toDate = (date: string): Date => new Date(`${date}T00:00:00Z`);

/** 0 = Sunday … 6 = Saturday (calendar dates carry no time zone). */
export const weekday = (date: string): number => toDate(date).getUTCDay();

export function addDays(date: string, n: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sunday-based weeks, like GitHub's calendar. The first and last week may be partial. */
export function toWeeks(days: DayCount[]): DayCount[][] {
  const out: DayCount[][] = [];
  const offset = days.length ? weekday(days[0]!.date) : 0;
  days.forEach((d, i) => {
    (out[Math.floor((i + offset) / 7)] ??= []).push(d);
  });
  return out;
}

export interface Summary {
  total: number;
  activeDays: number;
  /** Consecutive active days ending today; if today has no activity yet, ending yesterday. */
  currentStreak: number;
  longestStreak: number;
  bestDay: DayCount;
}

export function summarize(days: DayCount[]): Summary {
  let total = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let run = 0;
  let bestDay = days[0]!;
  for (const d of days) {
    total += d.count;
    if (d.count > 0) activeDays++;
    run = d.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
    if (d.count > bestDay.count) bestDay = d;
  }
  let i = days.length - 1;
  if (i >= 0 && days[i]!.count === 0) i--; // today isn't over yet
  let currentStreak = 0;
  while (i >= 0 && days[i]!.count > 0) {
    currentStreak++;
    i--;
  }
  return { total, activeDays, currentStreak, longestStreak, bestDay };
}

/** Hours in display order: the chart's "day" starts at 06:00 so the night is contiguous. */
export const HOUR_ORDER = [...Array(24).keys()].map((k) => (k + 6) % 24);
export const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4];

/** Busiest contiguous window of `span` hours (wrapping midnight). Ties go to the earliest start in HOUR_ORDER. */
export function peakWindow(hist: number[], span = 4): { start: number; total: number } {
  let best = { start: HOUR_ORDER[0]!, total: -1 };
  for (const start of HOUR_ORDER) {
    let total = 0;
    for (let k = 0; k < span; k++) total += hist[(start + k) % 24] ?? 0;
    if (total > best.total) best = { start, total };
  }
  return best;
}

/** Share of commits made between 22:00 and 04:59. */
export function nightShare(hist: number[]): number {
  const total = hist.reduce((a, v) => a + v, 0);
  return total ? NIGHT_HOURS.reduce((a, h) => a + (hist[h] ?? 0), 0) / total : 0;
}

export const formatHour = (h: number): string => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Week index of every first-of-month inside the range, for axis labels. */
export function monthStarts(days: DayCount[]): { week: number; month: number; label: string }[] {
  const offset = days.length ? weekday(days[0]!.date) : 0;
  const out: { week: number; month: number; label: string }[] = [];
  days.forEach((d, i) => {
    if (!d.date.endsWith('-01')) return;
    const month = Number(d.date.slice(5, 7)) - 1;
    out.push({ week: Math.floor((i + offset) / 7), month, label: MONTHS[month]! });
  });
  return out;
}

/** Number of whole weeks since 1970-01-04 (a Sunday). Stable identity for a calendar week. */
export const epochWeek = (date: string): number => Math.floor((toDate(date).getTime() / 86400000 - 3) / 7);
