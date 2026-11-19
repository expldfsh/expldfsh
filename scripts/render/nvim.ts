/**
 * The intro, drawn as a Neovim window in Tokyo Night Moon: bufferline tabs, relative line numbers,
 * a cursor line, Markdown highlighting with concealed markup and `~` past the end of the buffer.
 * The text comes from content/intro.md. The status line lives at the bottom of the page (statusline.ts).
 */
import { tn } from '../lib/palette.ts';
import { cols, parse, plainText, wrap, type Row, type SpanStyle } from '../lib/markdown.ts';
import { esc, f, rect, svgDocument } from '../lib/svg.ts';
import type { Snapshot } from '../lib/types.ts';
import type { Variant } from './city.ts';

interface NvimLayout {
  W: number;
  font: number;
  lineH: number;
  tabH: number;
  gutterX: number;
  numCols: number;
  padTop: number;
  padBottom: number;
  tildes: number;
  tabs: string[];
}

const LAYOUT: Record<Variant, NvimLayout> = {
  desktop: { W: 880, font: 13.5, lineH: 22, tabH: 30, gutterX: 16, numCols: 3, padTop: 10, padBottom: 8, tildes: 2, tabs: ['README.md', 'city.svg', 'commit-hours.svg'] },
  mobile: { W: 440, font: 14, lineH: 22, tabH: 30, gutterX: 12, numCols: 2, padTop: 8, padBottom: 6, tildes: 1, tabs: ['README.md'] },
};

/** Tokyo Night Moon highlight groups (markdown via treesitter). */
const STYLE: Record<SpanStyle, string> = {
  text: `fill="${tn.fg}"`,
  bold: `fill="${tn.fg}" font-weight="700"`,
  link: `fill="#4fd6be" text-decoration="underline"`,
  headingMarker: `fill="#c3e88d" opacity=".55"`,
  heading: `fill="#c3e88d" font-weight="700"`,
  listMarker: `fill="#89ddff"`,
};
const LINE_NR = tn.gutter;
const CURSOR_LINE_NR = '#ff966c';

export function renderNvim(snap: Snapshot, intro: string, variant: Variant): string {
  const L = LAYOUT[variant];
  const charW = L.font * 0.6;
  const textX = L.gutterX + (L.numCols + 1) * charW + 8;
  const maxCols = Math.floor((L.W - textX - 16) / charW);
  const lines = parse(intro);
  const rows: Row[] = wrap(lines, maxCols);
  const cursorLine = 0; // cursor sits at the start of the file, as when it was just opened

  const bufTop = L.tabH;
  const bufH = L.padTop + (rows.length + L.tildes) * L.lineH + L.padBottom;
  const H = bufTop + bufH;
  const baseline = (row: number) => bufTop + L.padTop + row * L.lineH + L.lineH / 2 + L.font * 0.36;
  const textAttrs = `class="t" font-size="${L.font}" xml:space="preserve"`;

  const body: string[] = [rect(0, 0, L.W, H, tn.bg)];

  // bufferline
  body.push(rect(0, 0, L.W, L.tabH, tn.bgDark));
  let tx = 0;
  L.tabs.forEach((name, k) => {
    const active = k === 0;
    const w = (cols(name) + 5) * charW;
    if (active) body.push(rect(tx, 0, w, L.tabH, tn.bg), rect(tx, 0, 2, L.tabH, tn.blue));
    else body.push(rect(tx + w - 1, 8, 1, L.tabH - 16, tn.highlight));
    const iconColor = name.endsWith('.md') ? tn.blue : tn.yellow;
    body.push(
      rect(tx + 1.5 * charW, L.tabH / 2 - 3, 6, 6, iconColor, active ? '' : 'opacity=".45"'),
      `<text x="${f(tx + 2.5 * charW + 6)}" y="${f(L.tabH / 2 + L.font * 0.36)}" ${textAttrs} fill="${active ? tn.fg : tn.dark3}"${active ? ' font-weight="600"' : ''}>${esc(name)}</text>`,
    );
    tx += w;
  });

  // cursor line, line numbers, text
  const cursorRow = rows.findIndex((r) => r.line === cursorLine);
  body.push(rect(0, bufTop + L.padTop + cursorRow * L.lineH, L.W, L.lineH, tn.highlight));
  const numX = L.gutterX + L.numCols * charW;
  rows.forEach((row, i) => {
    const y = baseline(i);
    if (!row.continuation) {
      const isCursor = row.line === cursorLine;
      const n = isCursor ? row.line + 1 : Math.abs(row.line - cursorLine);
      body.push(
        `<text x="${f(numX)}" y="${f(y)}" ${textAttrs} text-anchor="end" fill="${isCursor ? CURSOR_LINE_NR : LINE_NR}"${isCursor ? ' font-weight="700"' : ''}>${n}</text>`,
      );
    }
    if (row.spans.length) {
      const spans = row.spans.map((s) => `<tspan ${STYLE[s.style]}>${esc(s.text)}</tspan>`).join('');
      body.push(`<text x="${f(textX)}" y="${f(y)}" ${textAttrs}>${spans}</text>`);
    }
  });
  for (let k = 0; k < L.tildes; k++) {
    body.push(`<text x="${L.gutterX}" y="${f(baseline(rows.length + k))}" ${textAttrs} fill="${LINE_NR}">~</text>`);
  }

  // block cursor on the first character (inverted), blinking
  const first = rows[cursorRow]?.spans[0]?.text[0] ?? ' ';
  const cy = bufTop + L.padTop + cursorRow * L.lineH + 3;
  body.push(
    `<g class="cu">${rect(textX, cy, charW, L.lineH - 6, tn.fg)}` +
      `<text x="${f(textX)}" y="${f(baseline(cursorRow))}" ${textAttrs} fill="${tn.bg}">${esc(first)}</text></g>`,
  );

  return svgDocument({
    width: L.W,
    height: H,
    title: `About ${snap.login}`,
    desc: plainText(lines),
    body: body.join(''),
  });
}
