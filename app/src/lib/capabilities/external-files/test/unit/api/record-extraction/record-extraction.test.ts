import { describe, expect, it } from "vitest";
import { ingest } from "$external-files/api/ingest/ingest";
import { recordExtraction } from "$external-files/api/record-extraction/record-extraction";
import {
  arriving,
  asCtx,
  asking,
  projectNamed,
  refusalFrom,
  scopeOf
} from "$external-files/test/fixture";

describe("recordExtraction", () => {
  it("keeps what was read on the file, so the parse happens once", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("contract.pdf"));

    await recordExtraction(asCtx(ctx), scope, id, {
      state: "ready",
      text: "Master services agreement",
      pageCount: 12
    });

    expect(ctx.rows.get(id)?.extraction).toMatchObject({
      state: "ready",
      text: "Master services agreement",
      pageCount: 12
    });
  });

  it("stamps when it was read rather than believing the extractor's clock", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("contract.pdf"));

    await recordExtraction(asCtx(ctx), scope, id, { state: "ready", text: "…" });

    const extraction = ctx.rows.get(id)?.extraction as { extractedAt: number };
    expect(extraction.extractedAt).toBeGreaterThan(0);
  });

  /** `unsupported` and `error` are outcomes, not failures — the file is fine. */
  it("records an outcome it could not read as an outcome", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("scan.heic"));

    await recordExtraction(asCtx(ctx), scope, id, { state: "unsupported" });
    await recordExtraction(asCtx(ctx), scope, id, { state: "error", error: "Damaged header" });

    expect(ctx.rows.get(id)?.extraction).toMatchObject({
      state: "error",
      error: "Damaged header"
    });
  });

  it("attributes the entry to the system, because nobody chose to read the file", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("contract.pdf"));

    await recordExtraction(asCtx(ctx), scope, id, { state: "unsupported" });

    expect(ctx.log.at(-1)).toMatchObject({
      actor: { kind: "system" },
      verb: "extracted",
      detail: "unsupported",
      target: { type: "externalFile", id, label: "contract.pdf" }
    });
  });

  it("reports not found for a file in another project", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await ingest(asCtx(ctx), theirs, person, arriving("their contract.pdf"));

    expect(
      await refusalFrom(recordExtraction(asCtx(ctx), scope, id, { state: "ready", text: "…" }))
    ).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)?.extraction).toEqual({ state: "pending" });
  });
});
