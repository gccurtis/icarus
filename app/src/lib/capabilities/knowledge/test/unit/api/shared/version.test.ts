import { describe, expect, it } from "vitest";
import {
  advanceVersion,
  embeddingDrift,
  ensureVersion,
  readVersion
} from "$knowledge/api/shared/version";
import type { LatticeVersion } from "$knowledge/types/lattice-version";
import { asCtx, asking, fakeEmbedder, refusalFrom } from "$knowledge/test/fixture";

const rowsOf = (ctx: Awaited<ReturnType<typeof asking>>["ctx"], table: string) =>
  [...ctx.rows.values()].filter((row) => row._table === table);

describe("ensureVersion", () => {
  it("starts a project's lattice with level 0 and nothing clustered", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();

    const version = await ensureVersion(asCtx(ctx), scope, embedding);

    // levelCount 1 is the normal state between ingestion and a clustering pass,
    // not a failure: windows are embedded as content arrives, clustering runs
    // after, and retrieval has to know which of the two it is looking at.
    expect(version.levelCount).toBe(1);
    expect(version.nodesByLevel).toEqual([0]);
    expect(version.state).toBe("ready");
    expect(version.version).toBe(1);
  });

  it("stores the binding beside the model it resolved to", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder("provider/embed-3-small");

    const version = await ensureVersion(asCtx(ctx), scope, embedding);

    expect(version.embeddingBinding).toBe("embedding");
    expect(version.embeddingModel).toBe("provider/embed-3-small");
  });

  it("refuses a second row for one project", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();

    const first = await ensureVersion(asCtx(ctx), scope, embedding);
    const second = await ensureVersion(asCtx(ctx), scope, embedding);

    // Two would mean two answers to "what does this project know", with nothing
    // to say which is right. Convex has no unique index, so this one function
    // is the enforcement — a second insert anywhere else breaks it silently.
    expect(second._id).toBe(first._id);
    expect(rowsOf(ctx, "latticeVersions")).toHaveLength(1);
  });

  it("gives each project its own", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const { embedding } = fakeEmbedder();

    const mine = await ensureVersion(asCtx(ctx), scope, embedding);
    const theirs = await ensureVersion(asCtx(ctx), elsewhere, embedding);

    expect(theirs._id).not.toBe(mine._id);
    expect(rowsOf(ctx, "latticeVersions")).toHaveLength(2);
  });

  it("refuses to carry on after the binding is repointed", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder("embed-v1").embedding);

    const refusal = await refusalFrom(
      ensureVersion(asCtx(ctx), scope, fakeEmbedder("embed-v2").embedding)
    );

    // Distances between vectors from two models are meaningless, so adding to
    // the index rather than rebuilding it is the one thing that must not happen.
    expect(refusal?.code).toBe("embedding-changed");
  });
});

describe("embeddingDrift", () => {
  const built: LatticeVersion = {
    version: 3,
    embeddingModel: "embed-v1",
    embeddingBinding: "embedding",
    dimensions: 1536,
    levelCount: 1,
    nodeCount: 4,
    nodesByLevel: [4],
    staleCount: 0,
    state: "ready",
    updatedAt: 0
  };

  it("sees nothing when the binding still points where it did", () => {
    const { embedding } = fakeEmbedder("embed-v1");

    expect(embeddingDrift(built, { ...embedding, dimensions: 1536 })).toBeUndefined();
  });

  it("detects a repointed binding, which is the reason both are stored", () => {
    const { embedding } = fakeEmbedder("embed-v2");

    expect(embeddingDrift(built, { ...embedding, dimensions: 1536 })).toBe("embedding_changed");
  });

  it("detects a model of a different width under the same name", () => {
    const { embedding } = fakeEmbedder("embed-v1");

    expect(embeddingDrift(built, { ...embedding, dimensions: 3072 })).toBe("embedding_changed");
  });

  it("says nothing about a binding renamed to point at the same model", () => {
    // The binding is where to look when this needs fixing, not the invariant.
    // What makes vectors comparable is the model, and it has not moved.
    const { embedding } = fakeEmbedder("embed-v1");

    expect(
      embeddingDrift(built, { ...embedding, binding: "embedding-fast", dimensions: 1536 })
    ).toBeUndefined();
  });
});

describe("advanceVersion", () => {
  it("counts a level's nodes and moves the version on", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();
    const before = await ensureVersion(asCtx(ctx), scope, embedding);

    const after = await advanceVersion(asCtx(ctx), before._id, {
      nodesByLevel: [7],
      staleCount: 2
    });

    expect(after.version).toBe(before.version + 1);
    expect(after.nodeCount).toBe(7);
    expect(after.nodesByLevel).toEqual([7]);
    expect(after.staleCount).toBe(2);
    expect(after.levelCount).toBe(1);
  });
});

describe("readVersion", () => {
  it("answers with nothing before anything has been indexed", async () => {
    const { ctx, scope } = await asking();

    expect(await readVersion(asCtx(ctx), scope)).toBeNull();
  });

  it("reads no other project's row", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await ensureVersion(asCtx(ctx), elsewhere, fakeEmbedder().embedding);

    expect(await readVersion(asCtx(ctx), scope)).toBeNull();
  });
});
