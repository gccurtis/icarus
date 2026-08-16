import { describe, expect, it } from "vitest";
import { kindRefs } from "$resource-sets/api/resolve/kind-refs";
import {
  aDeck,
  aDocument,
  aFile,
  aFinding,
  aTemplate,
  asCtx,
  asking,
  scopeOf
} from "$resource-sets/test/fixture";

describe("kindRefs", () => {
  it("takes one kind's rows and tags each with the kind it came from", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const brief = await aDocument(ctx, scope, "Brief");
    await aDeck(ctx, scope);
    await aFinding(ctx, scope);

    // The kind travels with the id because a set has to be resolvable without
    // probing every table to find out what each id is.
    expect(await kindRefs(asCtx(ctx), scope, "document")).toEqual([
      { kind: "document", id: notes },
      { kind: "document", id: brief }
    ]);
  });

  it("takes a kind lazily, so a row created after the set was saved is in it", async () => {
    const { ctx, scope } = await asking();
    const first = await aFinding(ctx, scope, "Margin fell");

    expect(await kindRefs(asCtx(ctx), scope, "finding")).toHaveLength(1);

    const later = await aFinding(ctx, scope, "And kept falling");

    expect(await kindRefs(asCtx(ctx), scope, "finding")).toEqual([
      { kind: "finding", id: first },
      { kind: "finding", id: later }
    ]);
  });

  it("reaches no other project's rows", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await aDocument(ctx, elsewhere, "Theirs");

    expect(await kindRefs(asCtx(ctx), scope, "document")).toEqual([]);
  });

  it("leaves out a template belonging to no project", async () => {
    const { ctx, scope } = await asking();
    const mine = await aTemplate(ctx, scope, "Weekly report");
    await aTemplate(ctx, scopeOf(undefined as unknown as string, "users:1"), "Everyone's");

    // A set selects what a project holds. A global template is available to
    // every project and held by none, so it is in nobody's set.
    expect(await kindRefs(asCtx(ctx), scope, "template")).toEqual([
      { kind: "template", id: mine }
    ]);
  });

  it("resolves the connector kind to synced files rather than connector rows", async () => {
    const { ctx, scope } = await asking();
    const pulled = await aFile(ctx, scope, "roadmap.md", "connectors:notion");
    await aFile(ctx, scope, "uploaded.md");

    expect(await kindRefs(asCtx(ctx), scope, "connector")).toEqual([
      { kind: "externalFile", id: pulled }
    ]);
  });
});
