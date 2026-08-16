import { describe, expect, it } from "vitest";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { check, touchedBy } from "$revisions/api/submit/check";
import {
  RESOURCE,
  asCtx,
  asking,
  bodyWithBlock,
  landed,
  leaderAt,
  refusalFrom
} from "$revisions/test/fixture";
import type { Op, OpTarget } from "$revisions/types/change";

/**
 * One test per worked case in
 * [change conflicts](../../../../../../../docs/processes/change-conflicts.md),
 * because the ladder is a decision about someone else's typing: every rung that
 * rejects costs a resubmit, and the one rung that does not is the only place in
 * the system where a wrong answer is silent.
 */

const ATOM = "#b7x2/atoms/#a9x1";

/** The third atom of the same block: its offsets and the block's display disagree by 25. */
const LATER_ATOM = "#b7x2/atoms/#a9x3";

/** A block's marks as an op states them — the payload, without the style it also carries. */
const marksAfter = (body: ReturnType<typeof bodyWithBlock>) =>
  body.rows[0].blocks[0].marks.map(({ id, from, to }) => ({ id, from, to }));

const typing = (path: string, at: number, remove: string, insert: string): Op => ({
  op: "text",
  target: "atom",
  path,
  at,
  insert,
  remove
});

const marking = (path: string, mark: { id: string; from: number; to: number }): Op => ({
  op: "insert",
  target: "mark",
  path,
  after: null,
  values: [mark]
});

const setting = (target: OpTarget, path: string, value: unknown): Op => ({
  op: "set",
  target,
  path,
  value,
  was: null
});

const inserting = (target: OpTarget, path: string, after: string, values: unknown[]): Op => ({
  op: "insert",
  target,
  path,
  after,
  values
});

const moving = (target: OpTarget, path: string, id: string, after: string): Op => ({
  op: "move",
  target,
  path,
  id,
  after,
  wasAfter: null
});

/**
 * A removal carries what it took, which is what makes it invertible — and the
 * only account step 3 has of the subtree that went with it.
 */
const removing = (target: OpTarget, path: string, values: { id: string }[]): Op => ({
  op: "remove",
  target,
  path,
  ids: values.map((value) => `#${value.id}`),
  after: null,
  values
});

/** The row holding the block these tests edit — what a removal of it carries away. */
const THE_ROW = bodyWithBlock().rows[0];

/** What a client hands `submit`, with the `touched` the server derives from it. */
const authored = (baseRevision: number, ops: Op[]) => ({
  ...RESOURCE,
  baseRevision,
  ops,
  touched: touchedBy(ops)
});

describe("the conflict ladder", () => {
  it("applies when nothing intervened", async () => {
    const { ctx, scope } = await asking();
    const ops = [typing(ATOM, 4, "", "hello ")];

    expect(await check(asCtx(ctx), scope, authored(7, ops), 7)).toEqual(ops);
  });

  it("applies when touched sets are disjoint", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing("#b4x1/atoms/#a4x1", 4, "", "one ")]);
    const ops = [typing(ATOM, 4, "", "two ")];

    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("applies when different atoms in one paragraph are edited", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing("#b7x2/atoms/#a9x3", 4, "", "one ")]);
    const ops = [typing(ATOM, 40, "", "two ")];

    // An offset is measured inside its own atom, so an edit to the atom beside
    // it moves nothing this op names.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("shifts when the same atom is edited apart", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "", "strong ")]);
    const ops = [typing(ATOM, 40, "", "!")];

    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual([typing(ATOM, 47, "", "!")]);
  });

  it("rejects when the same atom is edited overlapping", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "quarterly", "Q3")]);
    const ops = [typing(ATOM, 6, "terly", "X")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "offsets-overlap",
      step: 4
    });
  });

  it("rejects when the window typed inside what this replaces", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "", "very ")]);
    const ops = [typing(ATOM, 0, "The quarterly report", "X")];

    // The offset is before the window's edit and needs no shift; the string this
    // replaces is the part that is no longer there.
    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "offsets-overlap",
      step: 4
    });
  });

  it("rejects an overlap whichever of the two arrived first", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 8, "terly", "X")]);
    const ops = [typing(ATOM, 4, "quarterly", "Q3")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "offsets-overlap",
      step: 4
    });
  });

  it("shifts a replacement past an insert sitting exactly where it ends", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 7, "", "Z")]);
    const ops = [typing(ATOM, 5, "ab", "")];

    // Nothing landed inside `ab`, so this merges: the closing end of a range
    // takes the opposite tie-break to its opening one.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("shifts a mark past a concurrent text edit", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "", "strong ")]);
    const ops = [marking("#b7x2/marks", { id: "m03", from: 20, to: 26 })];

    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual([
      marking("#b7x2/marks", { id: "m03", from: 27, to: 33 })
    ]);
  });

  it("leaves a mark the window's edit never reached where it was", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 8, [typing(LATER_ATOM, 1, "", "very ")]);
    const ops = [setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 4, to: 20 })];

    // The edit is at offset 1 of the third atom, which is offset 26 of the
    // display the mark is measured against — past both of its ends.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("moves a mark that follows an edit in a later atom by what the edit inserted", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 8, [typing(LATER_ATOM, 1, "", "very ")]);
    const ops = [setting("mark", "#b7x2/marks/#m07", { id: "m07", from: 26, to: 33 })];

    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual([
      setting("mark", "#b7x2/marks/#m07", { id: "m07", from: 31, to: 38 })
    ]);
  });

  it("rebases marks to exactly where applying the window put the block's own", async () => {
    const { ctx, scope, projectId } = await asking();
    // Two edits, the first shortening an atom the second is measured behind: the
    // window has to be replayed, because the later atom starts somewhere else by
    // the time its own edit lands.
    const window = [typing(ATOM, 4, "quarterly ", ""), typing(LATER_ATOM, 1, "", "X")];
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 8, window);
    const ops = marksAfter(bodyWithBlock()).map((mark) =>
      setting("mark", `#b7x2/marks/#${mark.id}`, mark)
    );

    const rebased = await check(asCtx(ctx), scope, authored(7, ops), 8);

    // The invariant the two coordinate computations have to keep: rebasing a
    // mark and applying the same edit to the block's own are one shift stated
    // twice, and the stored body is what everything downstream measures against.
    expect(rebased.map((op) => (op.op === "set" ? op.value : null))).toEqual(
      marksAfter(applyOps(bodyWithBlock(), window))
    );
  });

  it("applies two marks on different phrases", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [
      setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 0, to: 5 })
    ]);
    const ops = [setting("mark", "#b7x2/marks/#m07", { id: "m07", from: 10, to: 15 })];

    // A mark carries no text, so nothing in the block moved.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("rejects when both changes reached for the same mark", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [
      setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 0, to: 5 })
    ]);
    const ops = [setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 2, to: 9 })];

    // Not in the eleven worked cases, and the rung that resolves nearly
    // everything: with this rejection removed, all eleven still pass.
    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "touched-intersects",
      step: 2
    });
  });

  it("rejects an edit under a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [typing(`#r4m1/blocks/${ATOM}`, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects an edit under a removed row that names only its own atom", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [typing(ATOM, 4, "", "x")];

    // An `#id` segment resolves on its own, so this is the ordinary shape of the
    // path — and nothing in it names the row that took the atom with it.
    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects a mark added to a block under a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [marking("#b7x2/marks", { id: "m09", from: 0, to: 3 })];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects a field set on a block under a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [setting("field", "#b7x2/style", "quote")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects everything when a removal did not say what it took", async () => {
    const { ctx, scope, projectId } = await asking();
    const opaque: Op = { op: "remove", target: "row", path: "rows", ids: ["#r4m1"], after: null, values: [] };
    await landed(ctx, projectId, 8, [opaque]);
    const ops = [typing("#b4x1/atoms/#a4x1", 4, "", "x")];

    // Nothing can be shown to be outside a subtree nobody described, and the
    // payload that would describe it is the same one an undo needs.
    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects an insert placed after a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [inserting("row", "rows", "#r4m1", [{ id: "r9k2" }])];

    // Step 2 passes — the insert names what it created — and the anchor is the
    // only thing placing it, so applying it later would find nothing to sit after.
    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects a move placed after a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops = [moving("row", "rows", "r4m2", "#r4m1")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("applies a removal recorded as following a removed row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", [THE_ROW])]);
    const ops: Op[] = [
      { op: "remove", target: "row", path: "rows", ids: ["#r5t8"], after: "#r4m1", values: [{ id: "r5t8" }] }
    ];

    // A removal's `after` is what an undo would put it back after; applying one
    // never reads it, so refusing this would cost a resubmit for nothing.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("rejects when a formula re-resolved in the window", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [setting("atom", "#b7x2/atoms/#afx1/resolved", "$4.7M")]);
    const ops = [typing(ATOM, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(7, ops), 8))).toMatchObject({
      code: "not-plain-text",
      step: 4
    });
  });

  it("applies two inserts after the same row", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [inserting("row", "rows", "#r4m1", [{ id: "r9k2" }])]);
    const ops = [inserting("row", "rows", "#r4m1", [{ id: "r5t8" }])];

    // Both land, and their order is settled by revision rather than by the id
    // they were both placed after.
    expect(await check(asCtx(ctx), scope, authored(7, ops), 8)).toEqual(ops);
  });

  it("rejects when baseRevision predates the window", async () => {
    const { ctx, scope } = await asking();
    const ops = [typing(ATOM, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), scope, authored(100, ops), 500))).toMatchObject({
      code: "base-outside-window",
      step: 1
    });
  });
});
