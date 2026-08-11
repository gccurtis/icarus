import { describe, it, expect } from 'vitest';
import {
  atomTextInOp,
  atomTextInChangeSet,
  describeChange,
  editedAtomIds,
  type RawOp
} from './change-detail';

// The prior-text reconstruction. Omega returns only a change set's NEW text — the
// previous value is private undo state (`InverseOps`, `json:"-"`) — so a real
// before/after depends entirely on this logic being right.

describe('editedAtomIds', () => {
  it('collects the atoms a change set assigns text to, in order, without repeats', () => {
    const ops: RawOp[] = [
      { op: 'set_atom_text', atomId: 'a', setText: 'one' },
      { op: 'set_atom_text', atomId: 'b', setText: 'two' },
      { op: 'set_atom_text', atomId: 'a', setText: 'three' }
    ];
    expect(editedAtomIds(ops)).toEqual(['a', 'b']);
  });

  it('treats an empty string as a real edit', () => {
    // Clearing text is a change; `setText: ''` must not be skipped as falsy.
    expect(editedAtomIds([{ op: 'set_atom_text', atomId: 'a', setText: '' }])).toEqual(['a']);
  });

  it('ignores ops that set no text', () => {
    expect(editedAtomIds([{ op: 'add_mark', atomId: 'a' }])).toEqual([]);
  });
});

describe('atomTextInOp', () => {
  it('reads a direct set_atom_text', () => {
    expect(atomTextInOp({ op: 'set_atom_text', atomId: 'a', setText: 'hi' }, 'a')).toBe('hi');
  });

  it('reads the atom carried by a row insert', () => {
    // The first edit after a paragraph is created has its prior text here, not in
    // a set_atom_text — missing this case makes that edit look like it had none.
    const op: RawOp = {
      op: 'insert_row',
      row: { blocks: [{ atoms: [{ id: 'a', text: 'Draft' }] }] }
    };
    expect(atomTextInOp(op, 'a')).toBe('Draft');
  });

  it('reads the atom carried by a block insert', () => {
    expect(atomTextInOp({ op: 'insert_block', block: { atoms: [{ id: 'a', text: 'B' }] } }, 'a')).toBe('B');
  });

  it('reads a bare atom insert', () => {
    expect(atomTextInOp({ op: 'insert_atom', atom: { id: 'a', text: 'C' } }, 'a')).toBe('C');
  });

  it('returns null for an untouched atom', () => {
    expect(atomTextInOp({ op: 'set_atom_text', atomId: 'other', setText: 'x' }, 'a')).toBeNull();
  });

  it('distinguishes "set to empty" from "not touched"', () => {
    expect(atomTextInOp({ op: 'set_atom_text', atomId: 'a', setText: '' }, 'a')).toBe('');
  });
});

describe('atomTextInChangeSet', () => {
  it('takes the LAST op to touch the atom', () => {
    // A change set may write an atom more than once; the prior value for the next
    // change set is what it ended on, not what it started with.
    const ops: RawOp[] = [
      { op: 'set_atom_text', atomId: 'a', setText: 'first' },
      { op: 'set_atom_text', atomId: 'a', setText: 'last' }
    ];
    expect(atomTextInChangeSet(ops, 'a')).toBe('last');
  });

  it('returns null when the atom is absent', () => {
    expect(atomTextInChangeSet([{ op: 'add_mark' }], 'a')).toBeNull();
  });
});

describe('describeChange', () => {
  it('renders a real before/after pair when the prior text was recovered', () => {
    const out = describeChange(
      [{ op: 'set_atom_text', atomId: 'a', setText: 'Quarterly outline' }],
      new Map([['a', 'Draft']])
    );
    expect(out.before).toBe('“Draft”');
    expect(out.after).toBe('“Quarterly outline”');
    expect(out.priorUnknown).toBe(false);
  });

  it('flags an unrecovered prior value instead of implying there was none', () => {
    const out = describeChange(
      [{ op: 'set_atom_text', atomId: 'a', setText: 'new' }],
      new Map()
    );
    expect(out.before).toBe('');
    expect(out.priorUnknown).toBe(true);
  });

  it('shows an empty prior value as (empty), not as unknown', () => {
    // "was blank, now has text" is a fact we have; it must not read the same as
    // "we could not find out".
    const out = describeChange(
      [{ op: 'set_atom_text', atomId: 'a', setText: 'text' }],
      new Map([['a', '']])
    );
    expect(out.before).toBe('(empty)');
    expect(out.priorUnknown).toBe(false);
  });

  it('describes structural ops on the side that applies', () => {
    expect(describeChange([{ op: 'insert_row' }], new Map()).after).toBe('row inserted');
    expect(describeChange([{ op: 'delete_row' }], new Map()).before).toBe('row deleted');
    expect(describeChange([{ op: 'remove_mark' }], new Map()).before).toBe('formatting removed');
  });

  it('truncates long text so a panel cannot be flooded', () => {
    const long = 'x'.repeat(200);
    const out = describeChange([{ op: 'set_atom_text', atomId: 'a', setText: long }], new Map([['a', 'y']]));
    expect(out.after.length).toBeLessThan(100);
    expect(out.after).toContain('…');
  });
});
