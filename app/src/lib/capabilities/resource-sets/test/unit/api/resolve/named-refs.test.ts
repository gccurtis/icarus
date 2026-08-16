import { describe, expect, it } from "vitest";
import { namedRefs } from "$resource-sets/api/resolve/named-refs";
import { aDocument, aFile, aFinding, asCtx, asking } from "$resource-sets/test/fixture";

describe("namedRefs", () => {
  it("keeps a named resource, kind and all", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const finding = await aFinding(ctx, scope);

    expect(
      await namedRefs(asCtx(ctx), scope, [
        { kind: "document", id: notes },
        { kind: "finding", id: finding }
      ])
    ).toEqual([
      { kind: "document", id: notes },
      { kind: "finding", id: finding }
    ]);
  });

  it("drops a resource that has since been deleted rather than failing", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const gone = await aDocument(ctx, scope, "Deleted");
    await ctx.db.delete(gone);

    // A set outlives what it names. Refusing here would make one deletion break
    // every scope that ever mentioned the thing.
    expect(await namedRefs(asCtx(ctx), scope, [
      { kind: "document", id: notes },
      { kind: "document", id: gone }
    ])).toEqual([{ kind: "document", id: notes }]);
  });

  it("drops another project's resource, and says nothing about it", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await aDocument(ctx, elsewhere, "Theirs");

    // Identical to a ref that names nothing: telling them apart would confirm
    // the document exists to someone with no right to know that.
    expect(await namedRefs(asCtx(ctx), scope, [{ kind: "document", id: theirs }])).toEqual([]);
  });

  it("drops an id minted for another table", async () => {
    const { ctx, scope } = await asking();
    const finding = await aFinding(ctx, scope);

    // The kind travels with the id so resolution probes no table; a pair that
    // disagrees is not a resource, and trusting the kind would read the wrong row.
    expect(await namedRefs(asCtx(ctx), scope, [{ kind: "document", id: finding }])).toEqual([]);
  });

  it("expands a named connector to its files", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const pulled = await aFile(ctx, scope, "roadmap.md", "connectors:notion");
    await aFile(ctx, scope, "uploaded.md");

    expect(
      await namedRefs(asCtx(ctx), scope, [
        { kind: "document", id: notes },
        { kind: "connector", id: "connectors:notion" }
      ])
    ).toEqual([
      { kind: "document", id: notes },
      { kind: "externalFile", id: pulled }
    ]);
  });
});
