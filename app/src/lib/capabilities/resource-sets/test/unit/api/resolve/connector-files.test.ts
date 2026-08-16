import { describe, expect, it } from "vitest";
import { connectorFiles } from "$resource-sets/api/resolve/connector-files";
import { aFile, asCtx, asking } from "$resource-sets/test/fixture";

describe("connectorFiles", () => {
  it("expands a connector to the files it brought in, never to the connector", async () => {
    const { ctx, scope } = await asking();
    const pulled = await aFile(ctx, scope, "roadmap.md", "connectors:notion");
    const alsoPulled = await aFile(ctx, scope, "specs.md", "connectors:notion");
    await aFile(ctx, scope, "drive-doc.md", "connectors:drive");
    await aFile(ctx, scope, "uploaded.md");

    // "Answer from the material in our Notion", not "answer from a credential
    // record" — which is why a connector is a resource kind at all.
    expect(await connectorFiles(asCtx(ctx), scope, "connectors:notion")).toEqual([
      { kind: "externalFile", id: pulled },
      { kind: "externalFile", id: alsoPulled }
    ]);
  });

  it("takes every connector's files when none is named", async () => {
    const { ctx, scope } = await asking();
    const notion = await aFile(ctx, scope, "roadmap.md", "connectors:notion");
    const drive = await aFile(ctx, scope, "drive-doc.md", "connectors:drive");
    await aFile(ctx, scope, "uploaded.md");

    // `{ op: "kind", kind: "connector" }` is "everything we synced", so an
    // upload is not in it.
    expect(await connectorFiles(asCtx(ctx), scope)).toEqual([
      { kind: "externalFile", id: notion },
      { kind: "externalFile", id: drive }
    ]);
  });

  it("reaches no other project's files", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await aFile(ctx, elsewhere, "theirs.md", "connectors:notion");

    expect(await connectorFiles(asCtx(ctx), scope, "connectors:notion")).toEqual([]);
    expect(await connectorFiles(asCtx(ctx), scope)).toEqual([]);
  });
});
