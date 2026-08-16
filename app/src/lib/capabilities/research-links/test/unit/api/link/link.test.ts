import { describe, expect, it } from "vitest";
import { link } from "$research-links/api/link/link";
import {
  asCtx,
  asking,
  finding,
  hypothesis,
  indexReads,
  question,
  refusalFrom,
  storedLinks
} from "$research-links/test/fixture";
import type { LinkBearerKind, LinkSubjectKind } from "$research-links/types/research-link";

describe("link", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const subjectId = await hypothesis(ctx, scope, "Input costs drove it");

    const id = await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "supports",
      note: "  Invoices confirm the move  "
    });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId,
      bearing: "supports",
      note: "Invoices confirm the move",
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "linked",
      target: { type: "researchLink", id, label: "Margin fell on input costs" },
      context: { type: "hypothesis", id: subjectId, label: "Input costs drove it" }
    });
  });

  it("lets one finding support one hypothesis and contradict another", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const supported = await hypothesis(ctx, scope, "Input costs drove it");
    const contradicted = await hypothesis(ctx, scope, "Discounting drove it");

    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId: supported,
      bearing: "supports"
    });
    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId: contradicted,
      bearing: "contradicts"
    });

    // The reason the table exists. A result that supports one explanation while
    // undercutting another is the most valuable kind of evidence there is, and a
    // `bearing` column on the finding had no way to say it.
    expect(storedLinks(ctx).map((row) => [row.subjectId, row.bearing])).toEqual([
      [supported, "supports"],
      [contradicted, "contradicts"]
    ]);
  });

  it("bears a finding on a question with no bearing to give", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const subjectId = await question(ctx, scope, "Why did margin fall?");

    const id = await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "question",
      subjectId
    });

    // A finding may bear on a question without supporting or contradicting
    // anything: the question is not a claim to move.
    expect(ctx.rows.get(id)?.bearing).toBeUndefined();
    expect(ctx.rows.get(id)?.note).toBeUndefined();
  });

  it("refuses a bearing on a hypothesis proposing an answer, writing nothing", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await hypothesis(ctx, scope, "Input costs drove it");
    const subjectId = await question(ctx, scope, "Why did margin fall?");

    // A hypothesis addressing a question is a proposal, not evidence.
    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "hypothesis",
          bearerId,
          subjectKind: "question",
          subjectId,
          bearing: "supports"
        })
      )
    ).toMatchObject({ code: "bearing-not-evidence" });
    expect(storedLinks(ctx)).toHaveLength(0);
    expect(ctx.log).toHaveLength(0);
  });

  it("refuses a hypothesis bearing on a hypothesis, writing nothing", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await hypothesis(ctx, scope, "Input costs drove it");
    const subjectId = await hypothesis(ctx, scope, "Discounting drove it");

    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "hypothesis",
          bearerId,
          subjectKind: "hypothesis" as LinkSubjectKind,
          subjectId
        })
      )
    ).toMatchObject({ code: "illegal-pair" });
    expect(storedLinks(ctx)).toHaveLength(0);
  });

  it("refuses a question as a bearer and a finding as a subject", async () => {
    const { ctx, scope } = await asking();
    const questionId = await question(ctx, scope, "Why did margin fall?");
    const findingId = await finding(ctx, scope, "Margin fell on input costs");
    const hypothesisId = await hypothesis(ctx, scope, "Input costs drove it");

    // Direction is canonical, running finding → hypothesis → question. Reversed,
    // the same relationship could be stored two ways and every read would query
    // both directions and merge.
    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "question" as LinkBearerKind,
          bearerId: questionId,
          subjectKind: "hypothesis",
          subjectId: hypothesisId
        })
      )
    ).toMatchObject({ code: "illegal-pair" });
    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "hypothesis",
          bearerId: hypothesisId,
          subjectKind: "finding" as LinkSubjectKind,
          subjectId: findingId
        })
      )
    ).toMatchObject({ code: "illegal-pair" });
    expect(storedLinks(ctx)).toHaveLength(0);
  });

  it("rejects a duplicate edge, keeping the one that is already there", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const subjectId = await hypothesis(ctx, scope, "Input costs drove it");
    const draft = {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId
    } as const;

    await link(asCtx(ctx), scope, { ...draft, bearing: "supports" });

    // No unique index exists in Convex. The invariant is this mutation's, and
    // one serializable transaction is what makes reading then writing safe.
    expect(
      await refusalFrom(link(asCtx(ctx), scope, { ...draft, bearing: "contradicts" }))
    ).toMatchObject({ code: "duplicate" });
    expect(storedLinks(ctx)).toHaveLength(1);
    expect(storedLinks(ctx)[0]?.bearing).toBe("supports");
  });

  it("finds the duplicate with one indexed read on the whole pair", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const subjectId = await hypothesis(ctx, scope, "Input costs drove it");
    const reads = indexReads(ctx);

    await link(asCtx(ctx), scope, {
      bearerKind: "finding",
      bearerId,
      subjectKind: "hypothesis",
      subjectId
    });

    expect(reads).toEqual(["researchLinks.by_bearer_subject"]);
  });

  it("reports not found for an endpoint in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const subjectId = await hypothesis(ctx, elsewhere, "Their hypothesis");

    // Not "forbidden": distinguishing them confirms the hypothesis exists to
    // someone with no right to know that.
    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "finding",
          bearerId,
          subjectKind: "hypothesis",
          subjectId
        })
      )
    ).toMatchObject({ code: "not-found" });
    expect(storedLinks(ctx)).toHaveLength(0);
  });

  it("reports not found for an id belonging to another table", async () => {
    const { ctx, scope } = await asking();
    const bearerId = await finding(ctx, scope, "Margin fell on input costs");
    const questionId = await question(ctx, scope, "Why did margin fall?");

    // The kind names the table the id has to come from, or `(kind, id)` names
    // nothing and the edge points at a row that will never be read.
    expect(
      await refusalFrom(
        link(asCtx(ctx), scope, {
          bearerKind: "finding",
          bearerId,
          subjectKind: "hypothesis",
          subjectId: questionId
        })
      )
    ).toMatchObject({ code: "not-found" });
  });
});
