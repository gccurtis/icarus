import { describe, expect, it } from "vitest";
import { list } from "$personas/api/list/list";
import { asCtx, asking, globalPersona, personaIn } from "$personas/test/fixture";

describe("list", () => {
  it("returns the project's personas and the ones belonging to every project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await personaIn(ctx, scope.projectId, "Mine");
    await globalPersona(ctx, "Everyone's");
    await personaIn(ctx, elsewhere.projectId, "Theirs");

    const found = await list(asCtx(ctx), scope);

    expect(found.map((persona) => persona.name).sort()).toEqual(["Everyone's", "Mine"]);
  });

  it("says which ones the caller may edit, rather than which project they are in", async () => {
    const { ctx, scope } = await asking();
    await personaIn(ctx, scope.projectId, "Mine");
    await globalPersona(ctx, "Everyone's");

    const found = await list(asCtx(ctx), scope);

    expect(found.find((persona) => persona.name === "Mine")?.global).toBe(false);
    expect(found.find((persona) => persona.name === "Everyone's")?.global).toBe(true);
    for (const persona of found) expect(persona).not.toHaveProperty("projectId");
  });

  it("brings the definition with it, so an editor needs no second read", async () => {
    const { ctx, scope } = await asking();
    await personaIn(ctx, scope.projectId, "Mine");

    const [persona] = await list(asCtx(ctx), scope);

    expect(persona.definition.focus).toBe("Mine");
  });
});
