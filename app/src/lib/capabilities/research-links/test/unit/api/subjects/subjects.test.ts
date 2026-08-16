import { describe, expect, it } from "vitest";
import { link } from "$research-links/api/link/link";
import { subjects } from "$research-links/api/subjects/subjects";
import {
  asCtx,
  asking,
  finding,
  hypothesis,
  indexReads,
  question
} from "$research-links/test/fixture";

describe("subjects", () => {
  it("returns what a finding speaks to — a hypothesis and a question at once", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Supplier invoices are up 12%");
    const hypothesisId = await hypothesis(ctx, scope, "Input costs drove it");
    const questionId = await question(ctx, scope, "Why did margin fall?");
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId: hypothesisId,
      bearing: "supports"
    });
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "question",
      subjectId: questionId
    });

    const found = await subjects(asCtx(ctx), scope, { bearerKind: "finding", bearerId });

    // One piece of evidence routinely answers more than one thing being asked,
    // which a single `questionId` on the finding would force someone to pick from.
    expect(found.map((l) => [l.subjectKind, l.subjectId, l.bearing])).toEqual([
      ["hypothesis", hypothesisId, "supports"],
      ["question", questionId, undefined]
    ]);
  });

  it("resolves in one indexed read on by_bearer", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Supplier invoices are up 12%");
    const reads = indexReads(ctx);

    await subjects(asCtx(ctx), scope, { bearerKind: "finding", bearerId });

    expect(reads).toEqual(["researchLinks.by_bearer"]);
  });

  it("returns the caller's project and no other's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await finding(ctx, elsewhere, "Their finding");
    await link(asCtx(ctx), elsewhere, {
      bearerKind: "finding",
      bearerId: theirs,
      subjectKind: "question",
      subjectId: await question(ctx, elsewhere, "Their question")
    });

    // The edge exists; it is in a key range this caller's scope never enters.
    expect(await subjects(asCtx(ctx), scope, { bearerKind: "finding", bearerId: theirs })).toEqual(
      []
    );
  });
});
