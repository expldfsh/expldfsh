import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProfileConfig, Snapshot } from './types.ts';
import { addDays } from './stats.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const fromRoot = (...parts: string[]): string => path.join(ROOT, ...parts);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function loadConfig(file = fromRoot('profile.config.json')): ProfileConfig {
  const c = JSON.parse(readFileSync(file, 'utf8')) as ProfileConfig;
  if (!c.login || !/^[A-Za-z0-9-]+$/.test(c.login)) throw new Error('profile.config.json: invalid "login"');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: c.timezone });
  } catch {
    throw new Error(`profile.config.json: unknown time zone "${c.timezone}"`);
  }
  if (!/^https:\/\//.test(c.website)) throw new Error('profile.config.json: "website" must be an https URL');
  if (!Array.isArray(c.hours?.excludeRepoSha256)) throw new Error('profile.config.json: "hours.excludeRepoSha256" must be an array');
  return c;
}

/** Throws with a precise message if the snapshot is malformed or internally inconsistent. */
export function assertSnapshot(s: unknown): asserts s is Snapshot {
  const fail = (msg: string): never => {
    throw new Error(`Invalid snapshot: ${msg}`);
  };
  if (typeof s !== 'object' || s === null) fail('not an object');
  const snap = s as Snapshot;
  if (snap.schemaVersion !== 1) fail('unsupported schemaVersion');
  if (snap.source !== 'github' && snap.source !== 'sample') fail('source must be "github" or "sample"');
  const cal = snap.calendar;
  if (!cal || !Array.isArray(cal.days) || cal.days.length < 7) fail('calendar.days missing or too short');
  cal.days.forEach((d, i) => {
    if (!DATE.test(d.date)) fail(`bad date at index ${i}`);
    if (!Number.isInteger(d.count) || d.count < 0) fail(`bad count on ${d.date}`);
    if (i > 0 && addDays(cal.days[i - 1]!.date, 1) !== d.date) fail(`days are not consecutive at ${d.date}`);
  });
  if (cal.startDate !== cal.days[0]!.date || cal.endDate !== cal.days.at(-1)!.date) fail('start/end dates do not match days');
  const sum = cal.days.reduce((a, d) => a + d.count, 0);
  if (sum !== cal.totalContributions) fail(`totalContributions (${cal.totalContributions}) != sum of days (${sum})`);
  const h = snap.hours;
  if (!h || !Array.isArray(h.histogram) || h.histogram.length !== 24) fail('hours.histogram must have 24 buckets');
  if (h.histogram.some((v) => !Number.isInteger(v) || v < 0)) fail('hours.histogram has invalid values');
  if (h.histogram.reduce((a, v) => a + v, 0) !== h.commits) fail('hours.commits != sum of histogram');
}

export function loadSnapshot(file: string): Snapshot {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  assertSnapshot(data);
  return data;
}

/** Stable, diff-friendly JSON: one calendar day per line. */
export function serializeSnapshot(s: Snapshot): string {
  const days = s.calendar.days.map((d) => `      ${JSON.stringify(d)}`).join(',\n');
  const cal = { ...s.calendar, days: '__DAYS__' };
  return (
    JSON.stringify({ ...s, calendar: cal }, null, 2).replace('"__DAYS__"', `[\n${days}\n    ]`) + '\n'
  );
}
