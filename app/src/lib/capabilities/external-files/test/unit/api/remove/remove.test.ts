import { describe, expect, it } from "vitest";
import { ingest } from "$external-files/api/ingest/ingest";
import { remove } from "$external-files/api/remove/remove";
import {
  arriving,
  asCtx,
  asking,
  projectNamed,
  refusalFrom,
  scopeOf
} from "$external-files/test/fixture";

describe("remove", () => {
  it("takes the bytes with the row, so nothing is left paid for and unreachable", async () => {
    const { ctx, scope, person } = await asking();
    const input = arriving("Q3 forecast.xlsx");
    const id = await ingest(asCtx(ctx), scope, person, input);

    await remove(asCtx(ctx), scope, id);

    expect(ctx.rows.has(id)).toBe(false);
    expect(ctx.blobsDeleted).toEqual([input.storageId]);
  });

  it("copies the name into the log before the row it names is gone", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("Q3 forecast.xlsx"));

    await remove(asCtx(ctx), scope, id);

    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "externalFile", id, label: "Q3 forecast.xlsx" }
    });
  });

  it("reports not found for a file in another project", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await ingest(asCtx(ctx), theirs, person, arriving("Their plan.docx"));

    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(ctx.rows.has(id)).toBe(true);
    expect(ctx.blobsDeleted).toEqual([]);
  });
});
