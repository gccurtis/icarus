import { describe, expect, it } from "vitest";
import { create } from "$findings/api/create/create";
import { requireFinding } from "$findings/api/shared/require-finding";
import { asCtx, asking, refusalFrom } from "$findings/test/fixture";

describe("requireFinding", () => {
  it("returns the stored row, which both callers read the revision from", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, { title: "Margin fell", body: [], sources: [] });

    expect(await requireFinding(asCtx(ctx), scope, id)).toMatchObject({
      title: "Margin fell",
      revision: 1
    });
  });

  it("answers for a finding in another project exactly as for one that never existed", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await create(asCtx(ctx), elsewhere, { title: "Theirs", body: [], sources: [] });

    const forTheirs = await refusalFrom(requireFinding(asCtx(ctx), scope, theirs));
    const forNothing = await refusalFrom(
      requireFinding(asCtx(ctx), scope, "findings:404" as typeof theirs)
    );

    expect(forTheirs).toMatchObject({ code: "not-found" });
    expect(forNothing?.code).toBe(forTheirs?.code);
  });
});
