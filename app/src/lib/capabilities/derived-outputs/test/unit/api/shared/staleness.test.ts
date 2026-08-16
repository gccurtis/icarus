import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { effectiveState, inputRevisions, movedSince } from "$derived-outputs/api/shared/staleness";
import type { DerivedInput, InputRevision } from "$derived-outputs/types/derived-output";
import {
  asCtx,
  asking,
  attach,
  editedTo,
  fileAt,
  findingAt,
  questionWith,
  resourceAt,
  NOW
} from "$derived-outputs/test/fixture";

const resourceRevision = (resourceId: string, revision: number): InputRevision => ({
  kind: "resource",
  resourceType: "document",
  resourceId,
  revision
});

/**
 * What each input was when the content was generated. This is the reading
 * staleness compares against itself, so anything it declines to record is
 * something an output can never go stale on.
 */
describe("inputRevisions", () => {
  it("records a resource at the revision it currently stands at", async () => {
    const { ctx, scope, mine } = await asking();
    const input = await resourceAt(ctx, mine, "documents:1");
    await editedTo(ctx, mine, "documents:1", 1);
    await editedTo(ctx, mine, "documents:1", 2);

    expect(await inputRevisions(asCtx(ctx), scope, [input])).toEqual([
      resourceRevision("documents:1", 2)
    ]);
  });

  it("records a finding as a resource, because its writeup is revised in place", async () => {
    const { ctx, scope, mine } = await asking();
    const findingId = await findingAt(ctx, mine, 4);

    expect(await inputRevisions(asCtx(ctx), scope, [{ kind: "finding", findingId }])).toEqual([
      { kind: "resource", resourceType: "finding", resourceId: findingId, revision: 4 }
    ]);
  });

  it("records a file by id alone, because bytes are immutable", async () => {
    const { ctx, scope, mine } = await asking();
    const fileId = await fileAt(ctx, mine);

    // A replacement is a different row with `supersedes` pointing back, so the
    // id is the revision and there is nothing to compare.
    expect(await inputRevisions(asCtx(ctx), scope, [{ kind: "file", fileId }])).toEqual([
      { kind: "file", fileId }
    ]);
  });

  it("expands a question to the findings hanging off it, when asked", async () => {
    const { ctx, scope, mine } = await asking();
    const first = await findingAt(ctx, mine, 1);
    const second = await findingAt(ctx, mine, 1);
    const questionId = await questionWith(ctx, mine, [first, second]);

    expect(
      await inputRevisions(asCtx(ctx), scope, [
        { kind: "question", questionId, includeFindings: true }
      ])
    ).toEqual([
      { kind: "finding", findingId: first },
      { kind: "finding", findingId: second }
    ]);
  });

  it("records nothing for a question whose findings were not asked for", async () => {
    const { ctx, scope, mine } = await asking();
    const questionId = await questionWith(ctx, mine, [await findingAt(ctx, mine, 1)]);

    // The question is the asking rather than the material, and nothing about the
    // asking is what the generation read.
    expect(await inputRevisions(asCtx(ctx), scope, [{ kind: "question", questionId }])).toEqual([]);
  });

  it("records nothing for a lattice input", async () => {
    const { ctx, scope } = await asking();

    // A query, not a set: it resolves differently over time by design, so an
    // output with only lattice inputs is refreshed on request.
    expect(
      await inputRevisions(asCtx(ctx), scope, [{ kind: "lattice", query: "pricing", limit: 5 }])
    ).toEqual([]);
  });

  it("records nothing for a resource that is gone", async () => {
    const { ctx, scope } = await asking();

    expect(
      await inputRevisions(asCtx(ctx), scope, [
        { kind: "resource", resourceType: "document", resourceId: "documents:404" }
      ])
    ).toEqual([]);
  });

  it("records nothing for another project's row, and refuses nothing", async () => {
    const { ctx, scope, theirs } = await asking();
    await resourceAt(ctx, theirs, "documents:9");
    const findingId = await findingAt(ctx, theirs, 2);
    const fileId = await fileAt(ctx, theirs);
    const inputs: DerivedInput[] = [
      { kind: "resource", resourceType: "document", resourceId: "documents:9" },
      { kind: "finding", findingId },
      { kind: "file", fileId }
    ];

    // The same answer an absent row gives. A refusal here would confirm that
    // somebody else's material exists.
    expect(await inputRevisions(asCtx(ctx), scope, inputs)).toEqual([]);
  });
});

/**
 * The comparison itself. **Every case here is about a revision and none is about
 * a time** — an implementation that compared `updatedAt` against `refreshedAt`
 * would pass a careless test and fail these.
 */
describe("movedSince", () => {
  it("says nothing moved when the two readings match", () => {
    const recorded: InputRevision[] = [
      resourceRevision("documents:1", 3),
      { kind: "file", fileId: "externalFiles:1" as Id<"externalFiles"> }
    ];

    expect(movedSince(recorded, [...recorded].reverse())).toBe(false);
  });

  it("says an input moved when its current revision exceeds the recorded one", () => {
    expect(
      movedSince([resourceRevision("documents:1", 3)], [resourceRevision("documents:1", 4)])
    ).toBe(true);
  });

  it("says nothing moved when a row was touched without producing a revision", () => {
    // The whole reason `inputsAt` stores a number rather than a moment.
    expect(
      movedSince([resourceRevision("documents:1", 3)], [resourceRevision("documents:1", 3)])
    ).toBe(false);
  });

  it("says an input moved when it is no longer there", () => {
    expect(movedSince([resourceRevision("documents:1", 3)], [])).toBe(true);
  });

  it("says an input moved when the declaration grew one", () => {
    expect(movedSince([], [resourceRevision("documents:1", 1)])).toBe(true);
  });

  it("says nothing moved for two empty readings", () => {
    // A lattice-only output, and the reason it never auto-stales.
    expect(movedSince([], [])).toBe(false);
  });

  it("tells one resource from another of the same id but a different kind", () => {
    const asDocument = resourceRevision("1", 1);
    const asFinding: InputRevision = {
      kind: "resource",
      resourceType: "finding",
      resourceId: "1",
      revision: 1
    };

    expect(movedSince([asDocument], [asFinding])).toBe(true);
  });
});

describe("effectiveState", () => {
  const generated = async () => {
    const { ctx, scope, mine } = await asking();
    const input = await resourceAt(ctx, mine, "documents:1");
    await editedTo(ctx, mine, "documents:1", 1);
    const inputsAt = await inputRevisions(asCtx(ctx), scope, [input]);
    return { ctx, scope, mine, input, inputsAt };
  };

  it("leaves a fresh output fresh while its inputs stand still", async () => {
    const { ctx, scope, input, inputsAt } = await generated();

    expect(
      await effectiveState(asCtx(ctx), scope, { state: "fresh", inputs: [input], inputsAt })
    ).toBe("fresh");
  });

  it("makes a fresh output stale once one input has moved", async () => {
    const { ctx, scope, mine, input, inputsAt } = await generated();
    await editedTo(ctx, mine, "documents:1", 2);

    expect(
      await effectiveState(asCtx(ctx), scope, { state: "fresh", inputs: [input], inputsAt })
    ).toBe("stale");
  });

  it("never stales an output whose only input is a lattice query", async () => {
    const { ctx, scope } = await asking();
    const inputs: DerivedInput[] = [{ kind: "lattice", query: "pricing" }];

    expect(
      await effectiveState(asCtx(ctx), scope, { state: "fresh", inputs, inputsAt: [] })
    ).toBe("fresh");
  });

  it("stales a question's output when a finding joins it", async () => {
    const { ctx, scope, mine } = await asking();
    const questionId = await questionWith(ctx, mine, [await findingAt(ctx, mine, 1)]);
    const inputs: DerivedInput[] = [{ kind: "question", questionId, includeFindings: true }];
    const inputsAt = await inputRevisions(asCtx(ctx), scope, inputs);

    await attach(ctx, mine, questionId, await findingAt(ctx, mine, 1));

    expect(await effectiveState(asCtx(ctx), scope, { state: "fresh", inputs, inputsAt })).toBe(
      "stale"
    );
  });

  it("leaves an error an error, however far its inputs have moved", async () => {
    const { ctx, scope, mine, input, inputsAt } = await generated();
    await editedTo(ctx, mine, "documents:1", 2);

    // What is shown is whatever survived the failed attempt, and marking it
    // stale would say the last generation succeeded.
    expect(
      await effectiveState(asCtx(ctx), scope, { state: "error", inputs: [input], inputsAt })
    ).toBe("error");
  });

  it("leaves idle and generating alone", async () => {
    const { ctx, scope, mine, input, inputsAt } = await generated();
    await editedTo(ctx, mine, "documents:1", 2);

    for (const state of ["idle", "generating"] as const) {
      expect(await effectiveState(asCtx(ctx), scope, { state, inputs: [input], inputsAt })).toBe(
        state
      );
    }
  });

  it("reads a stored stale as stale without asking anything", async () => {
    const { ctx, scope } = await asking();

    expect(
      await effectiveState(asCtx(ctx), scope, { state: "stale", inputs: [], inputsAt: [] })
    ).toBe("stale");
  });

  it("does not decide staleness by comparing times", async () => {
    const { ctx, scope, mine } = await asking();
    const findingId = await findingAt(ctx, mine, 1);
    const inputs: DerivedInput[] = [{ kind: "finding", findingId }];
    const inputsAt = await inputRevisions(asCtx(ctx), scope, inputs);

    // The finding is touched long after the generation and its writeup is
    // unchanged, which is precisely the case a timestamp gets wrong.
    await ctx.db.patch(findingId, { updatedAt: NOW + 86_400_000 });

    expect(await effectiveState(asCtx(ctx), scope, { state: "fresh", inputs, inputsAt })).toBe(
      "fresh"
    );
  });
});
