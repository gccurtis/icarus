import { describe, expect, it } from "vitest";
import { read } from "$derived-outputs/api/read/read";
import { inputRevisions } from "$derived-outputs/api/shared/staleness";
import {
  asCtx,
  asking,
  editedTo,
  outputRow,
  paragraph,
  refusalFrom,
  resourceAt
} from "$derived-outputs/test/fixture";

const generated = async () => {
  const { ctx, scope, mine, theirs } = await asking();
  const input = await resourceAt(ctx, mine, "documents:1");
  await editedTo(ctx, mine, "documents:1", 1);

  const id = await outputRow(ctx, mine, {
    inputs: [input],
    inputsAt: await inputRevisions(asCtx(ctx), scope, [input]),
    block: paragraph("Revenue grew 12%."),
    state: "fresh",
    refreshedAt: 1_699_000_000_000,
    model: "some-model-v2"
  });

  return { ctx, scope, mine, theirs, id, input };
};

describe("read", () => {
  it("returns the output whole, content and provenance together", async () => {
    const { ctx, scope, id, input } = await generated();

    expect(await read(asCtx(ctx), scope, id)).toMatchObject({
      id,
      prompt: "Summarize the findings",
      inputs: [input],
      block: { display: "Revenue grew 12%." },
      model: "some-model-v2",
      refreshedAt: 1_699_000_000_000
    });
  });

  it("says stale when an input has moved since the content was generated", async () => {
    const { ctx, scope, mine, id } = await generated();
    await editedTo(ctx, mine, "documents:1", 2);

    // Still displayable, and displayed — with a marker. The content is correct
    // as of its last refresh and its inputs have since moved.
    expect(await read(asCtx(ctx), scope, id)).toMatchObject({
      state: "stale",
      block: { display: "Revenue grew 12%." }
    });
  });

  it("says fresh while nothing it was generated from has moved", async () => {
    const { ctx, scope, id } = await generated();

    expect((await read(asCtx(ctx), scope, id)).state).toBe("fresh");
  });

  it("reports not found for an output in another project", async () => {
    const { ctx, scope, theirs } = await asking();
    const id = await outputRow(ctx, theirs);

    expect(await refusalFrom(read(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
  });
});
