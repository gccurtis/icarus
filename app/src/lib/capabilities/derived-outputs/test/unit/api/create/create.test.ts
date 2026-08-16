import { describe, expect, it } from "vitest";
import { create } from "$derived-outputs/api/create/create";
import type { DerivedInput } from "$derived-outputs/types/derived-output";
import { asCtx, asking, refusalFrom, stored } from "$derived-outputs/test/fixture";

const draft = {
  prompt: "Summarize the pricing findings",
  inputs: [{ kind: "lattice", query: "pricing" }] as DerivedInput[]
};

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, mine } = await asking();

    const id = await create(asCtx(ctx), scope, draft);

    expect(stored(ctx, id)).toMatchObject({ projectId: mine, prompt: draft.prompt });
  });

  it("starts idle, with something to render and nothing generated", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, draft);

    // `block` is required and never cleared, so an output has a block from the
    // moment it exists. `inputsAt` is empty because nothing has been generated,
    // and there is therefore nothing it was generated from.
    expect(stored(ctx, id)).toMatchObject({
      state: "idle",
      block: { type: "text", display: "", atoms: [], marks: [] },
      inputsAt: []
    });
    expect(stored(ctx, id).refreshedAt).toBeUndefined();
  });

  it("keeps the scope as an expression, resolved when it is used", async () => {
    const { ctx, scope } = await asking();
    const expression = { op: "kind", kind: "document" } as const;

    const id = await create(asCtx(ctx), scope, { ...draft, scope: expression });

    expect(stored(ctx, id).scope).toEqual(expression);
  });

  it("attributes the declaration to the caller, from the scope", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, draft);

    expect(stored(ctx, id).createdBy).toEqual({ kind: "user", userId });
  });

  it("refuses a prompt with nothing in it", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(create(asCtx(ctx), scope, { ...draft, prompt: "  " }))).toMatchObject({
      code: "empty-prompt"
    });
  });

  it("refuses a lattice input that could retrieve nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(
        create(asCtx(ctx), scope, { ...draft, inputs: [{ kind: "lattice", query: "  " }] })
      )
    ).toMatchObject({ code: "empty-query" });
  });

  it("writes an activity entry, in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, draft);

    expect(ctx.log).toEqual([
      expect.objectContaining({
        verb: "declared",
        target: { type: "derivedOutput", id, label: draft.prompt }
      })
    ]);
  });
});
