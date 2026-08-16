import { describe, expect, it } from "vitest";
import { ingest } from "$external-files/api/ingest/ingest";
import { list } from "$external-files/api/list/list";
import { arriving, asCtx, asking, projectNamed, scopeOf } from "$external-files/test/fixture";

describe("list", () => {
  it("gives a file list everything it renders without opening a byte", async () => {
    const { ctx, scope, person, userId } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("Q3 forecast.xlsx"));

    expect(await list(asCtx(ctx), scope)).toMatchObject([
      {
        id,
        name: "Q3 forecast.xlsx",
        extension: "xlsx",
        kind: "ext-data",
        mimeType: "application/octet-stream",
        size: 4096,
        origin: { kind: "upload" },
        extraction: { state: "pending" },
        createdBy: { kind: "user", userId }
      }
    ]);
  });

  it("carries what a file replaces, because the chain is the whole history", async () => {
    const { ctx, scope, person } = await asking();
    const first = await ingest(asCtx(ctx), scope, person, arriving("Plan.docx"));
    await ingest(asCtx(ctx), scope, person, {
      ...arriving("Plan.docx"),
      supersedes: first
    });

    // Both rows: superseding does not retire the old file, and a reference made
    // to it still resolves.
    expect((await list(asCtx(ctx), scope)).map((file) => file.supersedes)).toEqual([
      undefined,
      first
    ]);
  });

  it("returns no file from another project", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await ingest(asCtx(ctx), theirs, person, arriving("Their plan.docx"));

    expect(await list(asCtx(ctx), scope)).toEqual([]);
  });
});
