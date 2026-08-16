import { describe, expect, it } from "vitest";
import { requirePersona } from "$personas/api/shared/require-persona";
import { asCtx, asking, globalPersona, personaIn, refusalFrom } from "$personas/test/fixture";

describe("requirePersona", () => {
  it("finds the caller's own, and the ones belonging to every project", async () => {
    const { ctx, scope } = await asking();
    const mine = await personaIn(ctx, scope.projectId, "Mine");
    const everyone = await globalPersona(ctx, "Everyone's");

    expect((await requirePersona(asCtx(ctx), scope, mine)).name).toBe("Mine");
    expect((await requirePersona(asCtx(ctx), scope, everyone)).name).toBe("Everyone's");
  });

  it("reports not found for one in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await personaIn(ctx, elsewhere.projectId, "Theirs");

    // Not "forbidden": distinguishing them confirms the persona exists to
    // someone with no right to know that.
    expect(await refusalFrom(requirePersona(asCtx(ctx), scope, theirs))).toMatchObject({
      code: "not-found"
    });
  });
});
