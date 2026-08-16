import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import {
  RESOURCE,
  asCtx,
  asking,
  landed,
  leaderAt,
  refusalFrom,
  snapshotsStored
} from "$revisions/test/fixture";
import type { Op } from "$revisions/types/change";

/** A row insert placed after a named row: applying these out of order throws. */
const row = (id: string, after: string | null): Op => ({
  op: "insert",
  target: "row",
  path: "rows",
  after,
  values: [{ id }]
});

const empty = () => ({ rows: [] });

describe("read", () => {
  it("folds the recent sets onto the leader body, in revision order", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 4, empty());
    await landed(ctx, projectId, 5, [row("r1", null)]);
    await landed(ctx, projectId, 6, [row("r2", "#r1")]);

    expect(await read(asCtx(ctx), scope, RESOURCE)).toEqual({
      revision: 6,
      body: { rows: [{ id: "r1" }, { id: "r2" }] }
    });
  });

  it("leaves the leader row as it found it", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 4, empty());
    await landed(ctx, projectId, 5, [row("r1", null)]);

    await read(asCtx(ctx), scope, RESOURCE);

    // Folding onto the stored body would corrupt the anchor for every read after
    // this one, and a query cannot write anyway.
    expect(snapshotsStored(ctx)[0]).toMatchObject({ revision: 4, body: { rows: [] } });
  });

  it("reads at the leader when nothing has landed since", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 4, { rows: [{ id: "r1" }] });

    expect(await read(asCtx(ctx), scope, RESOURCE)).toEqual({
      revision: 4,
      body: { rows: [{ id: "r1" }] }
    });
  });

  it("ranges over this resource's recent sets past the leader and nothing else", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 4, empty());
    await landed(ctx, projectId, 3, [row("already-folded", null)]);
    await landed(ctx, projectId, 5, [row("re-tiered", null)], { tier: "historical" });
    await landed(ctx, projectId, 6, [row("theirs", null)], { resourceId: "documents:2" });
    await landed(ctx, projectId, 7, [row("r1", null)]);

    expect(await read(asCtx(ctx), scope, RESOURCE)).toEqual({
      revision: 7,
      body: { rows: [{ id: "r1" }] }
    });
  });

  it("reports not found for a resource in another project", async () => {
    const { ctx, scope, projectId } = await asking();
    const theirs = await ctx.db.insert("projects", { name: "Theirs", revision: 1, updatedAt: 1 });
    await leaderAt(ctx, theirs, 4, empty());
    await landed(ctx, projectId, 5, [row("r1", null)]);

    // Not "forbidden": telling the two apart confirms the resource exists to
    // someone with no right to know that.
    expect(await refusalFrom(read(asCtx(ctx), scope, RESOURCE))).toMatchObject({
      code: "not-found",
      message: expect.stringMatching(/not found/i)
    });
  });

  it("reports not found for a resource nothing anchored", async () => {
    const { ctx, scope, projectId } = await asking();
    await landed(ctx, projectId, 1, [row("r1", null)]);

    expect(await refusalFrom(read(asCtx(ctx), scope, RESOURCE))).toMatchObject({
      code: "not-found"
    });
  });
});
