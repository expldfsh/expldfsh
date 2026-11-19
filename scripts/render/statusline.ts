/** Neovim/lualine-style status line + message line: the page footer. The README links it to the website. */
import { tn } from '../lib/palette.ts';
import { parse } from '../lib/markdown.ts';
import { esc, f, monoWidth, rect, svgDocument } from '../lib/svg.ts';
import type { ProfileConfig, Snapshot } from '../lib/types.ts';
import type { Variant } from './city.ts';

interface Segment {
  text: string;
  bg: string;
  fg: string;
  bold?: boolean;
  branchIcon?: boolean;
}

const FONT = 12;
const PAD = 14;
const ARROW = 12;
const ICON = 16;

function branchIcon(x: number, mid: number, color: string): string {
  return (
    `<g shape-rendering="geometricPrecision"><g fill="none" stroke="${color}" stroke-width="1.4">` +
    `<path d="M${x} ${mid - 6}V${mid + 6}"/><path d="M${x + 7} ${mid - 4}C${x + 7} ${mid + 1} ${x} ${mid} ${x} ${mid + 4}"/></g>` +
    `<circle cx="${x}" cy="${mid - 6}" r="1.8" fill="${color}"/><circle cx="${x}" cy="${mid + 6}" r="1.8" fill="${color}"/>` +
    `<circle cx="${x + 7}" cy="${mid - 5}" r="1.8" fill="${color}"/></g>`
  );
}

function statuslineBody(snap: Snapshot, config: ProfileConfig, variant: Variant, W: number, H: number): string {
  const host = new URL(config.website).host;
  const synced = `synced ${snap.calendar.endDate}`;
  const left: Segment[] = [{ text: 'NORMAL', bg: tn.blue, fg: tn.bgDark, bold: true }];
  if (variant === 'desktop') {
    left.push({ text: 'main', bg: tn.gutter, fg: tn.fg, branchIcon: true }, { text: 'README.md', bg: tn.highlight, fg: tn.fgDark });
  } else {
    left.push({ text: `${host} ↗`, bg: tn.gutter, fg: tn.fg });
  }
  const right: Segment[] = variant === 'desktop' ? [{ text: `${host} ↗`, bg: tn.highlight, fg: tn.fg }] : [];
  right.push({ text: synced, bg: tn.magenta, fg: tn.bgDark, bold: true });

  const mid = H / 2;
  const width = (s: Segment) => Math.round(monoWidth(s.text, FONT) + 2 * PAD + (s.branchIcon ? ICON : 0));
  const label = (s: Segment, x: number, w: number) => {
    const textStart = x + (s.branchIcon ? ICON : 0);
    const icon = s.branchIcon ? branchIcon(x + PAD + 2, mid, s.fg) : '';
    return `${icon}<text x="${f(textStart + w / 2 - (s.branchIcon ? ICON / 2 : 0))}" y="${f(mid + 4.2)}" class="t" font-size="${FONT}" font-weight="${s.bold ? 700 : 500}" fill="${s.fg}" text-anchor="middle">${esc(s.text)}</text>`;
  };

  const body: string[] = [rect(0, 0, W, H, tn.bgDark)];
  let x = 0;
  left.forEach((s, k) => {
    const w = width(s) + (k ? ARROW / 2 : 0);
    body.push(rect(x, 0, w, H, s.bg), label(s, x + (k ? ARROW / 2 : 0), w - (k ? ARROW / 2 : 0)));
    x += w;
    body.push(`<polygon points="${x},0 ${x + ARROW},${mid} ${x},${H}" fill="${s.bg}" shape-rendering="geometricPrecision"/>`);
  });
  x = W;
  [...right].reverse().forEach((s) => {
    const w = width(s);
    x -= w;
    body.push(
      rect(x, 0, w, H, s.bg),
      `<polygon points="${x},0 ${x - ARROW},${mid} ${x},${H}" fill="${s.bg}" shape-rendering="geometricPrecision"/>`,
      label(s, x, w),
    );
    x -= ARROW;
  });

  return body.join('');
}

/** Status line, then the message line Neovim shows after opening the file (real line/byte counts of the intro). */
export function renderStatusline(snap: Snapshot, config: ProfileConfig, intro: string, variant: Variant): string {
  const W = variant === 'desktop' ? 880 : 440;
  const barH = variant === 'desktop' ? 34 : 32;
  const msgH = 28;
  const font = variant === 'desktop' ? 13.5 : 14;
  const text = intro.replace(/\s+$/, '') + '\n';
  const message = `"README.md" ${parse(intro).length}L, ${Buffer.byteLength(text)}B`;
  const body = [
    rect(0, 0, W, barH + msgH, tn.bg),
    statuslineBody(snap, config, variant, W, barH),
    `<text x="${variant === 'desktop' ? 16 : 12}" y="${f(barH + msgH / 2 + font * 0.36)}" class="t" font-size="${font}" fill="${tn.fgDark}" xml:space="preserve">${esc(message)}</text>`,
  ];
  const host = new URL(config.website).host;
  return svgDocument({
    width: W,
    height: barH + msgH,
    radius: 8,
    title: `${host} — personal website`,
    desc: `Editor-style status line linking to ${config.website}. Graphics last synced with GitHub data on ${snap.calendar.endDate}.`,
    body: body.join(''),
  });
}
