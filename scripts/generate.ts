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
import { renderStatusline } from './render/statusline.ts';
import type { ProfileConfig, Snapshot } from './lib/types.ts';

export const OUTPUTS = ['city.svg', 'city-mobile.svg', 'commit-hours.svg', 'commit-hours-mobile.svg', 'statusline.svg', 'statusline-mobile.svg'] as const;

export function renderAll(snap: Snapshot, config: ProfileConfig): Record<(typeof OUTPUTS)[number], string> {
  return {
    'city.svg': renderCity(snap, 'desktop'),
    'city-mobile.svg': renderCity(snap, 'mobile'),
    'commit-hours.svg': renderHours(snap, 'desktop'),
    'commit-hours-mobile.svg': renderHours(snap, 'mobile'),
    'statusline.svg': renderStatusline(snap, config, 'desktop'),
    'statusline-mobile.svg': renderStatusline(snap, config, 'mobile'),
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
  const files = renderAll(snap, loadConfig());
  mkdirSync(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    const file = path.join(outDir, name);
    const changed = !existsSync(file) || readFileSync(file, 'utf8') !== svg;
    if (changed) writeFileSync(file, svg);
    console.log(`${changed ? 'wrote    ' : 'unchanged'} ${path.relative(process.cwd(), file)} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`);
  }
}
