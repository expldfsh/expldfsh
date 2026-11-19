import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cols, parse, plainText, wrap } from '../scripts/lib/markdown.ts';

test('parse conceals bold and link markup, keeps heading and list markers', () => {
  const [h, blank, item] = parse('### Hi 👋\n\n- **Bold:** see [site](https://x.y)\n');
  assert.deepEqual(h, [{ text: '### ', style: 'headingMarker' }, { text: 'Hi 👋', style: 'heading' }]);
  assert.deepEqual(blank, []);
  assert.deepEqual(item, [
    { text: '- ', style: 'listMarker' },
    { text: 'Bold:', style: 'bold' },
    { text: ' see ', style: 'text' },
    { text: 'site', style: 'link' },
  ]);
});

test('plainText drops markup and blank lines', () => {
  assert.equal(plainText(parse('### Hi\n\nOne **two**\n- three')), 'Hi One two - three');
});

test('cols counts emoji as two cells', () => {
  assert.equal(cols('abc'), 3);
  assert.equal(cols('🔭 x'), 4);
  assert.equal(cols('⌨️'), 2);
});

test('wrap breaks at word boundaries with a hanging indent for list items', () => {
  const rows = wrap(parse('- aaaa bbbb cccc dddd'), 12);
  assert.deepEqual(rows.map((r) => r.spans.map((s) => s.text).join('')), ['- aaaa bbbb ', '  cccc dddd']);
  assert.deepEqual(rows.map((r) => r.continuation), [false, true]);
  assert.ok(rows.every((r) => r.line === 0));
});

test('wrap never exceeds the width when words fit', () => {
  const text = 'I like building small, useful tools — lately AI-powered apps and developer utilities — often late at night.';
  for (const width of [30, 46, 98]) {
    for (const row of wrap(parse(text), width)) assert.ok(cols(row.spans.map((s) => s.text).join('').trimEnd()) <= width);
  }
});
