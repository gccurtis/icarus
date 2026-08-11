import { describe, it, expect } from 'vitest';
import type { Row } from '$data/documents';
import { findBlock, OptimisticOverlay } from './overlay';

// Catalog item B2. Alignment and indent used to survive a flush only because the
// action mutated the snapshot's Block in place and the differ happened to spread
// that same object. These tests pin the explicit replacement so a future
// defensive copy cannot silently revert an optimistic edit.

const rows = (): Row[] => [
  {
    id: 'r1',
    style: { heightIncrease: 0 },
    blocks: [
      {
        id: 'b1',
        kind: 'text',
        style: { horizontalAlign: 'left', verticalAlign: 'top' },
        atoms: [{ id: 'a1', kind: 'text', text: 'Alpha' }]
      }
    ]
  }
];

describe('OptimisticOverlay', () => {
  it('never mutates the snapshot it reads through', () => {
    const snapshot = rows();
    const overlay = new OptimisticOverlay();
    const before = findBlock(snapshot, 'b1')!.style;

    overlay.patchBlockStyle('b1', before, { horizontalAlign: 'center' });

    // The snapshot block is untouched; only the overlay knows about the change.
    expect(findBlock(snapshot, 'b1')!.style.horizontalAlign).toBe('left');
    expect(overlay.styleOf('b1', before)?.horizontalAlign).toBe('center');
  });

  it('resolves pending over server truth, and falls back when nothing is pending', () => {
    const snapshot = rows();
    const overlay = new OptimisticOverlay();
    const server = findBlock(snapshot, 'b1')!.style;

    expect(overlay.styleOf('b1', server)?.horizontalAlign).toBe('left');
    overlay.patchBlockStyle('b1', server, { horizontalAlign: 'right' });
    expect(overlay.styleOf('b1', server)?.horizontalAlign).toBe('right');
    // A different block still reads server truth.
    expect(overlay.styleOf('other', server)?.horizontalAlign).toBe('left');
  });

  it('layers a second patch over the first, not over stale server truth', () => {
    const snapshot = rows();
    const overlay = new OptimisticOverlay();
    const server = findBlock(snapshot, 'b1')!.style;

    overlay.patchBlockStyle('b1', server, { horizontalAlign: 'center' });
    const afterFirst = overlay.styleOf('b1', server)!;
    overlay.patchBlockStyle('b1', afterFirst, { indent: 3 });

    const merged = overlay.styleOf('b1', server)!;
    expect(merged.horizontalAlign).toBe('center');
    expect(merged.indent).toBe(3);
  });

  it('survives a differ round-trip that carries the OLD style forward (B2)', () => {
    const snapshot = rows();
    const overlay = new OptimisticOverlay();
    overlay.patchBlockStyle('b1', findBlock(snapshot, 'b1')!.style, { indent: 2 });

    // What diffDoc produces: `{ ...previousBlock }` — the PREVIOUS (unpatched)
    // style carried forward, because block style is not part of the PM document.
    const nextRows: Row[] = snapshot.map((row) => ({
      ...row,
      blocks: row.blocks.map((block) => ({ ...block }))
    }));
    expect(findBlock(nextRows, 'b1')!.style.indent).toBeUndefined();

    // Adopting that snapshot without folding would revert the indent to 0.
    const adopted = overlay.applyTo(nextRows);
    expect(findBlock(adopted, 'b1')!.style.indent).toBe(2);
  });

  it('applyTo returns fresh objects and leaves its input untouched', () => {
    const overlay = new OptimisticOverlay();
    const input = rows();
    overlay.patchBlockStyle('b1', input[0].blocks[0].style, { indent: 1 });

    const output = overlay.applyTo(input);
    expect(findBlock(input, 'b1')!.style.indent).toBeUndefined();
    expect(findBlock(output, 'b1')!.style.indent).toBe(1);
    expect(output[0].blocks[0]).not.toBe(input[0].blocks[0]);
  });

  it('clear() drops optimistic state so server truth wins after a reload', () => {
    const snapshot = rows();
    const overlay = new OptimisticOverlay();
    const server = findBlock(snapshot, 'b1')!.style;
    overlay.patchBlockStyle('b1', server, { horizontalAlign: 'center' });

    overlay.clear();

    expect(overlay.styleOf('b1', server)?.horizontalAlign).toBe('left');
    expect(overlay.applyTo(snapshot)).toBe(snapshot);
  });

  it('row heights resolve pending over the server increase', () => {
    const overlay = new OptimisticOverlay();
    expect(overlay.rowHeightOf('r1', 12)).toBe(12);
    overlay.setRowHeight('r1', 48);
    expect(overlay.rowHeightOf('r1', 12)).toBe(48);
  });

  it('replace() keeps one op per target — last write wins', () => {
    const overlay = new OptimisticOverlay();
    const match = (blockId: string) => (op: { op: string; blockId?: string }) =>
      op.op === 'set_block_indent' && op.blockId === blockId;

    overlay.replace(match('b1'), { op: 'set_block_indent', blockId: 'b1', indent: 1 });
    overlay.replace(match('b1'), { op: 'set_block_indent', blockId: 'b1', indent: 2 });
    overlay.replace(match('b2'), { op: 'set_block_indent', blockId: 'b2', indent: 5 });

    const ops = overlay.pendingOps();
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ blockId: 'b1', indent: 2 });
    expect(ops[1]).toMatchObject({ blockId: 'b2', indent: 5 });
  });

  it('pendingOps() hands back a copy, so settle() cannot strip an op queued mid-flight', () => {
    const overlay = new OptimisticOverlay();
    overlay.queue({ op: 'set_prompt', blockId: 'b1', setText: 'first' });

    // A flush snapshots what it is about to send...
    const sending = overlay.pendingOps();
    // ...and an action fires while the append is in flight.
    overlay.queue({ op: 'set_prompt', blockId: 'b1', setText: 'second' });
    overlay.settle(sending);

    const left = overlay.pendingOps();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ setText: 'second' });
  });
});
