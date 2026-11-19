/**
 * Writes data/sample-data.json: a synthetic, clearly-labelled snapshot for working on the
 * renderers without a token. Never used for the published graphics (generate.ts refuses).
 */
import { writeFileSync } from 'node:fs';
import { fromRoot, serializeSnapshot } from './lib/config.ts';
import { rand } from './lib/random.ts';
import { addDays } from './lib/stats.ts';
import type { DayCount, Snapshot } from './lib/types.ts';

const start = '2025-01-05'; // a Sunday
const days: DayCount[] = [];
for (let i = 0; i < 366; i++) {
  const date = addDays(start, i);
  const growth = 0.25 + (i / 366) * 1.2;
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ? 0.6 : 1;
  const active = rand('sample-active', date) < 0.55 * growth * weekend;
  const burst = rand('sample-burst', date) > 0.97 ? 6 : 1;
  days.push({ date, count: active ? Math.max(1, Math.floor(rand('sample-n', date) ** 2.4 * 14 * growth * burst)) : 0 });
}
const hoursFrom = (h: number, peak: number) => Math.min(Math.abs(h - peak), 24 - Math.abs(h - peak));
const histogram = Array.from({ length: 24 }, (_, h) =>
  Math.round(4 + 30 * Math.exp(-(hoursFrom(h, 23) ** 2) / 8) + 18 * Math.exp(-(hoursFrom(h, 14) ** 2) / 10)),
);

const snap: Snapshot = {
  schemaVersion: 1,
  source: 'sample',
  login: 'sample-user',
  calendar: { startDate: start, endDate: days.at(-1)!.date, totalContributions: days.reduce((a, d) => a + d.count, 0), days },
  hours: { timezone: 'America/Toronto', since: start, commits: histogram.reduce((a, v) => a + v, 0), repositories: 6, excludedRepositories: 0, histogram },
};
writeFileSync(fromRoot('data/sample-data.json'), serializeSnapshot(snap));
console.log(`Wrote data/sample-data.json (${snap.calendar.totalContributions} synthetic contributions)`);
