import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XMLValidator } from 'fast-xml-parser';
import { assertSnapshot, fromRoot, loadConfig, loadSnapshot } from '../scripts/lib/config.ts';
import { esc } from '../scripts/lib/svg.ts';
import { level, toWeeks, weekday } from '../scripts/lib/stats.ts';
import { WINDOW_RAMP } from '../scripts/lib/palette.ts';
import { renderAll } from '../scripts/generate.ts';
import type { Snapshot } from '../scripts/lib/types.ts';

const sample = loadSnapshot(fromRoot('data/sample-data.json'));
const config = loadConfig();

test('rendering is deterministic', () => {
  assert.deepEqual(renderAll(sample, config), renderAll(structuredClone(sample), config));
});

test('every output is well-formed, self-contained SVG', () => {
  for (const [name, svg] of Object.entries(renderAll(sample, config))) {
    assert.equal(XMLValidator.validate(svg), true, name);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has a bad number`);
    assert.ok(!/(?:href|src)="(?!#)/.test(svg), `${name} references something external`);
    assert.ok(svg.length < 120 * 1024, `${name} is too large`);
  }
});

test('sample data is labelled as such in the main image', () => {
  assert.match(renderAll(sample, config)['city.svg'], /SAMPLE DATA/);
});

test('each day becomes one window whose colour matches its level', () => {
  const svg = renderAll(sample, config)['city.svg'];
  const city = svg.slice(svg.indexOf('<g id="city">'), svg.indexOf('</g>', svg.indexOf('<g id="city">')));
  const windows = [...city.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="7" height="5" fill="(#[0-9a-f]{6})"/g)];
  assert.equal(windows.length, sample.calendar.days.length);
  const expected = toWeeks(sample.calendar.days).flatMap((w) => w.map((d) => WINDOW_RAMP[level(d.count)]));
  assert.deepEqual(windows.map((m) => m[2]), expected);
  // rows follow the weekday
  const first = sample.calendar.days[0]!;
  const rowY = Number(windows[0]![1]);
  const sunday = windows.find((_, i) => weekday(sample.calendar.days[i]!.date) === 0)!;
  assert.equal(rowY - Number(sunday[1]), weekday(first.date) * 8);
});

test('dynamic text is escaped', () => {
  assert.equal(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  const evil: Snapshot = { ...structuredClone(sample), login: 'x<y>&"z' };
  for (const svg of Object.values(renderAll(evil, config))) assert.equal(XMLValidator.validate(svg), true);
});

test('snapshot validation rejects inconsistent data', () => {
  const broken = structuredClone(sample);
  broken.calendar.totalContributions += 1;
  assert.throws(() => assertSnapshot(broken), /totalContributions/);
  const gap = structuredClone(sample);
  gap.calendar.days.splice(10, 1);
  assert.throws(() => assertSnapshot(gap), /consecutive|totalContributions/);
});
