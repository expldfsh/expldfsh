/** Tokyo Night "Moon" palette (folke/tokyonight.nvim), plus a few derived scene tones. */
export const tn = {
  bg: '#222436',
  bgDark: '#1e2030',
  bgDarker: '#191b29',
  highlight: '#2f334d',
  gutter: '#3b4261',
  terminalBlack: '#444a73',
  dark3: '#545c7e',
  comment: '#636da6',
  dark5: '#737aa2',
  fgDark: '#828bb8',
  fg: '#c8d3f5',
  blue: '#82aaff',
  cyan: '#86e1fc',
  magenta: '#c099ff',
  yellow: '#ffc777',
  red: '#ff757f',
} as const;

export const scene = {
  skyTop: '#1a1b2a',
  skyHorizon: '#2a2747',
  moon: '#e4e9ff',
  moonCrater: '#cdd5f7',
  farBuilding: '#262940',
  tower: '#272a42',
  towerBand: '#2c3049',
  faceA: '#2a2d44',
  faceB: '#2d3049',
  faceEdge: '#3a3f5e',
  floorLine: '#363a58',
  floorShade: '#25283c',
  roofTank: '#34385a',
  bank: '#1c1e2e',
  bankEdge: '#2a2d43',
  riverTop: '#1d1f30',
  riverBottom: '#161824',
  lampLight: '#ffd9a0',
  windowFrame: '#2a2d44',
} as const;

/** Window light per activity level 0-5: unlit → deep blue → blue → moonlight → warm gold. */
export const WINDOW_RAMP = ['#1a1c2b', '#323d66', '#4b65b3', '#82aaff', '#c8d3f5', '#ffc777'] as const;

export const MONO = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
