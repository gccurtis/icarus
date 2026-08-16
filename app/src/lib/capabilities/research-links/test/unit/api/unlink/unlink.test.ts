import { describe, expect, it } from "vitest";
import { link } from "$research-links/api/link/link";
import { unlink } from "$research-links/api/unlink/unlink";
import {
  asCtx,
  asking,
  finding,
  hypothesis,
  refusalFrom,
  storedLinks
} from "$research-links/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

const drawn = async () => {
  const { ctx, scope, elsewhere, userId } = await asking();
  const bearerId = await finding(ctx, scope, "Margin fell on input costs");
  const subjectId = await hypothesis(ctx, scope, "Input costs drove it");
  const id = await link(asCtx(ctx), scope, {
    bearerKind: "finding",
    bearerId,
    subjectKind: "hypothesis",
    subjectId,
    bearing: "supports"
  });
  return { ctx, scope, elsewhere, userId, bearerId, subjectId, id };
};

describe("unlink", () => {
  it("removes the edge and leaves both ends standing", async () => {
    const { ctx, scope, bearerId, subjectId, id } = await drawn();

    await unlink(asCtx(ctx), scope, id);

    // An edge is an assertion about two objects; withdrawing it says nothing
    // about either of them.
    expect(storedLinks(ctx)).toHaveLength(0);
    expect(ctx.rows.get(bearerId)).toBeDefined();
    expect(ctx.rows.get(subjectId)).toBeDefined();
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "unlinked",
      target: { type: "researchLink", id, label: "Margin fell on input costs" }
    });
  });

  it("lets the same edge be drawn again afterwards", async () => {
    const { ctx, scope, bearerId, subjectId, id } = await drawn();
    await unlink(asCtx(ctx), scope, id);

    // The duplicate check reads what is stored now, so withdrawing a link is
    // also how a wrong bearing gets corrected.
    const redrawn = await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "contradicts"
    });

    expect(ctx.rows.get(redrawn)?.bearing).toBe("contradicts");
  });

  it("removes an edge whose bearer is gone, which is when somebody is cleaning up", async () => {
    const { ctx, scope, bearerId, id } = await drawn();
    ctx.rows.delete(bearerId);

    await unlink(asCtx(ctx), scope, id);

    // A dangling edge is the one most worth removing, so the entry falls back to
    // the kind rather than the mutation failing on a label it cannot read.
    expect(storedLinks(ctx)).toHaveLength(0);
    expect(ctx.log.at(-1)).toMatchObject({ verb: "unlinked", target: { label: "finding" } });
  });

  it("reports not found for a link in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await link(asCtx(ctx), elsewhere, {
      bearerKind: "finding",
      bearerId: await finding(ctx, elsewhere, "Their finding"),
      subjectKind: "hypothesis",
      subjectId: await hypothesis(ctx, elsewhere, "Their hypothesis")
    });

    expect(await refusalFrom(unlink(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(storedLinks(ctx)).toHaveLength(1);
  });

  it("reports not found for a link that never existed", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(unlink(asCtx(ctx), scope, "researchLinks:404" as Id<"researchLinks">))
    ).toMatchObject({ code: "not-found" });
  });
});
