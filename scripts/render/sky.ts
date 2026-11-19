import { scene, tn } from '../lib/palette.ts';
import { rand } from '../lib/random.ts';
import { f } from '../lib/svg.ts';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Deterministic star field. Stars inside any `avoid` box are skipped (titles, the moon). */
export function stars(count: number, area: Box, seed: string, avoid: Box[] = []): string {
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    const x = Math.round(area.x0 + rand(seed, k, 'x') * (area.x1 - area.x0));
    const y = Math.round(area.y0 + rand(seed, k, 'y') ** 1.6 * (area.y1 - area.y0)); // denser high up
    if (avoid.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)) continue;
    const size = rand(seed, k, 's') > 0.88 ? 2 : 1;
    const color = rand(seed, k, 'c') > 0.85 ? tn.cyan : tn.fg;
    const opacity = f(0.25 + rand(seed, k, 'o') * 0.5);
    const twinkle = rand(seed, k, 't') > 0.72 ? ` class="tw" style="animation-delay:-${f(rand(seed, k, 'd') * 5)}s"` : '';
    out.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${opacity}"${twinkle}/>`);
  }
  return out.join('');
}

export function moon(cx: number, cy: number, r: number): string {
  const c = (dx: number, dy: number, rr: number, fill: string, extra = '') =>
    `<circle cx="${f(cx + dx)}" cy="${f(cy + dy)}" r="${f(rr)}" fill="${fill}"${extra}/>`;
  return (
    `<g shape-rendering="geometricPrecision">` +
    c(0, 0, r * 3, tn.blue, ' opacity=".03"') +
    c(0, 0, r * 2, tn.blue, ' opacity=".05"') +
    c(0, 0, r * 1.35, tn.fg, ' opacity=".07"') +
    c(0, 0, r, scene.moon) +
    c(-r * 0.32, -r * 0.22, r * 0.2, scene.moonCrater) +
    c(r * 0.3, r * 0.3, r * 0.14, scene.moonCrater) +
    c(r * 0.38, -r * 0.38, r * 0.09, scene.moonCrater) +
    `</g>`
  );
}
