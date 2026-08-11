import { describe, it, expect } from 'vitest';
import type { Doc, Row } from '$data/documents';
import { omegaToPmDoc } from '../editor/bridge';
import { findText } from './search';
import { blockPositionOf } from './selection';

// Find/replace and block lookup became testable when they moved out of the
// runtime in workstream C — before that, searching meant standing up a whole
// DocumentRuntime and its network stack.

function doc(rows: Row[]): Doc {
  return {
    id: 'd',
    projectId: 'p',
    name: 'n',
    base: {
      pageLayout: { width: 612, height: 792, marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72 },
      layoutRules: { maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144 },
      styleRegistry: { definitions: [], defaults: [] },
      rows
    },
    creatorId: '',
    creatorName: '',
    createdAt: '',
    updatedAt: '',
    revision: 1,
    clientCapabilities: { canonicalLayout: true, revisionSubmissions: true }
  };
}

const row = (id: string, text: string): Row => ({
  id: `r-${id}`,
  style: { heightIncrease: 0 },
  blocks: [
    {
      id: `b-${id}`,
      kind: 'text',
      subKind: 'body',
      style: { horizontalAlign: 'left', verticalAlign: 'top' },
      atoms: text ? [{ id: `a-${id}`, kind: 'text', text }] : []
    }
  ]
});

const pmDoc = (rows: Row[]) => omegaToPmDoc(doc(rows));
const plain = { matchCase: false, wholeWord: false, useRegex: false };

describe('findText', () => {
  it('returns nothing for an empty query', () => {
    expect(findText(pmDoc([row('1', 'hello world')]), '', plain)).toEqual([]);
  });

  it('finds every match across blocks, in document order', () => {
    const results = findText(pmDoc([row('1', 'cat and cat'), row('2', 'a cat')]), 'cat', plain);
    expect(results.map((r) => r.blockId)).toEqual(['b-1', 'b-1', 'b-2']);
    expect(results.map((r) => r.block)).toEqual([1, 1, 2]);
  });

  it('reports positions that select exactly the match', () => {
    const d = pmDoc([row('1', 'hello world')]);
    const [hit] = findText(d, 'world', plain);
    expect(d.textBetween(hit.from, hit.to)).toBe('world');
  });

  it('is case-insensitive by default and case-sensitive on request', () => {
    const d = pmDoc([row('1', 'Cat cat CAT')]);
    expect(findText(d, 'cat', plain)).toHaveLength(3);
    expect(findText(d, 'cat', { ...plain, matchCase: true })).toHaveLength(1);
  });

  it('treats the query literally unless useRegex is set', () => {
    const d = pmDoc([row('1', 'a.c abc')]);
    // `.` is escaped, so it matches only the literal dot.
    expect(findText(d, 'a.c', plain).map((r) => r.match)).toEqual(['a.c']);
    expect(findText(d, 'a.c', { ...plain, useRegex: true }).map((r) => r.match)).toEqual([
      'a.c',
      'abc'
    ]);
  });

  it('respects whole-word matching', () => {
    const d = pmDoc([row('1', 'cat catalog')]);
    expect(findText(d, 'cat', plain)).toHaveLength(2);
    expect(findText(d, 'cat', { ...plain, wholeWord: true })).toHaveLength(1);
  });

  it('returns nothing rather than throwing on an invalid regex', () => {
    // A half-typed pattern arrives on every keystroke of the Find field.
    expect(findText(pmDoc([row('1', 'abc')]), 'a(', { ...plain, useRegex: true })).toEqual([]);
  });

  it('terminates on a pattern that can match the empty string', () => {
    // Without the zero-length guard, `lastIndex` never advances and this hangs.
    const results = findText(pmDoc([row('1', 'aaa')]), 'a*', { ...plain, useRegex: true });
    expect(results.every((r) => r.match.length > 0)).toBe(true);
  });

  it('elides the preview only where text was actually cut', () => {
    const long = `${'x'.repeat(80)} needle ${'y'.repeat(80)}`;
    const [hit] = findText(pmDoc([row('1', long)]), 'needle', plain);
    expect(hit.preview.startsWith('…')).toBe(true);
    expect(hit.preview.endsWith('…')).toBe(true);
    expect(hit.preview).toContain('needle');

    const [short] = findText(pmDoc([row('2', 'just a needle')]), 'needle', plain);
    expect(short.preview).toBe('just a needle');
  });

  it('gives every match a distinct id', () => {
    const results = findText(pmDoc([row('1', 'cat cat'), row('2', 'cat')]), 'cat', plain);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  });
});

describe('blockPositionOf', () => {
  it('finds a block by its server id', () => {
    const d = pmDoc([row('1', 'first'), row('2', 'second')]);
    const pos = blockPositionOf(d, 'b-2');
    expect(pos).not.toBeNull();
    expect(d.nodeAt(pos as number)?.textContent).toBe('second');
  });

  it('returns null for a block that is not in the document', () => {
    expect(blockPositionOf(pmDoc([row('1', 'only')]), 'b-missing')).toBeNull();
  });
});
