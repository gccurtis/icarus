import { describe, expect, it } from "vitest";
import { revise } from "$personas/api/revise/revise";
import {
  asCtx,
  asking,
  definitionOf,
  draft,
  globalPersona,
  personaIn,
  refusalFrom
} from "$personas/test/fixture";

describe("revise", () => {
  it("replaces the persona and moves the revision on", async () => {
    const { ctx, scope } = await asking();
    const id = await personaIn(ctx, scope.projectId, "Researcher");

    await revise(asCtx(ctx), scope, id, 1, {
      ...draft("Analyst"),
      definition: definitionOf({ approach: "Cite every number" })
    });

    expect(ctx.rows.get(id)).toMatchObject({
      name: "Analyst",
      definition: definitionOf({ approach: "Cite every number" }),
      revision: 2
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "revised",
      target: { type: "persona", id, label: "Analyst" }
    });
  });

  /**
   * Past work shows the persona as it is now — a task references it by id and
   * does not copy it — so an edit is visible everywhere at once, which is what
   * makes the stale check matter.
   */
  it("refuses a revision the author did not open, writing nothing", async () => {
    const { ctx, scope } = await asking();
    const id = await personaIn(ctx, scope.projectId, "Researcher");

    expect(await refusalFrom(revise(asCtx(ctx), scope, id, 7, draft("Analyst")))).toMatchObject({
      code: "stale"
    });
    expect(ctx.rows.get(id)).toMatchObject({ name: "Researcher", revision: 1 });
  });

  it("refuses a global persona as not editable, because the caller can see it", async () => {
    const { ctx, scope } = await asking();
    const id = await globalPersona(ctx, "Everyone's");

    // Not "not found": it is in the list they just read, and the thing they need
    // told is to copy it.
    expect(await refusalFrom(revise(asCtx(ctx), scope, id, 1, draft()))).toMatchObject({
      code: "not-editable"
    });
  });

  it("reports not found for a persona in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await personaIn(ctx, elsewhere.projectId, "Theirs");

    expect(await refusalFrom(revise(asCtx(ctx), scope, id, 1, draft()))).toMatchObject({
      code: "not-found"
    });
  });
});
