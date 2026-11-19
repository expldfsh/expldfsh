/**
 * Just enough Markdown for content/intro.md, shown the way Neovim displays it with
 * conceallevel=2: `**` and link URLs are hidden, heading/list markers stay visible.
 */
export type SpanStyle = 'text' | 'bold' | 'link' | 'headingMarker' | 'heading' | 'listMarker';

export interface Span {
  text: string;
  style: SpanStyle;
}

/** One source line of the file. */
export type Line = Span[];

/** One screen row after wrapping. `line` is the 0-based source line it belongs to. */
export interface Row {
  spans: Span[];
  line: number;
  continuation: boolean;
}

const INLINE = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;

function inline(s: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index), style: 'text' });
    out.push(m[1] !== undefined ? { text: m[1], style: 'bold' } : { text: m[2]!, style: 'link' });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), style: 'text' });
  return out;
}

export function parse(md: string): Line[] {
  return md
    .replace(/\s+$/, '')
    .split('\n')
    .map((raw) => {
      const line = raw.replace(/\s+$/, '');
      const heading = /^(#{1,6} )(.*)$/.exec(line);
      if (heading) return [{ text: heading[1]!, style: 'headingMarker' }, { text: heading[2]!, style: 'heading' }];
      const item = /^- (.*)$/.exec(line);
      if (item) return [{ text: '- ', style: 'listMarker' }, ...inline(item[1]!)];
      return line ? inline(line) : [];
    });
}

/** Plain text as a reader would see it (for alt text and <desc>). */
export function plainText(lines: Line[]): string {
  return lines
    .map((l) => l.map((s) => (s.style === 'headingMarker' ? '' : s.text)).join(''))
    .filter(Boolean)
    .join(' ');
}

/** Terminal column width: emoji take two cells, joiners and variation selectors none. */
export function cols(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfe0f || cp === 0x200d) continue;
    n += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1;
  }
  return n;
}

/** Soft-wraps at word boundaries like `:set wrap linebreak`; list items get a hanging indent. */
export function wrap(lines: Line[], maxCols: number): Row[] {
  const rows: Row[] = [];
  lines.forEach((spans, line) => {
    if (!spans.length) {
      rows.push({ spans: [], line, continuation: false });
      return;
    }
    const indent = spans[0]!.style === 'listMarker' ? 2 : 0;
    let current: Span[] = [];
    let col = 0;
    let continuation = false;
    const append = (text: string, style: SpanStyle) => {
      const prev = current.at(-1);
      if (prev && prev.style === style) prev.text += text;
      else current.push({ text, style });
      col += cols(text);
    };
    for (const span of spans) {
      for (const piece of span.text.split(/(?<= )/)) {
        if (col > indent && col + cols(piece.trimEnd()) > maxCols) {
          rows.push({ spans: current, line, continuation });
          continuation = true;
          current = [];
          col = 0;
          if (indent) append(' '.repeat(indent), 'text');
        }
        append(piece, span.style);
      }
    }
    rows.push({ spans: current, line, continuation });
  });
  return rows;
}
