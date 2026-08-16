import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { setStatus } from "$questions/api/set-status/set-status";
import type { QuestionStatus } from "$questions/types/question";
import { asCtx, asking, refusalFrom } from "$questions/test/fixture";

describe("setStatus", () => {
  it("records where the question now stands, and says so in the log", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    await setStatus(asCtx(ctx), scope, id, "investigating");

    expect(ctx.rows.get(id)).toMatchObject({ status: "investigating", revision: 2 });
    expect(ctx.log.at(-1)).toMatchObject({ verb: "marked", detail: "investigating" });
  });

  it("leaves a parent's children where they are when it is answered", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    const childId = await ask(asCtx(ctx), scope, {
      text: "Did input costs move?",
      notes: [],
      parentId
    });

    await setStatus(asCtx(ctx), scope, parentId, "answered");

    // Whether a decomposition that went somewhere unexpected still has to close
    // is the researcher's call, not the model's.
    expect(ctx.rows.get(childId)).toMatchObject({ status: "open" });
  });

  it("refuses a status the model does not have", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    // `parked` reaches no handler in a deployment — the door's validator lists
    // three literals. This is the same refusal one step in, so a caller reaching
    // past the door cannot park a question either.
    const refusal = await refusalFrom(
      setStatus(asCtx(ctx), scope, id, "parked" as QuestionStatus)
    );

    expect(refusal).toMatchObject({ code: "unknown-status" });
    expect(ctx.rows.get(id)).toMatchObject({ status: "open", revision: 1 });
  });

  it("reports not found for a question in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });

    expect(await refusalFrom(setStatus(asCtx(ctx), scope, id, "answered"))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(id)).toMatchObject({ status: "open" });
  });
});
