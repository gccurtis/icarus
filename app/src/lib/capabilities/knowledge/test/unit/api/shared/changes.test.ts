import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import {
  CHANGE_HISTORY,
  changeHistory,
  indexedRevision,
  recordChange
} from "$knowledge/api/shared/changes";
import { ensureVersion } from "$knowledge/api/shared/version";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { aDocument, asCtx, asking, fakeEmbedder } from "$knowledge/test/fixture";

const nodeSet = (source: LatticeSource, unchanged = 0) => ({
  source,
  added: [] as Id<"latticeNodes">[],
  removed: [] as Id<"latticeNodes">[],
  unchanged
});

const resourceCause = (source: LatticeSource, revision: number) =>
  ({ kind: "resource", resourceType: "document", resourceId: source.id, revision }) as const;

describe("recordChange", () => {
  it("stamps the lattice version the change produced", async () => {
    const { ctx, scope } = await asking();
    const version = await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
    const source = await aDocument(ctx, scope);

    const id = await recordChange(asCtx(ctx), scope, {
      cause: resourceCause(source, 47),
      nodeSets: [nodeSet(source)],
      reclustered: [0, 2, 1]
    });

    // A lattice state and a document state line up through these two numbers.
    const row = await asCtx(ctx).db.get(id);
    expect(row?.version).toBe(version.version);
    expect(row?.reclustered).toEqual([0, 2, 1]);
  });

  it("keeps every source one cause touched in a single row", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
    const first = await aDocument(ctx, scope, "One");
    const second = await aDocument(ctx, scope, "Two");

    await recordChange(asCtx(ctx), scope, {
      cause: { kind: "connector_sync", connectorId: "connectors:1" },
      nodeSets: [nodeSet(first), nodeSet(second)]
    });

    // "These nodes appeared because of that sync" is one row — which is both how
    // a person reads it and how it is undone.
    const [row, ...rest] = await changeHistory(asCtx(ctx), scope);
    expect(rest).toEqual([]);
    expect(row.nodeSets).toHaveLength(2);
  });

  it("records no history for another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await ensureVersion(asCtx(ctx), elsewhere, fakeEmbedder().embedding);
    const source = await aDocument(ctx, elsewhere);
    await recordChange(asCtx(ctx), elsewhere, {
      cause: resourceCause(source, 1),
      nodeSets: [nodeSet(source)]
    });

    expect(await changeHistory(asCtx(ctx), scope)).toEqual([]);
  });

  it("drops the oldest and nothing else once the history is full", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
    const source = await aDocument(ctx, scope);

    for (let revision = 1; revision <= CHANGE_HISTORY + 2; revision++) {
      await recordChange(asCtx(ctx), scope, {
        cause: resourceCause(source, revision),
        nodeSets: [nodeSet(source)]
      });
    }

    // These rows explain, they do not reconstruct: the lattice can be rebuilt
    // from project content, so dropping one loses an explanation and no state.
    const history = await changeHistory(asCtx(ctx), scope);
    expect(history).toHaveLength(CHANGE_HISTORY);
    const revisions = history.map((row) =>
      row.cause.kind === "resource" ? row.cause.revision : 0
    );
    expect(revisions[0]).toBe(CHANGE_HISTORY + 2);
    expect(revisions.at(-1)).toBe(3);
  });
});

describe("indexedRevision", () => {
  it("answers with the revision the lattice last followed, so the gap is a subtraction", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
    const source = await aDocument(ctx, scope);
    const other = await aDocument(ctx, scope, "Other");
    for (const revision of [12, 47]) {
      await recordChange(asCtx(ctx), scope, {
        cause: resourceCause(source, revision),
        nodeSets: [nodeSet(source)]
      });
    }
    await recordChange(asCtx(ctx), scope, {
      cause: resourceCause(other, 3),
      nodeSets: [nodeSet(other)]
    });

    const history = await changeHistory(asCtx(ctx), scope);
    const indexed = indexedRevision(history, { resourceType: "document", resourceId: source.id });

    // Lattice version 214 reflects document revision 47. Without the link, a
    // stale retrieval result is unattributable — you can see the lattice is
    // behind, not what it is behind.
    expect(indexed).toBe(47);
    expect(60 - (indexed ?? 0)).toBe(13);
  });

  it("says nothing about a resource the lattice has never followed", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
    const source = await aDocument(ctx, scope);
    await recordChange(asCtx(ctx), scope, {
      cause: { kind: "rebuild", reason: "manual" },
      nodeSets: [nodeSet(source)]
    });

    // A rebuild followed no change set, so there is no revision to subtract
    // from — which is different from having followed revision zero.
    expect(
      indexedRevision(await changeHistory(asCtx(ctx), scope), {
        resourceType: "document",
        resourceId: source.id
      })
    ).toBeUndefined();
  });
});
