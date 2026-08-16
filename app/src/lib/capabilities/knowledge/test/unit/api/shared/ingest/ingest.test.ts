import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { neighbours, writeEdges } from "$knowledge/api/shared/edges";
import { ingest } from "$knowledge/api/shared/ingest/ingest";
import { readVersion } from "$knowledge/api/shared/version";
import { sourceKey, type LatticeSource } from "$knowledge/types/lattice-source";
import { asCtx, asking, aDocument, fakeEmbedder, paragraph } from "$knowledge/test/fixture";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

type StoredNode = {
  _id: string;
  projectId: string;
  level: number;
  tierSourceId?: string;
  clustered: boolean;
  windows: { source: LatticeSource; start: number; end: number; density: number }[];
  text?: string;
  centroid: number[];
  parentId?: string;
  staleAt?: number;
};

const nodesOf = (ctx: Ctx): StoredNode[] =>
  [...ctx.rows.entries()]
    .filter(([, row]) => row._table === "latticeNodes")
    .map(([id, row]) => ({ _id: id, ...row }) as unknown as StoredNode)
    .sort((left, right) => (left.windows[0]?.start ?? -1) - (right.windows[0]?.start ?? -1));

const sourceRows = (ctx: Ctx) =>
  [...ctx.rows.values()].filter((row) => row._table === "latticeSources");

const document = (n: number) => Array.from({ length: n }, (_, i) => paragraph(i)).join("");

describe("ingest", () => {
  it("reads a source into overlapping level-0 nodes", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    const text = document(6);

    const result = await ingest(asCtx(ctx), scope, { source, revision: "r1", text }, embedding);
    const nodes = nodesOf(ctx);

    expect(result.skipped).toBe(false);
    expect(nodes).toHaveLength(result.windows);
    expect(nodes.length).toBeGreaterThan(2);
    for (const node of nodes) {
      expect(node.projectId).toBe(scope.projectId);
      expect(node.level).toBe(0);
      expect(node.tierSourceId).toBe(sourceKey(source));
      // Nothing is clustered until a clustering pass runs, and this set is both
      // the work remaining and retrieval's frontier.
      expect(node.clustered).toBe(false);
      expect(node.windows).toHaveLength(1);
      expect(node.windows[0].source).toEqual(source);
      expect(node.windows[0].density).toBe(1);
      expect(node.text).toBe(text.slice(node.windows[0].start, node.windows[0].end));
      expect(node.centroid).toHaveLength(embedding.dimensions);
    }
    expect(nodes[1].windows[0].start).toBeLessThan(nodes[0].windows[0].end);
  });

  it("skips an unchanged source entirely", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    const text = document(6);
    await ingest(asCtx(ctx), scope, { source, revision: "r1", text }, embedder.embedding);
    const before = nodesOf(ctx).map((node) => node._id);
    embedder.batches.length = 0;

    const again = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text },
      embedder.embedding
    );

    // Entirely: the revision is compared before the text is windowed, so an
    // unchanged source costs one indexed read and not a hash of the corpus.
    expect(again.skipped).toBe(true);
    expect(embedder.batches).toEqual([]);
    expect(nodesOf(ctx).map((node) => node._id)).toEqual(before);
  });

  it("re-reads a source whose revision is unknown", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    await ingest(asCtx(ctx), scope, { source, revision: "", text: document(2) }, embedder.embedding);

    const again = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "", text: document(2) },
      embedder.embedding
    );

    // No revision is no evidence of sameness, and claiming otherwise would leave
    // a source that cannot say what it is permanently out of date.
    expect(again.skipped).toBe(false);
  });

  it("re-embeds one paragraph when one paragraph changed", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    const before = document(6);
    const first = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: before },
      embedder.embedding
    );
    const untouched = nodesOf(ctx).slice(0, -1);
    embedder.batches.length = 0;

    const edited = before.slice(0, before.lastIndexOf("Paragraph 5.")) + paragraph(99);
    const second = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r2", text: edited },
      embedder.embedding
    );

    // The headline property of the whole design: the count of texts sent to the
    // embedder, not the vectors that came back. An implementation that
    // re-embedded everything would produce identical vectors and pass a test
    // that only read them.
    expect(embedder.texts()).toHaveLength(1);
    expect(second.embedded).toBe(1);
    expect(second.reused).toBe(first.windows - 1);
    for (const node of untouched) {
      const kept = await ctx.db.get(node._id);
      expect(kept).not.toBeNull();
      expect((kept as unknown as StoredNode).centroid).toEqual(node.centroid);
    }
  });

  it("reports a changed passage as one node gone and one arrived, never a modification", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    const before = document(6);
    const first = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: before },
      embedder.embedding
    );

    const edited = before.slice(0, before.lastIndexOf("Paragraph 5.")) + paragraph(99);
    const second = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r2", text: edited },
      embedder.embedding
    );

    // A node's identity is its content and its embedding together, so changed
    // text is a different vector, a different point in the index, a different
    // node. Calling it a modification would imply the node survived the change.
    expect(first.nodeSet.source).toEqual(source);
    expect(first.nodeSet.added).toHaveLength(first.windows);
    expect(first.nodeSet.removed).toEqual([]);
    expect(first.nodeSet.unchanged).toBe(0);
    expect(second.nodeSet.added).toHaveLength(1);
    expect(second.nodeSet.removed).toHaveLength(1);
    // A count, not a list: a small edit to a large document leaves most of its
    // passages untouched.
    expect(second.nodeSet.unchanged).toBe(first.windows - 1);
    expect(await ctx.db.get(second.nodeSet.removed[0])).toBeNull();
    expect(await ctx.db.get(second.nodeSet.added[0])).not.toBeNull();
  });

  it("takes a dropped window's edges with it", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(6) },
      embedder.embedding
    );
    const [first, second] = nodesOf(ctx).map((node) => node._id as Id<"latticeNodes">);
    await writeEdges(
      asCtx(ctx),
      scope,
      0,
      [first, second],
      [{ fromId: first, toId: second, weight: 0.9 }]
    );

    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r2", text: document(2) },
      embedder.embedding
    );

    // Whatever survived the shortening is related to a window that is gone, and
    // a neighbour query has no way to notice that on its own.
    expect(await neighbours(asCtx(ctx), scope, second)).toEqual([]);
  });

  it("drops the windows a shorter source no longer has", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(6) },
      embedder.embedding
    );

    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r2", text: document(2) },
      embedder.embedding
    );

    const nodes = nodesOf(ctx);
    expect(nodes.length).toBeLessThan(3);
    expect(nodes.every((node) => node.text !== undefined)).toBe(true);
  });

  it("marks every cluster above a changed window stale", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(6) },
      embedder.embedding
    );
    const cluster = (await ctx.db.insert("latticeNodes", {
      projectId: scope.projectId,
      level: 1,
      clustered: false,
      windows: [],
      centroid: [1, 0],
      updatedAt: 0
    })) as Id<"latticeNodes">;
    for (const node of nodesOf(ctx).filter((n) => n.level === 0)) {
      await ctx.db.patch(node._id, { clustered: true, parentId: cluster });
    }

    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r2", text: document(3) },
      embedder.embedding
    );

    // A cluster built from a passage that no longer exists is stale whether or
    // not its own centroid moved.
    expect(((await ctx.db.get(cluster)) as unknown as StoredNode).staleAt).toBeGreaterThan(0);
  });

  it("records the level-0 count and leaves the lattice at one level", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();
    const source = await aDocument(ctx, scope);

    const result = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(6) },
      embedding
    );
    const version = await readVersion(asCtx(ctx), scope);

    // levelCount 1 means level 0 exists and nothing is clustered. That is where
    // ingestion leaves the lattice every time, and it is not a failure.
    expect(version?.levelCount).toBe(1);
    expect(version?.nodesByLevel).toEqual([result.windows]);
    expect(version?.nodeCount).toBe(result.windows);
    expect(version?.version).toBe(2);
  });

  it("remembers the revision it read, which is what lets the next one be skipped", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder();
    const source = await aDocument(ctx, scope);

    const result = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(6) },
      embedding
    );

    expect(sourceRows(ctx)).toEqual([
      expect.objectContaining({
        projectId: scope.projectId,
        source,
        revision: "r1",
        windowCount: result.windows
      })
    ]);
  });

  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const { embedding } = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: document(2) },
      embedding
    );
    const mine = nodesOf(ctx).length;

    await ingest(
      asCtx(ctx),
      elsewhere,
      { source, revision: "r1", text: document(2) },
      embedding
    );

    // The same source id in another project is another project's lattice: its
    // own version row, its own nodes, and nothing skipped by the first pass.
    expect(nodesOf(ctx).filter((node) => node.projectId === scope.projectId)).toHaveLength(mine);
    expect(nodesOf(ctx).filter((node) => node.projectId === elsewhere.projectId)).toHaveLength(
      mine
    );
  });

  it("leaves no orphan when the source held two nodes of identical text", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);
    const text = paragraph(1);
    for (const start of [0, 0]) {
      await ctx.db.insert("latticeNodes", {
        projectId: scope.projectId,
        level: 0,
        tierSourceId: sourceKey(source),
        clustered: false,
        windows: [{ source, start, end: text.length, density: 1 }],
        text,
        centroid: [1, 0],
        updatedAt: 0
      });
    }

    await ingest(asCtx(ctx), scope, { source, revision: "r1", text }, embedder.embedding);

    // Reuse is keyed on content, so two nodes carrying one text answer to one
    // key. Matched one-to-one, the second would be a row nothing ever deletes.
    expect(nodesOf(ctx)).toHaveLength(1);
    expect(embedder.batches).toEqual([]);
  });

  it("indexes nothing out of an empty source, and says so", async () => {
    const { ctx, scope } = await asking();
    const embedder = fakeEmbedder();
    const source = await aDocument(ctx, scope);

    const result = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: "   \n " },
      embedder.embedding
    );

    expect(result.windows).toBe(0);
    expect(embedder.batches).toEqual([]);
    expect(nodesOf(ctx)).toEqual([]);
  });
});
