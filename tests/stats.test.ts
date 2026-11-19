import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, epochWeek, formatHour, level, monthStarts, nightShare, peakWindow, summarize, toWeeks, weekday } from '../scripts/lib/stats.ts';
import type { DayCount } from '../scripts/lib/types.ts';

const series = (start: string, counts: number[]): DayCount[] => counts.map((count, i) => ({ date: addDays(start, i), count }));

test('level thresholds: 0 / 1 / 2-3 / 4-8 / 9-29 / 30+', () => {
  const cases: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [8, 3], [9, 4], [29, 4], [30, 5], [500, 5]];
  for (const [count, expected] of cases) assert.equal(level(count), expected, `count ${count}`);
});

test('higher counts never get a lower level', () => {
  for (let c = 0; c < 200; c++) assert.ok(level(c + 1) >= level(c));
});

test('weekday and addDays use calendar dates, not local time', () => {
  assert.equal(weekday('2025-11-16'), 0); // Sunday
  assert.equal(weekday('2026-11-18'), 3); // Wednesday
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});

test('toWeeks splits on Sundays and keeps partial first/last weeks', () => {
  const days = series('2026-01-01', Array(10).fill(1)); // Thu → Sat next week
  const weeks = toWeeks(days);
  assert.deepEqual(weeks.map((w) => w.length), [3, 7]);
  assert.equal(weeks[1]![0]!.date, '2026-01-04');
});

test('summarize: totals, active days, best day, streaks', () => {
  const s = summarize(series('2026-01-01', [0, 2, 3, 0, 1, 1, 1, 5]));
  assert.equal(s.total, 13);
  assert.equal(s.activeDays, 6);
  assert.equal(s.longestStreak, 4);
  assert.equal(s.currentStreak, 4);
  assert.deepEqual(s.bestDay, { date: '2026-01-08', count: 5 });
});

test('current streak ignores an empty "today" but breaks on an empty yesterday', () => {
  assert.equal(summarize(series('2026-01-01', [1, 1, 1, 0])).currentStreak, 3);
  assert.equal(summarize(series('2026-01-01', [1, 1, 0, 0])).currentStreak, 0);
});

test('peakWindow wraps midnight and breaks ties by the 06:00-based order', () => {
  const hist = Array(24).fill(0);
  hist[23] = 5;
  hist[0] = 5;
  hist[1] = 5;
  assert.deepEqual(peakWindow(hist), { start: 22, total: 15 });
  assert.equal(peakWindow(Array(24).fill(1)).start, 6);
});

test('nightShare counts 22:00-04:59', () => {
  const hist = Array(24).fill(0);
  hist[22] = 1;
  hist[4] = 1;
  hist[5] = 1;
  hist[12] = 1;
  assert.equal(nightShare(hist), 0.5);
  assert.equal(nightShare(Array(24).fill(0)), 0);
});

test('formatHour', () => {
  assert.deepEqual([0, 9, 12, 21].map(formatHour), ['12 am', '9 am', '12 pm', '9 pm']);
});

test('monthStarts finds first-of-month weeks', () => {
  const days = series('2026-01-25', Array(40).fill(0));
  assert.deepEqual(monthStarts(days), [{ week: 1, month: 1, label: 'Feb' }, { week: 5, month: 2, label: 'Mar' }]);
});

test('epochWeek is the same for every day of a Sunday-based week', () => {
  const w = epochWeek('2026-11-15');
  for (let i = 0; i < 7; i++) assert.equal(epochWeek(addDays('2026-11-15', i)), w);
  assert.equal(epochWeek('2026-11-22'), w + 1);
});
