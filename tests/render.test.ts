import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XMLValidator } from 'fast-xml-parser';
import { assertSnapshot, fromRoot, loadConfig, loadSnapshot } from '../scripts/lib/config.ts';
import { esc } from '../scripts/lib/svg.ts';
import { level, toWeeks, weekday } from '../scripts/lib/stats.ts';
import { WINDOW_RAMP } from '../scripts/lib/palette.ts';
import { readIntro, renderAll, syncReadmeAlt } from '../scripts/generate.ts';
import type { Snapshot } from '../scripts/lib/types.ts';

const sample = loadSnapshot(fromRoot('data/sample-data.json'));
const config = loadConfig();
const intro = readIntro();
const render = (snap: Snapshot = sample, text = intro) => renderAll(snap, config, text);

test('rendering is deterministic', () => {
  assert.deepEqual(render(), render(structuredClone(sample)));
});

test('every output is well-formed, self-contained SVG', () => {
  for (const [name, svg] of Object.entries(render())) {
    assert.equal(XMLValidator.validate(svg), true, name);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has a bad number`);
    assert.ok(!/(?:href|src)="(?!#)/.test(svg), `${name} references something external`);
    assert.ok(svg.length < 120 * 1024, `${name} is too large`);
  }
});

test('sample data is labelled as such in the main image', () => {
  assert.match(render()['city.svg'], /SAMPLE DATA/);
});

test('each day becomes one window whose colour matches its level', () => {
  const svg = render()['city.svg'];
  const city = svg.slice(svg.indexOf('<g id="city">'), svg.indexOf('</g>', svg.indexOf('<g id="city">')));
  const windows = [...city.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="7" height="5" fill="(#[0-9a-f]{6})"/g)];
  assert.equal(windows.length, sample.calendar.days.length);
  const expected = toWeeks(sample.calendar.days).flatMap((w) => w.map((d) => WINDOW_RAMP[level(d.count)]));
  assert.deepEqual(windows.map((m) => m[2]), expected);
  const first = sample.calendar.days[0]!;
  const sunday = windows.find((_, i) => weekday(sample.calendar.days[i]!.date) === 0)!;
  assert.equal(Number(windows[0]![1]) - Number(sunday[1]), weekday(first.date) * 8);
});

test('the intro window shows every word of content/intro.md', () => {
  const svg = render()['intro.svg'];
  const shown = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]).join('');
  for (const word of ['Specialist', 'Languages:', 'LazyVim', 'algorithm']) assert.ok(shown.includes(word), word);
  assert.ok(!shown.includes('**'), 'bold markers are concealed');
});

test('dynamic text is escaped', () => {
  assert.equal(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  const evil: Snapshot = { ...structuredClone(sample), login: 'x<y>&"z' };
  for (const svg of Object.values(render(evil, '### <b>&"\n\n- **a<b** [x&y](https://e.x)'))) assert.equal(XMLValidator.validate(svg), true);
});

test('README alt text is synced from the intro', () => {
  const readme = '<img src="assets/generated/intro.svg" width="100%" alt="old">';
  assert.equal(syncReadmeAlt(readme, '### Hi\n\nI build **things** & "tools"'), '<img src="assets/generated/intro.svg" width="100%" alt="About me: Hi I build things &amp; &quot;tools&quot;">');
});

test('snapshot validation rejects inconsistent data', () => {
  const broken = structuredClone(sample);
  broken.calendar.totalContributions += 1;
  assert.throws(() => assertSnapshot(broken), /totalContributions/);
  const gap = structuredClone(sample);
  gap.calendar.days.splice(10, 1);
  assert.throws(() => assertSnapshot(gap), /consecutive|totalContributions/);
});
