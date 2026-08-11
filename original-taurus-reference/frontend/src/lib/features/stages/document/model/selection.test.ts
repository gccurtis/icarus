import { describe, it, expect } from 'vitest';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import type { Doc, Row } from '$data/documents';
import { omegaToPmDoc } from '../editor/bridge';
import { deriveSelection } from './selection';

// The seven inspector lenses, pinned. These became testable when the selection
// model was extracted from the runtime in workstream C — before that, exercising
// a lens meant standing up a whole DocumentRuntime and its network stack.

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

const row = (id: string, kind: string, text = '', subKind?: string): Row => ({
  id: `r-${id}`,
  style: { heightIncrease: 0 },
  blocks: [
    {
      id: `b-${id}`,
      kind: kind as never,
      ...(subKind ? { subKind } : {}),
      style: { horizontalAlign: 'left', verticalAlign: 'top' },
      atoms: text ? [{ id: `a-${id}`, kind: 'text', text }] : []
    }
  ]
});

const stateOf = (rows: Row[]) => EditorState.create({ doc: omegaToPmDoc(doc(rows)) });

/** Position of the start of the Nth top-level block's text. */
function textStart(state: EditorState, index: number): number {
  let pos = 0;
  let seen = 0;
  state.doc.forEach((node, offset) => {
    if (seen === index) pos = offset + 1;
    seen += 1;
  });
  return pos;
}

describe('deriveSelection', () => {
  it('reports `new-block` for an empty text block', () => {
    const state = stateOf([row('1', 'text')]);
    const { selection } = deriveSelection(state, null);
    expect(selection.mode).toBe('new-block');
  });

  it('reports `new-text` for a caret in a non-empty text block', () => {
    const base = stateOf([row('1', 'text', 'Alpha beta')]);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, textStart(base, 0) + 2)));
    const { selection } = deriveSelection(state, null);
    expect(selection.mode).toBe('new-text');
  });

  it('reports `run` with the touched blocks AND their rows for a text range', () => {
    const base = stateOf([row('1', 'text', 'Alpha beta')]);
    const from = textStart(base, 0);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, from, from + 5)));
    const { selection } = deriveSelection(state, null);
    if (selection.mode !== 'run') throw new Error(`expected run, got ${selection.mode}`);
    expect(selection.text).toBe('Alpha');
    expect(selection.chars).toBe(5);
    expect(selection.words).toBe(1);
    expect(selection.blockIds).toEqual(['b-1']);
    // Bug B1: a run must name its rows, or line spacing has no target to write to.
    expect(selection.rowIds).toEqual(['r-1']);
  });

  it('collects every row a multi-block run spans, de-duplicated and in order', () => {
    const base = stateOf([row('1', 'text', 'Alpha'), row('2', 'text', 'Beta')]);
    const state = base.apply(
      base.tr.setSelection(TextSelection.create(base.doc, textStart(base, 0), base.doc.content.size - 1))
    );
    const { selection } = deriveSelection(state, null);
    if (selection.mode !== 'run') throw new Error(`expected run, got ${selection.mode}`);
    expect(selection.blockIds).toEqual(['b-1', 'b-2']);
    expect(selection.rowIds).toEqual(['r-1', 'r-2']);
  });

  it('inspects a code block as `block`, never the Next Text typography lens', () => {
    const base = stateOf([row('1', 'code', 'const x = 1')]);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, textStart(base, 0) + 1)));
    const { selection } = deriveSelection(state, null);
    expect(selection.mode).toBe('block');
  });

  it('offers Next Text inside a callout (it holds formattable text)', () => {
    const base = stateOf([row('1', 'callout', 'Heads up')]);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, textStart(base, 0) + 1)));
    const { selection } = deriveSelection(state, null);
    expect(selection.mode).toBe('new-text');
  });

  it('carries the start block sub-kind so the Style control has a value', () => {
    const base = stateOf([row('1', 'text', 'Title', 'heading_2')]);
    const from = textStart(base, 0);
    const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, from, from + 5)));
    const { selection } = deriveSelection(state, null);
    if (selection.mode !== 'run') throw new Error(`expected run, got ${selection.mode}`);
    expect(selection.subKind).toBe('heading_2');
  });

  it('honours a pinned row inspection over the live selection', () => {
    const state = stateOf([row('1', 'text', 'Alpha'), row('2', 'text', 'Beta')]);
    const { selection, clearInspection } = deriveSelection(state, {
      mode: 'row',
      rowId: 'r-1',
      blockIds: ['b-1']
    });
    if (selection.mode !== 'row') throw new Error(`expected row, got ${selection.mode}`);
    expect(selection.rowId).toBe('r-1');
    expect(selection.items.map((b) => b.blockId)).toEqual(['b-1']);
    expect(clearInspection).toBe(false);
  });

  it('reports `blocks` for a multi-block pinned inspection', () => {
    const state = stateOf([row('1', 'text', 'Alpha'), row('2', 'text', 'Beta')]);
    const { selection } = deriveSelection(state, { mode: 'blocks', blockIds: ['b-1', 'b-2'] });
    if (selection.mode !== 'blocks') throw new Error(`expected blocks, got ${selection.mode}`);
    expect(selection.items).toHaveLength(2);
  });

  it('asks the caller to drop a pinned inspection whose blocks are gone', () => {
    const state = stateOf([row('1', 'text', 'Alpha')]);
    const { selection, clearInspection } = deriveSelection(state, {
      mode: 'block',
      blockIds: ['b-vanished']
    });
    // Falls through to the live selection AND reports the stale pin.
    expect(clearInspection).toBe(true);
    expect(selection.mode).not.toBe('block');
  });

  it('reports `block` for a node selection on a divider', () => {
    const base = stateOf([row('1', 'divider')]);
    let dividerPos = 0;
    base.doc.forEach((node, offset) => {
      if (node.type.name === 'divider') dividerPos = offset;
    });
    const state = base.apply(base.tr.setSelection(NodeSelection.create(base.doc, dividerPos)));
    const { selection } = deriveSelection(state, null);
    if (selection.mode !== 'block') throw new Error(`expected block, got ${selection.mode}`);
    expect(selection.block.kind).toBe('divider');
  });
});
