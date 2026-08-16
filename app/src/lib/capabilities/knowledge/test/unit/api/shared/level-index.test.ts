import { describe, expect, it } from "vitest";
import {
  readLevelIndex,
  staleLevelIndex,
  writeLevelIndex
} from "$knowledge/api/shared/level-index";
import type { LevelIndex } from "$knowledge/types/level-index";
import { asCtx, asking } from "$knowledge/test/fixture";

const SENTINEL = 1;

const fitted = (over: Partial<LevelIndex> = {}): LevelIndex => ({
  level: 1,
  threshold: 0.42,
  k: 32,
  basis: [
    [1, 0],
    [0, 1]
  ],
  centroids: [[0.6, 0.8]],
  ...over
});

describe("staleLevelIndex", () => {
  it("calls an index fitted under another threshold stale", () => {
    // Storing the threshold beside the basis is what makes this answerable at
    // all: without it a row from another parameter set is indistinguishable
    // from one that still holds, and would be mixed in rather than refitted.
    expect(staleLevelIndex(fitted(), fitted({ threshold: 0.55 }))).toBe(true);
  });

  it("calls an index fitted under another k stale", () => {
    expect(staleLevelIndex(fitted(), fitted({ k: 16 }))).toBe(true);
  });

  it("calls one built under the same parameters current", () => {
    expect(staleLevelIndex(fitted(), fitted())).toBe(false);
  });
});

describe("writeLevelIndex", () => {
  it("keeps one index per level, scoped to the caller's project", async () => {
    const { ctx, scope, elsewhere } = await asking();

    await writeLevelIndex(asCtx(ctx), scope, fitted());
    await writeLevelIndex(asCtx(ctx), scope, fitted({ threshold: 0.5 }));
    await writeLevelIndex(asCtx(ctx), scope, fitted({ level: 2 }));
    await writeLevelIndex(asCtx(ctx), elsewhere, fitted());

    const mine = await readLevelIndex(asCtx(ctx), scope, 1);
    expect(mine?.threshold).toBe(0.5);
    expect(await readLevelIndex(asCtx(ctx), scope, 2)).not.toBeNull();
    expect(
      [...ctx.rows.values()].filter((row) => row._table === "latticeLevelIndexes")
    ).toHaveLength(3);
  });

  it("reports nothing for a level indexed in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await writeLevelIndex(asCtx(ctx), elsewhere, fitted());

    expect(await readLevelIndex(asCtx(ctx), scope, 1)).toBeNull();
  });

  it("replaces a stale index rather than mixing it with the one that replaced it", async () => {
    const { ctx, scope } = await asking();
    await writeLevelIndex(asCtx(ctx), scope, fitted());
    const before = await readLevelIndex(asCtx(ctx), scope, 1);
    await ctx.db.patch(before!._id, { updatedAt: SENTINEL });

    await writeLevelIndex(asCtx(ctx), scope, fitted({ threshold: 0.6, basis: [[0, 1]] }));

    const after = await readLevelIndex(asCtx(ctx), scope, 1);
    expect(after?.basis).toEqual([[0, 1]]);
    expect(after?.updatedAt).not.toBe(SENTINEL);
  });

  it("leaves an index its parameters still describe alone", async () => {
    const { ctx, scope } = await asking();
    await writeLevelIndex(asCtx(ctx), scope, fitted());
    const before = await readLevelIndex(asCtx(ctx), scope, 1);
    await ctx.db.patch(before!._id, { updatedAt: SENTINEL });

    await writeLevelIndex(asCtx(ctx), scope, fitted());

    // The basis is by far the largest row this capability writes, and rewriting
    // it every pass to say nothing changed costs more than the timestamp is
    // worth.
    expect((await readLevelIndex(asCtx(ctx), scope, 1))?.updatedAt).toBe(SENTINEL);
  });

  it("is derived: dropping every index and rebuilding loses nothing", async () => {
    const { ctx, scope } = await asking();
    await writeLevelIndex(asCtx(ctx), scope, fitted());
    const before = await readLevelIndex(asCtx(ctx), scope, 1);

    await ctx.db.delete(before!._id);
    await writeLevelIndex(asCtx(ctx), scope, fitted());
    const after = await readLevelIndex(asCtx(ctx), scope, 1);

    // Nothing here is authored, so a dropped index costs a refit and no data.
    // That is what makes changing pcaDims, k, or the cell count a rebuild.
    expect({ ...after, _id: undefined, _creationTime: undefined, updatedAt: undefined }).toEqual({
      ...before,
      _id: undefined,
      _creationTime: undefined,
      updatedAt: undefined
    });
  });
});
