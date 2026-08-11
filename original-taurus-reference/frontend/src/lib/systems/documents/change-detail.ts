import { api } from '$data/api';

/**
 * Reconstructing a change set's before/after text.
 *
 * Omega does not hand us the prior value. It computes it — the change set's
 * `InverseOps` is exactly it — but marks the field `json:"-"` as private undo
 * state, so `GET /documents/:id/history/:changeSetID` returns only the forward
 * ops and therefore only the NEW text.
 *
 * A "Result" with nothing to compare it against does not tell a reader what
 * changed, so this module recovers the previous value the one way a client can:
 * an atom's text before change set N is whatever the most recent change set
 * older than N set it to. Walking backwards through history until each edited
 * atom is accounted for yields a real before/after.
 *
 * That walk costs one request per change set inspected, so it is bounded
 * (`LOOKBACK_BUDGET`) and stops as soon as every atom is resolved — in practice
 * the previous edit to the same atom is a hop or two back, because that is what
 * typing looks like. When an atom's origin lies beyond the budget or has been
 * pruned, its prior text is simply unknown and the caller says so rather than
 * guessing.
 *
 * Exposing `inverseOps` (or a derived `before`) would delete this whole module:
 * `docs/backend-requests/resource-access-enforcement.md`.
 */

/** The subset of a change op this module reads. */
export type RawOp = {
  op: string;
  atomId?: string;
  setText?: string;
  setKind?: string;
  row?: { blocks?: { atoms?: { id?: string; text?: string }[] }[] };
  block?: { atoms?: { id?: string; text?: string }[] };
  atom?: { id?: string; text?: string };
};

export type ChangeText = {
  before: string;
  after: string;
  /** True when a text edit's prior value could not be recovered. */
  priorUnknown: boolean;
};

/** How many older change sets may be fetched while hunting for prior text. */
export const LOOKBACK_BUDGET = 12;

/** The atoms a change set assigns text to, in op order. */
export function editedAtomIds(ops: RawOp[]): string[] {
  const ids: string[] = [];
  for (const op of ops) {
    if (op.setText !== undefined && op.atomId && !ids.includes(op.atomId)) ids.push(op.atomId);
  }
  return ids;
}

/**
 * The text an op leaves in `atomId`, or null if it does not touch it.
 *
 * Covers both ways an atom's text is established: a direct `set_atom_text`, and
 * the atom payload carried inside an insert (a new row's blocks, a new block's
 * atoms, or a bare atom insert). Missing the insert case would make the first
 * edit after a paragraph was created look like it had no prior text.
 */
export function atomTextInOp(op: RawOp, atomId: string): string | null {
  if (op.atomId === atomId && op.setText !== undefined) return op.setText;
  if (op.atom?.id === atomId) return op.atom.text ?? '';
  for (const atom of op.block?.atoms ?? []) {
    if (atom.id === atomId) return atom.text ?? '';
  }
  for (const block of op.row?.blocks ?? []) {
    for (const atom of block.atoms ?? []) {
      if (atom.id === atomId) return atom.text ?? '';
    }
  }
  return null;
}

/** The latest text a change set leaves in `atomId`, or null. */
export function atomTextInChangeSet(ops: RawOp[], atomId: string): string | null {
  for (let i = ops.length - 1; i >= 0; i--) {
    const text = atomTextInOp(ops[i], atomId);
    if (text !== null) return text;
  }
  return null;
}

function quote(text: string): string {
  const trimmed = text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return trimmed === '' ? '(empty)' : `“${trimmed}”`;
}

/**
 * Render a change set as before/after prose, given whatever prior text was
 * recovered. Text edits read as a real pair; structural and formatting ops
 * describe themselves on the side that applies.
 */
export function describeChange(ops: RawOp[], prior: Map<string, string>): ChangeText {
  const before: string[] = [];
  const after: string[] = [];
  let priorUnknown = false;

  for (const op of ops) {
    if (op.setText !== undefined && op.atomId) {
      const was = prior.get(op.atomId);
      if (was === undefined) priorUnknown = true;
      else before.push(quote(was));
      after.push(quote(op.setText));
    } else if (op.setKind) {
      before.push(`kind was ${op.setKind}`);
      after.push(`kind ${op.setKind}`);
    } else if (op.op === 'insert_row') after.push('row inserted');
    else if (op.op === 'delete_row') before.push('row deleted');
    else if (op.op === 'insert_block') after.push('block inserted');
    else if (op.op === 'delete_block') before.push('block deleted');
    else if (op.op === 'add_mark') after.push('formatting applied');
    else if (op.op === 'remove_mark') before.push('formatting removed');
    else after.push(op.op.replace(/_/g, ' '));
  }

  return { before: before.join(', '), after: after.join(', '), priorUnknown };
}

export function fetchChangeSetOps(documentId: string, changeSetId: string): Promise<RawOp[]> {
  return api<{ ops?: RawOp[] }>(
    `/documents/${encodeURIComponent(documentId)}/history/${encodeURIComponent(changeSetId)}`
  ).then((cs) => cs.ops ?? []);
}

/**
 * Load one change set's before/after.
 *
 * `olderChangeSetIds` must be newest-first and contain only change sets older
 * than the target — the caller already holds the history page, so it slices
 * rather than making this module re-read it.
 */
export async function loadChangeText(
  documentId: string,
  changeSetId: string,
  olderChangeSetIds: string[]
): Promise<ChangeText> {
  const ops = await fetchChangeSetOps(documentId, changeSetId);
  const wanted = editedAtomIds(ops);
  const prior = new Map<string, string>();

  for (const olderId of olderChangeSetIds.slice(0, LOOKBACK_BUDGET)) {
    if (prior.size === wanted.length) break;
    let olderOps: RawOp[];
    try {
      olderOps = await fetchChangeSetOps(documentId, olderId);
    } catch {
      // Pruned or unreadable: keep walking. A gap costs recall, not correctness.
      continue;
    }
    for (const atomId of wanted) {
      if (prior.has(atomId)) continue;
      const text = atomTextInChangeSet(olderOps, atomId);
      if (text !== null) prior.set(atomId, text);
    }
  }

  return describeChange(ops, prior);
}
