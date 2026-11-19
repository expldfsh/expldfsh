/**
 * The night city. Encoding (see docs/GENERATOR.md):
 *   - one building per calendar week (Sunday-based, like GitHub's graph), oldest on the left;
 *   - one window per day, Sunday at the top row; window colour = activity level of that day;
 *   - building height above the window band = log-scaled total of that week.
 * Everything else (stars, far skyline, tower, lamps, river) is decoration and carries no data.
 */
import { scene, tn, WINDOW_RAMP } from '../lib/palette.ts';
import { rand } from '../lib/random.ts';
import { epochWeek, formatDate, level, monthStarts, summarize, toWeeks, weekday } from '../lib/stats.ts';
import { f, monoWidth, rect, svgDocument, text } from '../lib/svg.ts';
import type { Snapshot } from '../lib/types.ts';
import { moon, stars } from './sky.ts';

export type Variant = 'desktop' | 'mobile';

interface CityLayout {
  W: number;
  H: number;
  x0: number;
  slot: number;
  bw: number;
  winX: number;
  winW: number;
  winH: number;
  pitch: number;
  glow: number;
  groundFloor: number;
  base: number;
  maxExtra: number;
  topPad: number;
  bankH: number;
  stripY: number;
  titleSize: number;
  titleY: number;
  subSize: number;
  subY: number;
  moon: [number, number, number];
  stars: number;
  starsMaxY: number;
  far: { minW: number; maxW: number; minH: number; maxH: number };
  tower: { x: number; h: number; half: number };
  monthFont: number;
  /** Label every month (1) or only odd-numbered months Jan/Mar/May… (2) — stable as the window slides. */
  monthEvery: 1 | 2;
  weekdayLabels: boolean;
  /** Size of small decorations relative to desktop. */
  s: number;
  reflections: { moonBars: number; moonGap: number; lampGap: number; waterLines: number };
}

const LAYOUT: Record<Variant, CityLayout> = {
  desktop: {
    W: 880, H: 480, x0: 47, slot: 15, bw: 13, winX: 3, winW: 7, winH: 5, pitch: 8, glow: 2, groundFloor: 7,
    base: 296, maxExtra: 118, topPad: 5, bankH: 16, stripY: 416, titleSize: 30, titleY: 60, subSize: 11, subY: 82,
    moon: [786, 70, 17], stars: 90, starsMaxY: 220, far: { minW: 18, maxW: 44, minH: 30, maxH: 100 },
    tower: { x: 205, h: 168, half: 13 }, monthFont: 8.5, monthEvery: 1, weekdayLabels: true, s: 1,
    reflections: { moonBars: 10, moonGap: 9, lampGap: 5, waterLines: 14 },
  },
  mobile: {
    W: 440, H: 440, x0: 35, slot: 7, bw: 6, winX: 1, winW: 4, winH: 3, pitch: 5, glow: 1, groundFloor: 4,
    base: 226, maxExtra: 66, topPad: 3, bankH: 14, stripY: 296, titleSize: 22, titleY: 40, subSize: 10, subY: 57,
    moon: [398, 42, 11], stars: 55, starsMaxY: 150, far: { minW: 9, maxW: 22, minH: 16, maxH: 52 },
    tower: { x: 102, h: 92, half: 7 }, monthFont: 9, monthEvery: 2, weekdayLabels: false, s: 0.5,
    reflections: { moonBars: 6, moonGap: 8, lampGap: 4, waterLines: 8 },
  },
};

const r = Math.round;

export function renderCity(snap: Snapshot, variant: Variant): string {
  const L = LAYOUT[variant];
  const { W, H, x0, slot, bw, pitch, base, s } = L;
  const days = snap.calendar.days;
  const weeks = toWeeks(days);
  const sum = summarize(days);
  const bandTop = base - L.groundFloor - 7 * pitch;
  const upperBottom = bandTop - L.topPad;
  const weekly = weeks.map((w) => w.reduce((a, d) => a + d.count, 0));
  const maxWeek = Math.max(1, ...weekly);
  const riverTop = base + L.bankH;
  const riverH = L.stripY - riverTop;
  const [moonX, moonY, moonR] = L.moon;
  const range = `${formatDate(snap.calendar.startDate)} – ${formatDate(snap.calendar.endDate)}`;
  const subline = snap.source === 'sample' ? `SAMPLE DATA · ${range}` : range;

  const defs = [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.skyTop}"/><stop offset=".7" stop-color="${tn.bg}"/><stop offset="1" stop-color="${scene.skyHorizon}"/></linearGradient>`,
    `<linearGradient id="hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tn.magenta}" stop-opacity="0"/><stop offset="1" stop-color="${tn.magenta}" stop-opacity=".09"/></linearGradient>`,
    `<linearGradient id="riv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.riverTop}"/><stop offset="1" stop-color="${scene.riverBottom}"/></linearGradient>`,
    `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".85" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<pattern id="floors" x="${x0}" y="${upperBottom}" width="${slot}" height="${pitch}" patternUnits="userSpaceOnUse">`,
    rect(1, 0, bw - 2, 1, scene.floorLine),
    variant === 'desktop' ? rect(5, 2, 1, 4, scene.floorShade) : '',
    `</pattern>`,
    `<pattern id="stripes" width="4" height="3" patternUnits="userSpaceOnUse">${rect(0, 0, 4, 2, '#fff')}</pattern>`,
    `<mask id="ripple">${rect(0, riverTop, W, riverH, 'url(#stripes)')}</mask>`,
    `<mask id="fadeout">${rect(0, riverTop, W, riverH, 'url(#fade)')}</mask>`,
    `<clipPath id="river">${rect(0, riverTop, W, riverH, '#000')}</clipPath>`,
  ].join('');

  const body: string[] = [rect(0, 0, W, H, 'url(#sky)')];

  // --- sky -------------------------------------------------------------------------------
  const titleBox = {
    x0: x0 - 6,
    y0: L.titleY - L.titleSize,
    x1: x0 + Math.max(monoWidth(snap.login, L.titleSize), monoWidth(subline, L.subSize)) + 10,
    y1: L.subY + 6,
  };
  const moonBox = { x0: moonX - moonR * 1.4, y0: moonY - moonR * 1.4, x1: moonX + moonR * 1.4, y1: moonY + moonR * 1.4 };
  body.push(stars(L.stars, { x0: 10, y0: 8, x1: W - 10, y1: L.starsMaxY }, `city-${variant}`, [titleBox, moonBox]));
  body.push(moon(moonX, moonY, moonR));

  // --- distant skyline (decoration, fixed shape) ----------------------------------------
  const far: string[] = [];
  for (let x = r(20 * s), k = 0; x < W; k++) {
    const w = L.far.minW + Math.floor(rand('far', k) * (L.far.maxW - L.far.minW));
    const h = L.far.minH + Math.floor(rand('farh', k) * (L.far.maxH - L.far.minH));
    far.push(rect(x, base - h, w, h, scene.farBuilding));
    x += w + 2;
  }
  const T = L.tower;
  far.push(
    `<polygon points="${T.x - T.half},${base} ${T.x - r(2 * s)},${base - T.h} ${T.x + r(2 * s)},${base - T.h} ${T.x + T.half},${base}" fill="${scene.tower}"/>`,
    rect(T.x - r(6 * s), r(base - T.h * 0.55), r(12 * s), r(4 * s), scene.towerBand),
    rect(T.x - r(4 * s), r(base - T.h * 0.8), r(8 * s), r(3 * s), scene.towerBand),
    rect(T.x, base - T.h - r(12 * s), 1, r(12 * s), scene.towerBand),
    rect(T.x - 1, base - T.h - r(12 * s) - 2, 3, 2, tn.red, 'class="bl"'),
  );
  body.push(`<g opacity=".9">${far.join('')}</g>`, rect(0, base - 150 * s, W, 150 * s, 'url(#hz)'));

  // --- the data: buildings and windows ---------------------------------------------------
  const city: string[] = [];
  weeks.forEach((week, i) => {
    const bx = x0 + i * slot;
    const ew = epochWeek(week[0]!.date); // stable identity: roofs don't reshuffle as the year slides
    const extra = r((Math.log1p(weekly[i]!) / Math.log1p(maxWeek)) * L.maxExtra);
    const top = upperBottom - extra;
    const face = ew % 2 ? scene.faceA : scene.faceB;
    city.push(rect(bx, top, bw, base - top, face));
    if (upperBottom - top > 2) city.push(rect(bx, top + 2, bw, upperBottom - top - 2, 'url(#floors)'));
    city.push(rect(bx + bw - 1, top, 1, base - top, scene.faceEdge));

    const roll = rand('roof', ew);
    const mid = bx + r(bw / 2);
    if (i === weeks.length - 1 && week.length < 7) {
      // the current week is still being built
      const ch = r(30 * s);
      const jib = r(16 * s);
      city.push(
        rect(mid - 2, top - ch, 1, ch, tn.terminalBlack),
        rect(mid - 2 - jib, top - ch, jib + r(14 * s), 1, tn.terminalBlack),
        rect(mid - 1 - jib, top - ch + 1, 1, r(9 * s), tn.dark3),
        rect(mid - 2 - jib, top - ch + 1 + r(9 * s), 3, 2, tn.dark3),
        rect(mid - 3 + r(14 * s), top - ch - 2, 2, 2, tn.red, 'class="bl"'),
      );
    } else if (extra > L.maxExtra * 0.47 && roll < 0.3) {
      const ah = r((8 + rand('ant', ew) * 10) * s) + 2;
      city.push(
        rect(mid - 1, top - ah, 1, ah, tn.terminalBlack),
        rect(mid - 2, top - ah - 2, 3, 2, tn.red, `class="bl" style="animation-delay:-${f(rand('bl', ew) * 2.4)}s"`),
      );
    } else if (roll < 0.5) {
      const sh = Math.max(2, r(5 * s));
      city.push(rect(bx + r(2 * s), top - sh, bw - 2 * r(2 * s), sh, face), rect(bx + bw - 1 - r(2 * s), top - sh, 1, sh, scene.faceEdge));
    } else if (roll < 0.66) {
      const tw = Math.max(2, r(5 * s));
      const th = Math.max(2, r(4 * s));
      city.push(rect(bx + r(3 * s), top - th - 1, tw, th, scene.roofTank), rect(bx + r(3 * s), top - 1, 1, 1, scene.roofTank), rect(bx + r(3 * s) + tw - 1, top - 1, 1, 1, scene.roofTank));
    } else if (roll < 0.78) {
      for (let k = 0; k < 3; k++) city.push(rect(bx + k * r(2 * s), top - 3 + k, bw - 2 * k * r(2 * s), 1, face));
    } else {
      city.push(rect(bx, top, bw, 1, scene.faceEdge));
    }

    for (const d of week) {
      const lv = level(d.count);
      const wx = bx + L.winX;
      const wy = bandTop + weekday(d.date) * pitch + 1;
      if (lv === 5) city.push(rect(wx - L.glow, wy - L.glow, L.winW + 2 * L.glow, L.winH + 2 * L.glow, tn.yellow, 'opacity=".18"'));
      const flicker = lv >= 3 && rand('flicker', d.date) > 0.93 ? `class="fl" style="animation-delay:-${f(rand('fd', d.date) * 7)}s"` : '';
      city.push(rect(wx, wy, L.winW, L.winH, WINDOW_RAMP[lv]!, flicker));
    }
  });
  body.push(`<g id="city">${city.join('')}</g>`);

  // --- promenade: month labels and street lamps ------------------------------------------
  body.push(rect(0, base, W, L.bankH, scene.bank), rect(0, base, W, 1, tn.gutter), rect(0, base + L.bankH - 1, W, 1, scene.bankEdge));
  const labelY = base + r(L.bankH / 2 + L.monthFont * 0.35);
  const labelled: number[] = [];
  for (const m of monthStarts(days)) {
    if (L.monthEvery === 2 && m.month % 2 === 1) continue;
    const x = x0 + m.week * slot;
    if (x + monoWidth(m.label, L.monthFont) > W - 4) continue;
    if (labelled.length && x - labelled.at(-1)! < monoWidth('MMM', L.monthFont) + 6) continue;
    labelled.push(x);
    body.push(text(x, labelY, m.label, `class="t" font-size="${L.monthFont}" fill="${tn.dark3}"`));
  }
  if (L.weekdayLabels) {
    for (const [row, label] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']] as const) {
      body.push(text(x0 - 6, bandTop + row * pitch + 6, label, `class="t" font-size="7.5" fill="${tn.dark3}" text-anchor="end"`));
    }
  }
  const lamps = labelled.slice(1).map((x, k) => r((labelled[k]! + x) / 2) + r(6 * s));
  const lampSvg: string[] = [];
  const lampReflections: string[] = [];
  lamps.forEach((lx, k) => {
    lampSvg.push(
      rect(lx - 3, base + 1, 7, 5, tn.yellow, 'opacity=".16"'),
      rect(lx, base + 5, 1, L.bankH - 6, tn.dark3),
      rect(lx - 1, base + 2, 3, 1, tn.dark3),
      rect(lx - 1, base + 3, 3, 2, scene.lampLight, `class="fl" style="animation-delay:-${f(k * 1.3)}s"`),
    );
    for (let j = 0; j < 5; j++) {
      const ww = 5 - j;
      lampReflections.push(rect(r(lx + 0.5 - ww / 2), riverTop + 3 + j * L.reflections.lampGap, ww, 1, tn.yellow, `opacity="${f(0.4 - j * 0.07)}" class="sh" style="animation-delay:-${f((k + j) * 0.5)}s"`));
    }
  });

  // --- river: reflection of the city, the moon and the lamps -----------------------------
  body.push(
    rect(0, riverTop, W, riverH, 'url(#riv)'),
    `<g clip-path="url(#river)"><g mask="url(#fadeout)"><g mask="url(#ripple)" opacity=".34">`,
    `<use href="#city" transform="translate(0,${riverTop + base}) scale(1,-1)"/></g></g></g>`,
  );
  const RF = L.reflections;
  for (let k = 0; k < RF.moonBars; k++) {
    const ww = (24 - k * 2) * (variant === 'desktop' ? 1 : 0.6);
    body.push(rect(r(moonX - ww / 2), riverTop + 6 + k * RF.moonGap, r(ww), 1, tn.fg, `opacity="${f(0.42 - k * 0.038)}" class="sh" style="animation-delay:-${f(k * 0.6)}s"`));
  }
  for (let k = 0; k < RF.waterLines; k++) {
    const wx = 20 + rand('water', k) * (W - 60);
    const wy = riverTop + 10 + rand('water-y', k) * (riverH - 20);
    body.push(rect(r(wx), r(wy), r((12 + rand('water-w', k) * 26) * (variant === 'desktop' ? 1 : 0.6)), 1, tn.blue, `opacity=".07" class="sh" style="animation-delay:-${f(k * 0.7)}s"`));
  }
  body.push(lampReflections.join(''), lampSvg.join(''));

  // --- title -------------------------------------------------------------------------------
  body.push(
    text(x0, L.titleY, snap.login, `class="t" font-size="${L.titleSize}" font-weight="700" fill="${tn.fg}"`),
    text(x0 + 1, L.subY, subline, `class="t" font-size="${L.subSize}" fill="${snap.source === 'sample' ? tn.red : tn.comment}" letter-spacing=".6"`),
  );

  // --- stats + legend ------------------------------------------------------------------
  body.push(rect(0, L.stripY, W, H - L.stripY, tn.bgDarker), rect(0, L.stripY, W, 1, tn.highlight));
  const stats: [string, string][] = [
    [sum.total.toLocaleString('en-US'), 'CONTRIBUTIONS'],
    [String(sum.activeDays), 'ACTIVE DAYS'],
    [String(sum.currentStreak), 'DAY STREAK'],
    [String(sum.bestDay.count), 'BEST DAY'],
  ];
  const legend = (lx: number, ly: number, size: number) => {
    const out = [text(lx, ly, 'less', `class="t" font-size="${size}" fill="${tn.dark5}"`)];
    const sx = lx + monoWidth('less', size) + 8;
    for (let lv = 0; lv < 6; lv++) {
      out.push(rect(sx + lv * 15, ly - 8, 11, 9, scene.windowFrame), rect(sx + lv * 15 + 2, ly - 6, 7, 5, WINDOW_RAMP[lv]!));
    }
    out.push(text(sx + 6 * 15 + 4, ly, 'more', `class="t" font-size="${size}" fill="${tn.dark5}"`));
    return out.join('');
  };
  const legendWidth = (size: number) => monoWidth('less', size) + 8 + 6 * 15 + 4 + monoWidth('more', size);
  if (variant === 'desktop') {
    stats.forEach(([v, l], k) => {
      body.push(text(x0 + k * 138, L.stripY + 30, v, 'class="v" font-size="22"'), text(x0 + k * 138, L.stripY + 47, l, 'class="l" font-size="10"'));
    });
    const right = W - x0;
    body.push(legend(right - legendWidth(10), L.stripY + 30, 10));
    body.push(text(right, L.stripY + 47, '1 window = 1 day · height = weekly total', `class="t" font-size="9.5" fill="${tn.comment}" text-anchor="end"`));
  } else {
    stats.forEach(([v, l], k) => {
      const cx = x0 + (k % 2) * 190;
      const cy = L.stripY + 36 + Math.floor(k / 2) * 52;
      body.push(text(cx, cy, v, 'class="v" font-size="22"'), text(cx, cy + 18, l, 'class="l" font-size="12"'));
    });
    body.push(legend(x0, L.stripY + 132, 11));
    body.push(text(W - x0, L.stripY + 132, '1 window = 1 day', `class="t" font-size="11" fill="${tn.comment}" text-anchor="end"`));
  }

  return svgDocument({
    width: W,
    height: H,
    title: `${snap.login}: ${sum.total.toLocaleString('en-US')} contributions, ${range}`,
    desc:
      `A night skyline drawn from GitHub contributions between ${snap.calendar.startDate} and ${snap.calendar.endDate}. ` +
      `Each building is one week (taller means more contributions that week); each window is one day, brighter means more. ` +
      `${sum.activeDays} active days, current streak ${sum.currentStreak} days, best day ${sum.bestDay.count} contributions on ${sum.bestDay.date}.`,
    defs,
    body: body.join(''),
  });
}
