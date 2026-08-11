import type {
  Block,
  BlockStyleRef,
  ChangeOp,
  CustomTypography,
  Row
} from '$data/documents';

/**
 * The OPTIMISTIC OVERLAY — every local edit that has been shown to the user but
 * not yet confirmed by Omega, plus the queue of ops that will confirm them.
 *
 * The overlay is a *layer over* the server snapshot, never a mutation of it.
 * That distinction is the point of this module: the runtime previously reached
 * into `snapshot` and rewrote a `Block.style` in place, so the optimistic value
 * survived a flush only because the differ happened to spread the very object
 * that had been mutated (`{ ...previousBlock }`). Nothing declared that
 * invariant and nothing enforced it — a defensive copy anywhere in the chain
 * would have silently reverted alignment and indent. See catalog item **B2**.
 *
 * Now the overlay owns the patches, readers resolve `overlay ?? snapshot`, and
 * `applyTo` folds them into a rows array explicitly when a new snapshot is
 * adopted. No shared references, no ordering assumptions.
 */
export class OptimisticOverlay {
  /** rowId → pending height increase, in points. */
  private readonly rowHeights = new Map<string, number>();
  /** blockId → pending block style (alignment + indent). */
  private readonly blockStyles = new Map<string, Block['style']>();
  /** blockId → pending semantic style reference. */
  private readonly styleRefs = new Map<string, BlockStyleRef>();
  /** blockId → pending custom typography (real fonts). */
  private readonly custom = new Map<string, CustomTypography>();
  /** Direct ops queued by the inspector, sent ahead of the differ's ops. */
  private ops: ChangeOp[] = [];

  /** Drop every optimistic value — server truth has arrived (load / reload). */
  clear() {
    this.rowHeights.clear();
    this.blockStyles.clear();
    this.styleRefs.clear();
    this.custom.clear();
  }

  // --- row heights (line spacing) --------------------------------------------

  setRowHeight(rowId: string, heightIncrease: number) {
    this.rowHeights.set(rowId, heightIncrease);
  }

  /** The effective height increase for a row: pending wins over server truth. */
  rowHeightOf(rowId: string, serverIncrease: number): number {
    return this.rowHeights.get(rowId) ?? serverIncrease;
  }

  // --- block style (alignment + indent) --------------------------------------

  /**
   * Merge a style patch for a block. `base` is the block's current effective
   * style, so a second patch layers over the first rather than over stale
   * server truth — the behaviour the old in-place mutation got for free.
   */
  patchBlockStyle(blockId: string, base: Block['style'], patch: Partial<Block['style']>) {
    this.blockStyles.set(blockId, { ...base, ...patch });
  }

  /** The effective style for a block: pending wins over the snapshot's. */
  styleOf(blockId: string, serverStyle: Block['style'] | undefined): Block['style'] | undefined {
    return this.blockStyles.get(blockId) ?? serverStyle;
  }

  hasBlockStyle(blockId: string): boolean {
    return this.blockStyles.has(blockId);
  }

  // --- semantic style refs + custom typography --------------------------------

  setStyleRef(blockId: string, ref: BlockStyleRef) {
    this.styleRefs.set(blockId, ref);
  }

  styleRefOf(blockId: string, serverRef: BlockStyleRef | null): BlockStyleRef | null {
    return this.styleRefs.get(blockId) ?? serverRef;
  }

  setCustom(blockId: string, typography: CustomTypography) {
    this.custom.set(blockId, typography);
  }

  customOf(blockId: string, serverCustom: CustomTypography | null): CustomTypography | null {
    return this.custom.get(blockId) ?? serverCustom;
  }

  // --- the direct-op queue ----------------------------------------------------

  queue(op: ChangeOp) {
    this.ops.push(op);
  }

  /** Replace any queued op matching `match` with `op` — last write wins per target. */
  replace(match: (op: ChangeOp) => boolean, op: ChangeOp) {
    this.ops = this.ops.filter((candidate) => !match(candidate));
    this.ops.push(op);
  }

  has(match: (op: ChangeOp) => boolean): boolean {
    return this.ops.some(match);
  }

  /**
   * A COPY of the queued ops, to send. A copy because an action firing while
   * the append is in flight pushes onto the live queue; if the sent list aliased
   * it, `settle` would strip the new, never-sent op by reference equality.
   */
  pendingOps(): ChangeOp[] {
    return [...this.ops];
  }

  /** Drop exactly the ops that were sent, keeping any queued since. */
  settle(sent: ChangeOp[]) {
    this.ops = this.ops.filter((op) => !sent.includes(op));
  }

  // --- folding into a snapshot ------------------------------------------------

  /**
   * Fold the pending block styles into a rows array, returning new objects for
   * the blocks it touches. Called when a freshly differed snapshot is adopted:
   * the differ carries the *previous* block's style forward, so without this the
   * next snapshot would silently revert an optimistic alignment or indent.
   *
   * Row heights are deliberately NOT folded — Omega models line height per
   * block, and `rowHeights` is a presentation-only model whose server truth
   * arrives on the next reload.
   */
  applyTo(rows: Row[]): Row[] {
    if (this.blockStyles.size === 0) return rows;
    return rows.map((row) => ({
      ...row,
      blocks: row.blocks.map((block) => {
        const style = this.blockStyles.get(block.id);
        return style ? { ...block, style } : block;
      })
    }));
  }
}

/** Find a block by id in a rows array (read-only lookup). */
export function findBlock(rows: Row[], blockId: string): Block | null {
  for (const row of rows) for (const block of row.blocks) if (block.id === blockId) return block;
  return null;
}
