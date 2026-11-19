/**
 * Deterministic pseudo-random number in [0, 1) derived from the given keys (cyrb53 hash).
 * Decorations are keyed by stable things such as a week's start date, so the scene does not
 * reshuffle between builds and a building keeps its roof as it scrolls left over the year.
 */
export function rand(...keys: (string | number)[]): number {
  const s = keys.join('|');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) / 2 ** 53;
}
