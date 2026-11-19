/**
 * Renders the README graphics from a snapshot. Pure and deterministic: same snapshot in, same bytes out.
 *
 *   npm run generate                                   data/snapshot.json → assets/generated/
 *   npm run generate -- --data data/sample-data.json --out preview/sample
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fromRoot, loadConfig, loadSnapshot } from './lib/config.ts';
import { renderCity } from './render/city.ts';
import { renderHours } from './render/hours.ts';
import { renderNvim } from './render/nvim.ts';
import { renderStatusline } from './render/statusline.ts';
import { parse, plainText } from './lib/markdown.ts';
import { esc } from './lib/svg.ts';
import type { ProfileConfig, Snapshot } from './lib/types.ts';

export const OUTPUTS = [
  'city.svg', 'city-mobile.svg', 'intro.svg', 'intro-mobile.svg',
  'commit-hours.svg', 'commit-hours-mobile.svg', 'statusline.svg', 'statusline-mobile.svg',
] as const;

export const readIntro = (): string => readFileSync(fromRoot('content/intro.md'), 'utf8');

/** The intro is an image, so README's alt text carries the same words for screen readers and search. */
export function syncReadmeAlt(readme: string, intro: string): string {
  const alt = esc(`About me: ${plainText(parse(intro))}`);
  return readme.replace(/(<img src="assets\/generated\/intro\.svg"[^>]*? alt=")[^"]*(")/, `$1${alt}$2`);
}

export function renderAll(snap: Snapshot, config: ProfileConfig, intro: string): Record<(typeof OUTPUTS)[number], string> {
  return {
    'city.svg': renderCity(snap, 'desktop'),
    'city-mobile.svg': renderCity(snap, 'mobile'),
    'intro.svg': renderNvim(snap, intro, 'desktop'),
    'intro-mobile.svg': renderNvim(snap, intro, 'mobile'),
    'commit-hours.svg': renderHours(snap, 'desktop'),
    'commit-hours-mobile.svg': renderHours(snap, 'mobile'),
    'statusline.svg': renderStatusline(snap, config, intro, 'desktop'),
    'statusline-mobile.svg': renderStatusline(snap, config, intro, 'mobile'),
  };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { data: { type: 'string' }, out: { type: 'string' } } });
  const dataFile = path.resolve(values.data ?? fromRoot('data/snapshot.json'));
  const outDir = path.resolve(values.out ?? fromRoot('assets/generated'));
  const snap = loadSnapshot(dataFile);
  if (snap.source === 'sample' && outDir === fromRoot('assets/generated')) {
    console.error('Refusing to write sample data into assets/generated (it would be published). Use --out preview/sample.');
    process.exit(1);
  }
  const intro = readIntro();
  const files = renderAll(snap, loadConfig(), intro);
  mkdirSync(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    const file = path.join(outDir, name);
    const changed = !existsSync(file) || readFileSync(file, 'utf8') !== svg;
    if (changed) writeFileSync(file, svg);
    console.log(`${changed ? 'wrote    ' : 'unchanged'} ${path.relative(process.cwd(), file)} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`);
  }
  if (outDir === fromRoot('assets/generated')) {
    const readmeFile = fromRoot('README.md');
    const readme = readFileSync(readmeFile, 'utf8');
    const synced = syncReadmeAlt(readme, intro);
    if (synced !== readme) {
      writeFileSync(readmeFile, synced);
      console.log('wrote     README.md (intro alt text)');
    }
  }
}
