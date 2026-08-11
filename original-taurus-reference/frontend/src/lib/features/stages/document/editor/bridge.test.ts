import { describe, it, expect } from 'vitest';
import { omegaToPmDoc, diffDoc, nodeKind, nodeSubKind } from './bridge';
import { schema } from './schema';
import type { Block, Doc, Row } from '$data/documents';

function doc(rows: Row[]): Doc {
  return {
    id: 'd', projectId: 'p', name: 'n',
    base: {
      pageLayout: { width: 612, height: 792, marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72 },
      layoutRules: { maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144 },
      styleRegistry: { definitions: [], defaults: [] },
      rows
    },
    creatorId: '', creatorName: '', createdAt: '', updatedAt: '', revision: 1,
    clientCapabilities: { canonicalLayout: true, revisionSubmissions: true }
  };
}
type BlockOpts = { text?: string; subKind?: string; data?: unknown; marks?: Block['marks'] };
const row = (id: string, kind: string, opts: BlockOpts = {}): Row => ({
  id,
  style: { heightIncrease: 0 },
  blocks: [
    {
      id: `b-${id}`,
      kind: kind as never,
      ...(opts.subKind ? { subKind: opts.subKind } : {}),
      style: { horizontalAlign: 'left', verticalAlign: 'top' },
      atoms: opts.text ? [{ id: `a-${id}`, kind: 'text', text: opts.text }] : [],
      ...(opts.marks ? { marks: opts.marks } : {}),
      ...(opts.data ? { data: opts.data } : {})
    }
  ]
});

describe('omegaToPmDoc → node kind + sub-kind', () => {
  it('maps a text heading sub-kind to the heading node', () => {
    const pm = omegaToPmDoc(doc([row('r1', 'text', { text: 'Title', subKind: 'heading_2' })]));
    expect(pm.child(0).type.name).toBe('heading');
    expect(pm.child(0).attrs.level).toBe(2);
    expect(nodeKind(pm.child(0))).toBe('text');
    expect(nodeSubKind(pm.child(0))).toBe('heading_2');
  });
  it('maps a text body sub-kind to the paragraph node', () => {
    const pm = omegaToPmDoc(doc([row('r1', 'text', { text: 'hi', subKind: 'body' })]));
    expect(pm.child(0).type.name).toBe('paragraph');
    expect(nodeKind(pm.child(0))).toBe('text');
    expect(nodeSubKind(pm.child(0))).toBe('body');
  });
  it('maps code/divider to their own nodes and callout onto paragraph', () => {
    const pm = omegaToPmDoc(
      doc([row('r1', 'code', { text: 'x = 1' }), row('r2', 'divider'), row('r3', 'callout', { text: 'note' })])
    );
    expect(pm.child(0).type.name).toBe('code_block');
    expect(nodeKind(pm.child(0))).toBe('code');
    expect(pm.child(1).type.name).toBe('divider');
    expect(nodeKind(pm.child(1))).toBe('divider');
    expect(pm.child(2).type.name).toBe('paragraph');
    expect(nodeKind(pm.child(2))).toBe('callout');
    expect(nodeSubKind(pm.child(2))).toBeUndefined();
  });
  it('maps a list block to a list node with items', () => {
    const pm = omegaToPmDoc(
      doc([
        row('r1', 'list', {
          data: {
            type: 'ordered',
            start: 3,
            items: [
              { level: 0, atoms: [{ id: 'a', kind: 'text', text: 'one' }] },
              { level: 1, checked: false, atoms: [{ id: 'b', kind: 'text', text: 'two' }] }
            ]
          }
        })
      ])
    );
    const list = pm.child(0);
    expect(list.type.name).toBe('list');
    expect(nodeKind(list)).toBe('list');
    expect(list.attrs.listType).toBe('ordered');
    expect(list.attrs.start).toBe(3);
    expect(list.childCount).toBe(2);
    expect(list.child(0).textContent).toBe('one');
    expect(list.child(1).attrs.level).toBe(1);
  });
});

describe('diffDoc — list edits', () => {
  const listRow = row('r1', 'list', {
    data: { type: 'bullet', items: [{ level: 0, atoms: [{ id: 'a', kind: 'text', text: 'one' }] }] }
  });

  it('produces no ops for an unchanged list', () => {
    const rows = doc([listRow]).base.rows;
    const pm = omegaToPmDoc(doc([listRow]));
    expect(diffDoc(rows, pm).ops).toEqual([]);
  });

  it('emits set_block_data with the full payload when an item changes', () => {
    const rows = doc([listRow]).base.rows;
    const pm = omegaToPmDoc(doc([listRow]));
    const list = pm.child(0);
    const newList = list.type.create(list.attrs, [
      schema.node('list_item', list.child(0).attrs, schema.text('changed'))
    ]);
    const next = pm.type.create(null, [newList]);
    const { ops, nextRows } = diffDoc(rows, next);
    const op = ops.find((o) => o.op === 'set_block_data');
    expect(op?.listData?.items[0].atoms?.[0].text).toBe('changed');
    expect((nextRows[0].blocks[0].data as { items: { atoms: { text: string }[] }[] }).items[0].atoms[0].text).toBe(
      'changed'
    );
  });
});

describe('diffDoc — new element blocks', () => {
  it('inserts a divider with no atoms', () => {
    const before = omegaToPmDoc(doc([row('r1', 'text', { text: 'hello' })]));
    const withDivider = before.type.create(null, [before.child(0), schema.node('divider')]);
    const { ops } = diffDoc(doc([row('r1', 'text', { text: 'hello' })]).base.rows, withDivider);
    const insert = ops.find((o) => o.op === 'insert_row' && o.row?.blocks[0].kind === 'divider');
    expect(insert?.row?.blocks[0].kind).toBe('divider');
    expect(insert?.row?.blocks[0].atoms).toEqual([]);
  });
  it('inserts a code block with atoms and no marks', () => {
    const before = omegaToPmDoc(doc([row('r1', 'text', { text: 'x' })]));
    const codeNode = schema.node('code_block', null, schema.text('a = 1'));
    const withCode = before.type.create(null, [before.child(0), codeNode]);
    const { ops } = diffDoc(doc([row('r1', 'text', { text: 'x' })]).base.rows, withCode);
    const insert = ops.find((o) => o.op === 'insert_row' && o.row?.blocks[0].kind === 'code');
    expect(insert?.row?.blocks[0].atoms?.[0].text).toBe('a = 1');
    expect(insert?.row?.blocks[0].marks ?? []).toEqual([]);
  });
});

describe('diffDoc — sub-kind vs kind change', () => {
  it('a body → heading conversion is a set_block_subkind (kind stays text)', () => {
    const rows = doc([row('r1', 'text', { text: 'x', subKind: 'body' })]).base.rows;
    const pm = omegaToPmDoc(doc([row('r1', 'text', { text: 'x', subKind: 'body' })]));
    const attrs = pm.child(0).attrs;
    const heading = schema.node('heading', { level: 2, blockId: attrs.blockId, rowId: attrs.rowId }, pm.child(0).content);
    const next = pm.type.create(null, [heading]);
    const { ops, nextRows } = diffDoc(rows, next);
    expect(ops.find((o) => o.op === 'set_block')).toBeUndefined();
    const sub = ops.find((o) => o.op === 'set_block_subkind');
    expect(sub?.setSubKind).toBe('heading_2');
    expect(nextRows[0].blocks[0].kind).toBe('text');
    expect(nextRows[0].blocks[0].subKind).toBe('heading_2');
  });
  it('a text → callout conversion is a set_block (kind change)', () => {
    const rows = doc([row('r1', 'text', { text: 'x', subKind: 'body' })]).base.rows;
    const pm = omegaToPmDoc(doc([row('r1', 'text', { text: 'x', subKind: 'body' })]));
    const attrs = pm.child(0).attrs;
    const callout = schema.node('paragraph', { ...attrs, kind: 'callout' }, pm.child(0).content);
    const next = pm.type.create(null, [callout]);
    const { ops, nextRows } = diffDoc(rows, next);
    expect(ops.find((o) => o.op === 'set_block')?.setKind).toBe('callout');
    expect(ops.find((o) => o.op === 'set_block_subkind')).toBeUndefined();
    expect(nextRows[0].blocks[0].kind).toBe('callout');
    expect(nextRows[0].blocks[0].subKind).toBeUndefined();
  });
});

describe('diffDoc — kind change drops stale data', () => {
  it('drops data when a data-kind block (prompt) becomes text', () => {
    const rows = doc([row('r1', 'prompt', { text: 'out', data: { instruction: 'do' } })]).base.rows;
    const pm = omegaToPmDoc(doc([row('r1', 'prompt', { text: 'out', data: { instruction: 'do' } })]));
    const para = schema.node('paragraph', { ...pm.child(0).attrs, kind: 'text', subKind: 'body' }, pm.child(0).content);
    const next = pm.type.create(null, [para]);
    const { ops, nextRows } = diffDoc(rows, next);
    expect(ops.find((o) => o.op === 'set_block')?.setKind).toBe('text');
    expect(nextRows[0].blocks[0].kind).toBe('text');
    expect(nextRows[0].blocks[0].data).toBeUndefined();
  });
});

describe('diffDoc — inline typography marks round-trip', () => {
  it('an fg mark loaded from a block produces no spurious ops', () => {
    const marks: Block['marks'] = [
      { id: 'm1', kind: 'fg', attrs: { value: '#ff0000' }, start: { atomId: 'a-r1', offset: 0 }, end: { atomId: 'a-r1', offset: 5 } }
    ];
    const rows = doc([row('r1', 'text', { text: 'hello', subKind: 'body', marks })]).base.rows;
    const pm = omegaToPmDoc(doc([row('r1', 'text', { text: 'hello', subKind: 'body', marks })]));
    // The fg mark survives the mapping…
    expect(pm.child(0).firstChild?.marks.some((m) => m.type.name === 'fg')).toBe(true);
    // …and re-diffing the unchanged doc emits nothing (the mark compares equal).
    const { ops } = diffDoc(rows, pm);
    expect(ops).toEqual([]);
  });
});
