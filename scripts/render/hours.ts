/**
 * Commit-hours strip: 24 columns, one per hour of the day in the configured time zone.
 * The axis starts at 06:00 so the night (22:00–04:59) forms one contiguous shaded block.
 * Column height = commits in that hour relative to the busiest hour.
 */
import { tn, WINDOW_RAMP } from '../lib/palette.ts';
import { formatHour, HOUR_ORDER, nightShare, peakWindow } from '../lib/stats.ts';
import { esc, f, rect, svgDocument, text } from '../lib/svg.ts';
import type { Snapshot } from '../lib/types.ts';
import type { Variant } from './city.ts';
import { stars } from './sky.ts';

interface HoursLayout {
  W: number;
  H: number;
  cx0: number;
  cx1: number;
  baseline: number;
  barW: number;
  maxCells: number;
  bandTop: number;
  axisY: number;
  axisFont: number;
}

const LAYOUT: Record<Variant, HoursLayout> = {
  desktop: { W: 880, H: 150, cx0: 318, cx1: 846, baseline: 112, barW: 11, maxCells: 14, bandTop: 16, axisY: 130, axisFont: 9.5 },
  mobile: { W: 440, H: 236, cx0: 22, cx1: 418, baseline: 198, barW: 10, maxCells: 15, bandTop: 112, axisY: 218, axisFont: 10 },
};

const CELL = 5; // 4px light + 1px gap, like the windows in the city

export function renderHours(snap: Snapshot, variant: Variant): string {
  const L = LAYOUT[variant];
  const hist = snap.hours.histogram;
  const max = Math.max(1, ...hist);
  const step = (L.cx1 - L.cx0) / 24;
  const peak = peakWindow(hist);
  const peakLabel = `${formatHour(peak.start)} – ${formatHour((peak.start + 4) % 24)}`;
  const night = Math.round(nightShare(hist) * 100);
  const commits = snap.hours.commits.toLocaleString('en-US');
  const tz = snap.hours.timezone;

  // One stripe pattern per colour keeps the file small (a bar is a single rect).
  const ramp = [WINDOW_RAMP[1], WINDOW_RAMP[2], WINDOW_RAMP[3], WINDOW_RAMP[5]];
  const defs = ramp
    .map((c, k) => `<pattern id="c${k}" x="0" y="${L.baseline - 6}" width="8" height="${CELL}" patternUnits="userSpaceOnUse">${rect(0, 0, 8, 4, c)}</pattern>`)
    .join('');

  const body: string[] = [rect(0, 0, L.W, L.H, tn.bgDark)];
  const nightX = L.cx0 + HOUR_ORDER.indexOf(22) * step;
  if (variant === 'desktop') body.push(stars(26, { x0: L.cx0 - 20, y0: 6, x1: L.W - 6, y1: 40 }, 'hours'));
  body.push(rect(nightX, L.bandTop, L.cx1 - nightX, L.baseline - L.bandTop, tn.magenta, 'fill-opacity=".05"'));
  body.push(
    `<g shape-rendering="geometricPrecision"><circle cx="${f(L.cx1 - 14)}" cy="${L.bandTop + 14}" r="5" fill="#e4e9ff"/>` +
      `<circle cx="${f(L.cx1 - 12)}" cy="${L.bandTop + 12}" r="5" fill="${tn.bgDark}" fill-opacity=".92"/></g>`,
  );

  HOUR_ORDER.forEach((hour, k) => {
    const c = hist[hour] ?? 0;
    const bx = Math.round(L.cx0 + k * step + (step - L.barW) / 2);
    body.push(rect(bx, L.baseline - 1, L.barW, 1, tn.highlight));
    if (!c) return;
    const cells = Math.max(1, Math.round((c / max) * L.maxCells));
    const t = c / max;
    const tone = c === max ? 3 : t > 0.6 ? 2 : t > 0.3 ? 1 : 0;
    body.push(rect(bx, L.baseline - 1 - CELL * cells, L.barW, CELL * cells - 1, `url(#c${tone})`));
  });
  [0, 6, 12, 18, 24].forEach((k) => {
    const h = HOUR_ORDER[k % 24]!;
    body.push(text(L.cx0 + k * step, L.axisY, `${String(h).padStart(2, '0')}:00`, `class="t" font-size="${L.axisFont}" fill="${tn.dark3}" text-anchor="middle"`));
  });

  const strong = (s: string) => `<tspan fill="${tn.fg}" font-weight="700">${esc(s)}</tspan>`;
  if (variant === 'desktop') {
    body.push(
      text(36, 34, 'COMMIT HOURS', 'class="l" font-size="10"'),
      text(36, 64, peakLabel, 'class="v" font-size="22"'),
      text(36, 82, 'busiest 4-hour window', `class="t" font-size="11" fill="${tn.fgDark}"`),
      `<text x="36" y="110" class="t" font-size="11" fill="${tn.fgDark}">${strong(`${night}%`)} between 10 pm and 5 am</text>`,
      text(36, 130, `${commits} commits · ${tz}`, `class="t" font-size="9.5" fill="${tn.comment}"`),
    );
  } else {
    body.push(
      text(22, 32, 'COMMIT HOURS', 'class="l" font-size="12"'),
      text(22, 62, peakLabel, 'class="v" font-size="24"'),
      text(22, 82, 'busiest 4-hour window', `class="t" font-size="12" fill="${tn.fgDark}"`),
      text(418, 62, `${night}%`, 'class="v" font-size="24" text-anchor="end"'),
      text(418, 82, '10 pm – 5 am', `class="t" font-size="12" fill="${tn.fgDark}" text-anchor="end"`),
      text(22, 104, `${commits} commits · ${tz}`, `class="t" font-size="11" fill="${tn.comment}"`),
    );
  }

  return svgDocument({
    width: L.W,
    height: L.H,
    title: `Commit hours: busiest ${peakLabel}`,
    desc:
      `Hour-of-day distribution of ${commits} commits authored since ${snap.hours.since}, in ${tz}. ` +
      `Busiest 4-hour window: ${peakLabel}. ${night}% of commits were made between 10 pm and 5 am.`,
    defs,
    body: body.join(''),
  });
}
