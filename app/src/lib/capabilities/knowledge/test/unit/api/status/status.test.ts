import { describe, expect, it } from "vitest";
import { ingest } from "$knowledge/api/shared/ingest/ingest";
import { status } from "$knowledge/api/status/status";
import { ensureVersion } from "$knowledge/api/shared/version";
import { asCtx, asking, aDocument, fakeEmbedder, paragraph } from "$knowledge/test/fixture";

describe("status", () => {
  it("answers with nothing for a project that has indexed nothing", async () => {
    const { ctx, scope } = await asking();

    // Not a refusal and not an error: a project with no lattice is the ordinary
    // state of a project nobody has written in yet.
    expect(await status(asCtx(ctx), scope)).toBeNull();
  });

  it("reports readiness, depth, and what built it", async () => {
    const { ctx, scope } = await asking();
    const { embedding } = fakeEmbedder("provider/embed-3-small");
    const source = await aDocument(ctx, scope);
    const result = await ingest(
      asCtx(ctx),
      scope,
      { source, revision: "r1", text: paragraph(1) },
      embedding
    );

    expect(await status(asCtx(ctx), scope)).toEqual({
      version: 2,
      embeddingModel: "provider/embed-3-small",
      embeddingBinding: "embedding",
      dimensions: embedding.dimensions,
      levelCount: 1,
      nodeCount: result.windows,
      nodesByLevel: [result.windows],
      staleCount: 0,
      state: "ready",
      error: undefined,
      rebuildReason: undefined,
      updatedAt: expect.any(Number)
    });
  });

  it("reports another project's lattice as no lattice", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await ensureVersion(asCtx(ctx), elsewhere, fakeEmbedder().embedding);

    expect(await status(asCtx(ctx), scope)).toBeNull();
  });

  it("returns the model rather than the row", async () => {
    const { ctx, scope } = await asking();
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);

    const answer = await status(asCtx(ctx), scope);

    // Converted at the boundary, so where the lattice is stored cannot leak into
    // the public contract — and the project is the caller's own scope, never
    // something they read back off an answer.
    expect(answer).not.toHaveProperty("_id");
    expect(answer).not.toHaveProperty("_creationTime");
    expect(answer).not.toHaveProperty("projectId");
  });
});
