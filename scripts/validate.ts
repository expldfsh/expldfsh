/**
 * Checks everything that gets published: generated SVGs, the README's local paths, the data
 * snapshot, and the workflow file. Exits non-zero on the first category with problems.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { XMLValidator } from 'fast-xml-parser';
import { parse as parseYaml } from 'yaml';
import { fromRoot, loadSnapshot } from './lib/config.ts';
import { OUTPUTS, readIntro, syncReadmeAlt } from './generate.ts';

const problems: string[] = [];
const MAX_BYTES = 120 * 1024;

for (const name of OUTPUTS) {
  const file = fromRoot('assets/generated', name);
  if (!existsSync(file)) {
    problems.push(`${name}: missing (run npm run generate)`);
    continue;
  }
  const svg = readFileSync(file, 'utf8');
  const xml = XMLValidator.validate(svg);
  if (xml !== true) problems.push(`${name}: invalid XML — ${xml.err.msg} (line ${xml.err.line})`);
  if (statSync(file).size > MAX_BYTES) problems.push(`${name}: ${statSync(file).size} bytes exceeds ${MAX_BYTES}`);
  if (!svg.startsWith('<svg ') || !svg.includes('viewBox=')) problems.push(`${name}: not a root <svg> with a viewBox`);
  if (!/<title[^>]*>[^<]+<\/title>/.test(svg)) problems.push(`${name}: missing <title>`);
  if (/<script|<foreignObject|\son\w+=/i.test(svg)) problems.push(`${name}: contains script or event handlers`);
  if (/(?:href|src)="(?!#)/.test(svg) || /url\((?!#)/.test(svg)) problems.push(`${name}: references an external resource`);
  if (/NaN|undefined|Infinity/.test(svg)) problems.push(`${name}: contains NaN/undefined/Infinity`);
}

const readme = readFileSync(fromRoot('README.md'), 'utf8');
const localRefs = [...readme.matchAll(/(?:src|srcset|href)="([^"]+)"/g), ...readme.matchAll(/\]\(([^)]+)\)/g)]
  .map((m) => m[1]!.split('#')[0]!)
  .filter((p) => p && !/^(?:https?:|mailto:)/.test(p));
for (const ref of localRefs) if (!existsSync(fromRoot(ref))) problems.push(`README.md references missing file ${ref}`);
for (const name of OUTPUTS) if (!readme.includes(`assets/generated/${name}`)) problems.push(`README.md does not use assets/generated/${name}`);
if (syncReadmeAlt(readme, readIntro()) !== readme) problems.push('README.md intro alt text is out of date with content/intro.md (run npm run generate)');
for (const m of readme.matchAll(/<img [^>]*>/g)) if (!/alt="[^"]+"/.test(m[0])) problems.push(`README.md image without alt text: ${m[0].slice(0, 60)}…`);

try {
  const snap = loadSnapshot(fromRoot('data/snapshot.json'));
  if (snap.source !== 'github') problems.push('data/snapshot.json is not real GitHub data');
} catch (err) {
  problems.push(`data/snapshot.json: ${(err as Error).message}`);
}

const wfFile = fromRoot('.github/workflows/update-profile.yml');
try {
  const wf = parseYaml(readFileSync(wfFile, 'utf8')) as Record<string, any>;
  if (!wf.on?.schedule?.[0]?.cron) problems.push('workflow: missing schedule');
  if (!('workflow_dispatch' in (wf.on ?? {}))) problems.push('workflow: missing workflow_dispatch');
  const job = Object.values(wf.jobs ?? {})[0] as Record<string, any> | undefined;
  if (job?.permissions?.contents !== 'write') problems.push('workflow: job needs contents: write');
  if (wf.permissions && wf.permissions.contents !== 'read') problems.push('workflow: top-level permissions should be read-only');
} catch (err) {
  problems.push(`workflow: ${(err as Error).message}`);
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ ${OUTPUTS.length} SVGs valid, README paths resolve (${localRefs.length} refs), snapshot and workflow OK`);
