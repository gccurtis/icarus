import { describe, expect, it } from "vitest";
import { check, touchedBy } from "$revisions/api/submit/check";
import { RESOURCE, asCtx, asking, landed, refusalFrom } from "$revisions/test/fixture";
import type { Op, OpTarget } from "$revisions/types/change";

/**
 * One test per worked case in
 * [change conflicts](../../../../../../../docs/processes/change-conflicts.md),
 * because the ladder is a decision about someone else's typing: every rung that
 * rejects costs a resubmit, and the one rung that does not is the only place in
 * the system where a wrong answer is silent.
 */

const ATOM = "#b7x2/atoms/#a9x1";

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

const removing = (target: OpTarget, path: string, ids: string[]): Op => ({
  op: "remove",
  target,
  path,
  ids,
  after: null,
  values: []
});

/** What a client hands `submit`, with the `touched` the server derives from it. */
const authored = (baseRevision: number, ops: Op[]) => ({
  ...RESOURCE,
  baseRevision,
  ops,
  touched: touchedBy(ops)
});

describe("the conflict ladder", () => {
  it("applies when nothing intervened", async () => {
    const { ctx } = await asking();
    const ops = [typing(ATOM, 4, "", "hello ")];

    expect(await check(asCtx(ctx), authored(7, ops), 7)).toEqual(ops);
  });

  it("applies when touched sets are disjoint", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing("#b4x1/atoms/#a4x1", 4, "", "one ")]);
    const ops = [typing(ATOM, 4, "", "two ")];

    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual(ops);
  });

  it("applies when different atoms in one paragraph are edited", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing("#b7x2/atoms/#a9x3", 4, "", "one ")]);
    const ops = [typing(ATOM, 40, "", "two ")];

    // An offset is measured inside its own atom, so an edit to the atom beside
    // it moves nothing this op names.
    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual(ops);
  });

  it("shifts when the same atom is edited apart", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "", "strong ")]);
    const ops = [typing(ATOM, 40, "", "!")];

    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual([typing(ATOM, 47, "", "!")]);
  });

  it("rejects when the same atom is edited overlapping", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "quarterly", "Q3")]);
    const ops = [typing(ATOM, 6, "terly", "X")];

    expect(await refusalFrom(check(asCtx(ctx), authored(7, ops), 8))).toMatchObject({
      code: "offsets-overlap",
      step: 4
    });
  });

  it("shifts a mark past a concurrent text edit", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(ATOM, 4, "", "strong ")]);
    const ops = [marking("#b7x2/marks", { id: "m03", from: 20, to: 26 })];

    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual([
      marking("#b7x2/marks", { id: "m03", from: 27, to: 33 })
    ]);
  });

  it("applies two marks on different phrases", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [
      setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 0, to: 5 })
    ]);
    const ops = [setting("mark", "#b7x2/marks/#m07", { id: "m07", from: 10, to: 15 })];

    // A mark carries no text, so nothing in the block moved.
    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual(ops);
  });

  it("rejects when both changes reached for the same mark", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [
      setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 0, to: 5 })
    ]);
    const ops = [setting("mark", "#b7x2/marks/#m03", { id: "m03", from: 2, to: 9 })];

    // Not in the eleven worked cases, and the rung that resolves nearly
    // everything: with this rejection removed, all eleven still pass.
    expect(await refusalFrom(check(asCtx(ctx), authored(7, ops), 8))).toMatchObject({
      code: "touched-intersects",
      step: 2
    });
  });

  it("rejects an edit under a removed row", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [removing("row", "rows", ["#r4m1"])]);
    const ops = [typing(`#r4m1/blocks${ATOM}`, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), authored(7, ops), 8))).toMatchObject({
      code: "removed-under-edit",
      step: 3
    });
  });

  it("rejects when a formula re-resolved in the window", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [setting("atom", "#b7x2/atoms/#afx1/resolved", "$4.7M")]);
    const ops = [typing(ATOM, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), authored(7, ops), 8))).toMatchObject({
      code: "not-plain-text",
      step: 4
    });
  });

  it("applies two inserts after the same row", async () => {
    const { ctx, projectId } = await asking();
    await landed(ctx, projectId, 8, [inserting("row", "rows", "#r4m1", [{ id: "r9k2" }])]);
    const ops = [inserting("row", "rows", "#r4m1", [{ id: "r5t8" }])];

    // Both land, and their order is settled by revision rather than by the id
    // they were both placed after.
    expect(await check(asCtx(ctx), authored(7, ops), 8)).toEqual(ops);
  });

  it("rejects when baseRevision predates the window", async () => {
    const { ctx } = await asking();
    const ops = [typing(ATOM, 4, "", "x")];

    expect(await refusalFrom(check(asCtx(ctx), authored(100, ops), 500))).toMatchObject({
      code: "base-outside-window",
      step: 1
    });
  });
});
