import { describe, expect, it } from "vitest";
import { link } from "$research-links/api/link/link";
import { asLink } from "$research-links/api/shared/as-link";
import { asCtx, asking, finding, hypothesis } from "$research-links/test/fixture";

const stored = async (bearing?: "supports") => {
  const { ctx, scope } = await asking();
  const bearerId = await finding(ctx, scope, "Margin fell on input costs");
  const subjectId = await hypothesis(ctx, scope, "Input costs drove it");
  const id = await link(asCtx(ctx), scope, {
    bearerKind: "finding",
    bearerId,
    subjectKind: "hypothesis",
    subjectId,
    bearing
  });
  const row = await asCtx(ctx).db.get(id);
  return { row: row!, id, bearerId, subjectId };
};

describe("asLink", () => {
  it("hands back the pair, its bearing, and when it was drawn", async () => {
    const { row, id, bearerId, subjectId } = await stored("supports");

    expect(asLink(row)).toEqual({
      id,
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "supports",
      note: undefined,
      createdBy: row.createdBy,
      // Recency without a stored column — and without a `rank`, because
      // ordering evidence is a view concern.
      at: row._creationTime
    });
  });

  it("drops the project, which the caller already holds", async () => {
    const { row } = await stored();

    expect(asLink(row)).not.toHaveProperty("projectId");
  });
});
