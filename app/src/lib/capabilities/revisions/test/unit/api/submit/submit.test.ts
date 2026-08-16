import { describe, expect, it } from "vitest";
import { submit } from "$revisions/api/submit/submit";
import {
  RESOURCE,
  asCtx,
  asking,
  landed,
  refusalFrom,
  setAt,
  setsStored
} from "$revisions/test/fixture";
import type { Op } from "$revisions/types/change";

const ATOM = "#b7x2/atoms/#a9x1";

const typing = (at: number, insert: string): Op => ({
  op: "text",
  target: "atom",
  path: ATOM,
  at,
  insert,
  remove: ""
});

const authored = (baseRevision: number, ops: Op[]) => ({ ...RESOURCE, baseRevision, ops });

describe("submit", () => {
  it("appends one revision above the last accepted set", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(4, "one ")]);

    const { revision } = await submit(asCtx(ctx), scope, authored(8, [typing(40, "two ")]));

    expect(revision).toBe(9);
    expect(setAt(ctx, 9)).toMatchObject({
      projectId,
      ...RESOURCE,
      baseRevision: 8,
      tier: "recent"
    });
  });

  it("starts a resource nothing has written at revision 1", async () => {
    const { ctx, scope } = await asking();

    expect(await submit(asCtx(ctx), scope, authored(0, [typing(0, "Hello")]))).toEqual({
      revision: 1
    });
  });

  it("counts from the leader when consolidation has taken the sets behind it", async () => {
    const { ctx, scope, projectId } = await asking();
    await ctx.db.insert("resourceSnapshots", {
      projectId,
      ...RESOURCE,
      revision: 12,
      role: "leader",
      body: {},
      at: 1
    });

    expect(await submit(asCtx(ctx), scope, authored(12, [typing(0, "x")]))).toEqual({
      revision: 13
    });
  });

  it("stores what the ladder returned rather than what it was handed", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 8, [typing(4, "strong ")]);

    await submit(asCtx(ctx), scope, authored(7, [typing(40, "!")]));

    expect(setAt(ctx, 9)).toMatchObject({ ops: [{ at: 47 }] });
  });

  it("derives touched from the ops rather than trusting the caller", async () => {
    const { ctx, scope } = await asking();
    const inserting: Op = {
      op: "insert",
      target: "row",
      path: "rows",
      after: "#r4m1",
      values: [{ id: "r9k2" }]
    };

    await submit(asCtx(ctx), scope, authored(0, [inserting]));

    // The row it created, not the row it was placed after — otherwise two people
    // adding a row in one place would collide.
    expect(setAt(ctx, 1)).toMatchObject({ touched: ["r9k2"] });
  });

  it("attributes the set to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    await submit(asCtx(ctx), scope, authored(0, [typing(0, "Hello")]));

    expect(setAt(ctx, 1)).toMatchObject({ actor: { kind: "user", userId } });
  });

  it("reports not found for a resource in another project", async () => {
    const { ctx, scope } = await asking();
    const theirs = await ctx.db.insert("projects", { name: "Theirs", revision: 1, updatedAt: 1 });
    await landed(ctx, theirs, 8, [typing(4, "one ")]);

    // Not "forbidden": telling the two apart confirms the resource exists to
    // someone with no right to know that.
    expect(
      await refusalFrom(submit(asCtx(ctx), scope, authored(8, [typing(40, "two ")])))
    ).toMatchObject({ code: "not-found" });
    expect(setsStored(ctx)).toHaveLength(1);
  });
});
