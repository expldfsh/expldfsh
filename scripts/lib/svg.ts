import { MONO, tn } from './palette.ts';

/** Escape text for use in SVG/XML text nodes and attribute values. */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Compact number for coordinates (≤ 2 decimals, no trailing zeros). */
export const f = (v: number): string => String(Math.round(v * 100) / 100);

export function rect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

export function text(x: number, y: number, content: string, attrs: string): string {
  return `<text x="${f(x)}" y="${f(y)}" ${attrs}>${esc(content)}</text>`;
}

/** Shared CSS. Every animated element also carries a static look via attributes, so the image is complete without animation. */
export const BASE_STYLE = `
.t{font-family:${MONO}}
.v{font-family:${MONO};font-weight:700;fill:${tn.fg}}
.l{font-family:${MONO};font-weight:500;fill:${tn.dark5};letter-spacing:1.2px}
.tw{animation:tw 5s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:.85}}
.fl{animation:fl 7s steps(1) infinite}
@keyframes fl{0%,88%,100%{opacity:1}90%{opacity:.35}92%{opacity:1}94%{opacity:.55}}
.bl{animation:bl 2.4s steps(1) infinite}
@keyframes bl{0%,60%{opacity:1}61%,100%{opacity:.15}}
.sh{animation:sh 4s ease-in-out infinite}
@keyframes sh{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

export interface SvgDocOptions {
  width: number;
  height: number;
  title: string;
  desc: string;
  body: string;
  radius?: number;
  defs?: string;
}

export function svgDocument({ width, height, title, desc, body, radius = 12, defs = '' }: SvgDocOptions): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" `,
    `shape-rendering="crispEdges" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc>`,
    `<style>${BASE_STYLE}</style>`,
    `<defs><clipPath id="card"><rect width="${width}" height="${height}" rx="${radius}" shape-rendering="geometricPrecision"/></clipPath>${defs}</defs>`,
    `<g clip-path="url(#card)">${body}</g></svg>\n`,
  ].join('');
}

/** Approximate advance width of monospace text (most UI mono fonts are ~0.6em). */
export const monoWidth = (s: string, size: number): number => [...s].length * size * 0.6;
