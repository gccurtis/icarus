import { describe, expect, it } from "vitest";
import { bearers } from "$research-links/api/bearers/bearers";
import { link } from "$research-links/api/link/link";
import {
  asCtx,
  asking,
  finding,
  hypothesis,
  indexReads,
  question
} from "$research-links/test/fixture";

describe("bearers", () => {
  it("returns the hypotheses proposed for a question, and the findings bearing on it", async () => {
    const { ctx, scope } = await asking();
    const subjectId = await question(ctx, scope, "Why did margin fall?");
    const proposal = await hypothesis(ctx, scope, "Input costs drove it");
    const evidence = await finding(ctx, scope, "Supplier invoices are up 12%");
    await link(asCtx(ctx), scope, {
      bearerKind: "hypothesis",
      bearerId: proposal,
      subjectKind: "question",
      subjectId
    });
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId: evidence,
      subjectKind: "question",
      subjectId
    });

    const subject = { subjectKind: "question", subjectId } as const;

    // Two lists off one question, and one read serves both — which is what a
    // join table buys over an array on either side.
    expect((await bearers(asCtx(ctx), scope, subject, "hypothesis")).map((l) => l.bearerId)).toEqual(
      [proposal]
    );
    expect((await bearers(asCtx(ctx), scope, subject, "finding")).map((l) => l.bearerId)).toEqual([
      evidence
    ]);
    expect(await bearers(asCtx(ctx), scope, subject)).toHaveLength(2);
  });

  it("returns the evidence for a hypothesis with each bearing on it", async () => {
    const { ctx, scope } = await asking();
    const subjectId = await hypothesis(ctx, scope, "Input costs drove it");
    const supporting = await finding(ctx, scope, "Supplier invoices are up 12%");
    const contradicting = await finding(ctx, scope, "Input volumes fell with price");
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId: supporting,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "supports",
      note: "Invoices confirm the move"
    });
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId: contradicting,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "contradicts"
    });

    const found = await bearers(asCtx(ctx), scope, { subjectKind: "hypothesis", subjectId });

    // The bearing comes off the edge, so both readings of the same hypothesis
    // stand side by side.
    expect(found.map((l) => [l.bearerId, l.bearing])).toEqual([
      [supporting, "supports"],
      [contradicting, "contradicts"]
    ]);
    expect(found[0]?.note).toBe("Invoices confirm the move");
    expect(found[0]?.at).toBeGreaterThan(0);
  });

  it("resolves in one indexed read on by_subject", async () => {
    const { ctx, scope } = await asking();
    const subjectId = await question(ctx, scope, "Why did margin fall?");
    const reads = indexReads(ctx);

    await bearers(asCtx(ctx), scope, { subjectKind: "question", subjectId }, "finding");

    // Filtering the bearer kind in the handler rather than in a second index:
    // the far end of one question is a handful of rows already in memory.
    expect(reads).toEqual(["researchLinks.by_subject"]);
  });

  it("returns the caller's project and no other's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const mine = await question(ctx, scope, "Why did margin fall?");
    const theirs = await question(ctx, elsewhere, "Their question");
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId: await finding(ctx, scope, "Supplier invoices are up 12%"),
      subjectKind: "question",
      subjectId: mine
    });
    await link(asCtx(ctx), elsewhere, {
      bearerKind: "finding",
      bearerId: await finding(ctx, elsewhere, "Their finding"),
      subjectKind: "question",
      subjectId: theirs
    });

    expect(await bearers(asCtx(ctx), scope, { subjectKind: "question", subjectId: theirs })).toEqual(
      []
    );
    expect(await bearers(asCtx(ctx), scope, { subjectKind: "question", subjectId: mine })).toHaveLength(
      1
    );
  });
});
