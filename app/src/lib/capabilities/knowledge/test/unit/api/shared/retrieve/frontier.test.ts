import { describe, expect, it } from "vitest";
import { frontier } from "$knowledge/api/shared/retrieve/frontier";
import { sourceKey } from "$knowledge/types/lattice-source";
import {
  aCorpus,
  aDocument,
  aNode,
  asCtx,
  asking,
  latticeNodes,
  leaning
} from "$knowledge/test/fixture";

describe("frontier", () => {
  it("is exactly the unclustered set", async () => {
    const { ctx, scope } = await asking();
    await aCorpus(ctx, scope, { groups: 3 });

    const entered = await frontier(asCtx(ctx), scope);

    const unclustered = latticeNodes(ctx, scope).filter((node) => !node.clustered);
    expect(entered.map((node) => node._id).sort()).toEqual(
      unclustered.map((node) => node._id).sort()
    );
    expect(entered).toHaveLength(3);
  });

  it("enters through an orphan window as readily as through a cluster", async () => {
    const { ctx, scope } = await asking();
    const { clusters } = await aCorpus(ctx, scope, { groups: 2 });
    const source = await aDocument(ctx, scope, "Loose");
    const orphan = await aNode(ctx, scope, {
      centroid: leaning(3, 0, 45),
      tierSourceId: sourceKey(source),
      windows: [{ source, start: 0, end: 40, density: 1 }],
      text: "A paragraph nothing else in the project"
    });

    const entered = await frontier(asCtx(ctx), scope);

    // A window no cluster took in is a root, not a loose end: it has no parent,
    // so nothing else can reach it and dropping it would make it unsearchable.
    expect(entered.map((node) => node._id).sort()).toEqual([...clusters, orphan].sort());
  });

  it("reads the caller's project and no other", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await aCorpus(ctx, scope, { groups: 2 });
    await aCorpus(ctx, elsewhere, { groups: 2 });

    const entered = await frontier(asCtx(ctx), scope);

    expect(entered.every((node) => node.projectId === scope.projectId)).toBe(true);
    expect(entered).toHaveLength(2);
  });
});
