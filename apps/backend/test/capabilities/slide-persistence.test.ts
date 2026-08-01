import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import {
  InvalidSlideCursorError,
  SlideIdempotencyMismatchError,
  SlideIdentityReuseError
} from "../../src/3-capabilities/slide/domain/errors.js";
import { collectSlideIdentities } from "../../src/3-capabilities/slide/domain/identities.js";
import type {
  DeckHead,
  DeckSnapshot,
  PromptContentCreationAttempt,
  PromptContentRefreshAttempt,
  SlideAttempt,
  SlideBase,
  SlideStageReceipt,
  SlideStyleRegistry
} from "../../src/3-capabilities/slide/domain/model.js";
import type {
  SlideCreationCommit,
  SlideMutationCommit
} from "../../src/3-capabilities/slide/ports/slideStore.js";
import { SQLiteSlideStore } from "../../src/3-capabilities/slide/persistence/sqliteSlideStore.js";

const timestamp = (offset: number): string =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString();

const createStorePath = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-slide-store-"));
  return join(directory, "slides.db");
};

const defaultStyles = (): SlideStyleRegistry => ({
  defaultStyleIdByShapeKind: {
    text: "slide-style-default",
    "prompt-content": "slide-style-default",
    geometry: "slide-style-default",
    line: "slide-style-default",
    image: "slide-style-default",
    table: "slide-style-default",
    chart: "slide-style-default"
  },
  styles: [{
    id: "slide-style-default",
    name: "Default",
    visual: {},
    text: {}
  }]
});

const blankSnapshot = (
  title: string,
  slideId: string
): DeckSnapshot => ({
  representationVersion: 1,
  revision: 0,
  title,
  lifecycle: "active",
  canvas: { widthPt: 960, heightPt: 540 },
  styles: defaultStyles(),
  slideOrder: [slideId],
  slides: {
    [slideId]: {
      id: slideId,
      background: { kind: "transparent" },
      notes: { atoms: [], marks: [] },
      rootElementIds: [],
      elements: {}
    }
  }
});

const creationCommit = (
  deckId: string,
  requestId = `create-${deckId}`,
  title = `Deck ${deckId}`
): SlideCreationCommit => {
  const snapshot = blankSnapshot(title, `slide-${deckId}`);
  const head: DeckHead = {
    id: deckId,
    title,
    lifecycle: "active",
    revision: 0,
    baseSeq: 0,
    semanticDigest: `digest-${deckId}-0`,
    createdAt: timestamp(0),
    updatedAt: timestamp(0)
  };
  return {
    head,
    identities: collectSlideIdentities(snapshot),
    base: {
      representationVersion: 1,
      deckId,
      baseSeq: 0,
      snapshot,
      semanticDigest: head.semanticDigest,
      createdAt: timestamp(0)
    },
    receipt: {
      deckId,
      requestId,
      requestDigest: `request-digest-${requestId}`,
      result: { type: "deck.created", head },
      createdAt: timestamp(0)
    },
    fact: {
      factId: `fact-${requestId}`,
      kind: "slide.created",
      deckId,
      revision: 0,
      origin: "interactive",
      operationTypes: ["deck.create"],
      semanticDigest: head.semanticDigest,
      occurredAt: timestamp(0)
    }
  };
};

const mutationCommit = (
  prior: DeckHead,
  revision = prior.revision + 1
): SlideMutationCommit => {
  const title = `Title revision ${revision}`;
  const updatedAt = timestamp(revision);
  const head: DeckHead = {
    ...prior,
    title,
    revision,
    semanticDigest: `digest-${prior.id}-${revision}`,
    updatedAt
  };
  const changeSet = {
    id: `change-${prior.id}-${revision}`,
    deckId: prior.id,
    clientRequestId: `request-${prior.id}-${revision}`,
    requestDigest: `request-digest-${prior.id}-${revision}`,
    authoredRevision: prior.revision,
    priorRevision: prior.revision,
    revision,
    seq: revision,
    origin: "interactive" as const,
    operations: [{ type: "deck.rename" as const, title }],
    inverseOperations: [{ type: "deck.rename" as const, title: prior.title }],
    touchedIds: ["$deck:title"],
    semanticDigest: head.semanticDigest,
    createdAt: updatedAt
  };

  return {
    expectedRevision: prior.revision,
    head,
    changeSet,
    identityTransitions: { added: [], removed: [] },
    identityReactivation: "forbid",
    receipt: {
      deckId: prior.id,
      requestId: changeSet.clientRequestId,
      requestDigest: changeSet.requestDigest,
      result: { type: "deck.changed", changeSet },
      createdAt: updatedAt
    },
    fact: {
      factId: `fact-${changeSet.id}`,
      kind: "slide.changed",
      deckId: prior.id,
      revision,
      changeSetId: changeSet.id,
      actorId: "test-actor",
      origin: "interactive",
      operationTypes: ["deck.rename"],
      semanticDigest: head.semanticDigest,
      occurredAt: updatedAt
    }
  };
};

const promptCreationAttempt = (
  deckId: string,
  id: string,
  state: PromptContentCreationAttempt["state"] = "requested",
  updatedAt = timestamp(1)
): PromptContentCreationAttempt => ({
  kind: "prompt-content-create",
  id,
  deckId,
  clientRequestId: `client-${id}`,
  requestDigest: `digest-${id}`,
  slideId: `slide-${deckId}`,
  shapeId: `shape-${id}`,
  frozenDeckRevision: 0,
  state,
  frame: { xPt: 10, yPt: 20, widthPt: 300, heightPt: 120 },
  transform: {
    rotationDegrees: 0,
    flipHorizontal: false,
    flipVertical: false
  },
  styleId: "slide-style-default",
  textBox: {
    paddingPt: { top: 4, right: 4, bottom: 4, left: 4 },
    horizontalAlign: "left",
    verticalAlign: "top",
    overflow: "shrink"
  },
  placement: {},
  definition: {
    prompt: "Ground this answer",
    contextEntries: [{ id: "source-1", kind: "document" }],
    stabilisationText: ""
  },
  createdAt: timestamp(1),
  updatedAt
});

const promptRefreshAttempt = (
  deckId: string,
  id: string,
  state: PromptContentRefreshAttempt["state"],
  updatedAt: string
): PromptContentRefreshAttempt => ({
  kind: "prompt-content-refresh",
  id,
  deckId,
  clientRequestId: `client-${id}`,
  requestDigest: `digest-${id}`,
  slideId: `slide-${deckId}`,
  shapeId: `shape-${id}`,
  frozenDeckRevision: 0,
  state,
  outputId: `output-${id}`,
  frozenAppliedRevision: 1,
  createdAt: updatedAt,
  updatedAt
});

const baseForHead = (
  initial: DeckSnapshot,
  head: DeckHead
): SlideBase => ({
  representationVersion: 1,
  deckId: head.id,
  baseSeq: head.revision,
  snapshot: {
    ...structuredClone(initial),
    revision: head.revision,
    title: head.title,
    lifecycle: head.lifecycle
  },
  semanticDigest: head.semanticDigest,
  createdAt: head.updatedAt
});

test("Slide stores use isolated project-hashed tables and persist creation atomically", async () => {
  const dbPath = createStorePath();
  const alpha = new SQLiteSlideStore("project-alpha", dbPath);
  const beta = new SQLiteSlideStore("project-beta", dbPath);
  const alphaCommit = creationCommit("shared-deck", "create-alpha", "Alpha");
  const betaCommit = creationCommit("shared-deck", "create-beta", "Beta");

  await alpha.commitCreation(alphaCommit);
  assert.equal((await alpha.getHead("shared-deck"))?.title, "Alpha");
  assert.equal(await beta.getHead("shared-deck"), undefined);

  await beta.commitCreation(betaCommit);
  assert.equal((await beta.getHead("shared-deck"))?.title, "Beta");
  assert.deepEqual(
    await alpha.getBaseAtOrBefore("shared-deck", 0),
    alphaCommit.base
  );
  assert.deepEqual(
    await alpha.getSubmission("shared-deck", "create-alpha"),
    alphaCommit.receipt
  );
  assert.deepEqual(
    await alpha.getCommittedFact("fact-create-alpha"),
    alphaCommit.fact
  );

  const inspection = new Database(dbPath, { readonly: true });
  const journalMode = inspection.pragma("journal_mode", { simple: true });
  const deckTables = inspection
    .prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'slide_%_decks'
      ORDER BY name
    `)
    .all() as Array<{ name: string }>;
  inspection.close();
  assert.equal(journalMode, "wal");
  assert.equal(deckTables.length, 2);

  await assert.rejects(
    alpha.registerPendingPromptOutput({
      outputId: "orphan-output",
      deckId: "missing-deck",
      slideId: "missing-slide",
      shapeId: "orphan-shape",
      state: "pending",
      createdAt: timestamp(1),
      updatedAt: timestamp(1)
    }),
    /FOREIGN KEY/
  );

  assert.deepEqual(await alpha.listUnpublishedFacts(), [alphaCommit.fact]);
  await alpha.markFactPublished(alphaCommit.fact.factId, timestamp(2));
  assert.deepEqual(await alpha.listUnpublishedFacts(), []);

  const archived = creationCommit("archived-deck", "create-archived", "Archived");
  archived.head.lifecycle = "archived";
  archived.base.snapshot.lifecycle = "archived";
  await alpha.commitCreation(archived);
  const firstPage = await alpha.listHeads(undefined, undefined, 1);
  assert.equal(firstPage.items.length, 1);
  assert.ok(firstPage.nextCursor);
  const secondPage = await alpha.listHeads(firstPage.nextCursor, undefined, 1);
  assert.equal(secondPage.items.length, 1);
  assert.deepEqual(
    new Set([...firstPage.items, ...secondPage.items].map((head) => head.id)),
    new Set(["shared-deck", "archived-deck"])
  );
  assert.deepEqual(
    (await alpha.listHeads(undefined, "archived")).items.map((head) => head.id),
    ["archived-deck"]
  );

  alpha.close();
  beta.close();
});

test("Slide identity ledger tombstones removals and permits only exact same-kind compensation", async () => {
  const store = new SQLiteSlideStore("identity-project", createStorePath());
  const creation = creationCommit("identity-deck");
  await store.commitCreation(creation);

  assert.deepEqual(await store.getIdentity("identity-deck", "slide-style-default"), {
    deckId: "identity-deck",
    id: "slide-style-default",
    kind: "style",
    state: "active",
    firstRevision: 0,
    lastTransitionRevision: 0
  });

  const added = mutationCommit(creation.head, 1);
  added.identityTransitions.added = [
    { id: "ledger-group", kind: "group" },
    { id: "ledger-shape", kind: "shape" },
    { id: "ledger-atom", kind: "rich-text-atom" }
  ];
  assert.equal(await store.commitMutation(added), true);

  const removed = mutationCommit(added.head, 2);
  removed.identityTransitions.removed = structuredClone(added.identityTransitions.added);
  assert.equal(await store.commitMutation(removed), true);
  assert.deepEqual(await store.getIdentity("identity-deck", "ledger-shape"), {
    deckId: "identity-deck",
    id: "ledger-shape",
    kind: "shape",
    state: "tombstoned",
    firstRevision: 1,
    lastTransitionRevision: 2,
    tombstonedRevision: 2
  });

  const ordinaryReuse = mutationCommit(removed.head, 3);
  ordinaryReuse.identityTransitions.added = [{ id: "ledger-shape", kind: "shape" }];
  await assert.rejects(
    store.commitMutation(ordinaryReuse),
    (error: unknown) =>
      error instanceof SlideIdentityReuseError &&
      error.identityId === "ledger-shape" &&
      error.previousKind === "shape" &&
      error.requestedKind === "shape"
  );
  assert.equal((await store.getHead("identity-deck"))?.revision, 2);
  assert.equal(await store.getChangeSet("identity-deck", ordinaryReuse.changeSet.id), undefined);

  const crossKind = mutationCommit(removed.head, 3);
  crossKind.identityTransitions.added = [{ id: "ledger-shape", kind: "group" }];
  await assert.rejects(
    store.commitMutation(crossKind),
    (error: unknown) =>
      error instanceof SlideIdentityReuseError &&
      error.previousKind === "shape" &&
      error.requestedKind === "group"
  );

  const compensated = mutationCommit(removed.head, 3);
  compensated.changeSet.compensation = {
    intent: "undo",
    targetChangeSetId: removed.changeSet.id
  };
  compensated.identityTransitions.added = [{ id: "ledger-shape", kind: "shape" }];
  compensated.identityReactivation = "same-kind-compensation";
  assert.equal(await store.commitMutation(compensated), true);
  assert.equal(
    (await store.getIdentity("identity-deck", "ledger-shape"))?.state,
    "active"
  );

  const wrongKindCompensation = mutationCommit(compensated.head, 4);
  wrongKindCompensation.changeSet.compensation = {
    intent: "undo",
    targetChangeSetId: removed.changeSet.id
  };
  wrongKindCompensation.identityTransitions.added = [
    { id: "ledger-group", kind: "shape" }
  ];
  wrongKindCompensation.identityReactivation = "same-kind-compensation";
  await assert.rejects(
    store.commitMutation(wrongKindCompensation),
    (error: unknown) => error instanceof SlideIdentityReuseError
  );

  await store.pruneHistory("identity-deck", 1, 1, 1);
  assert.equal(
    (await store.getIdentity("identity-deck", "ledger-group"))?.state,
    "tombstoned"
  );
  store.close();
});

test("Slide mutation CAS commits attempts, ownership, receipt, and outbox atomically", async () => {
  const store = new SQLiteSlideStore("project", createStorePath());
  const creation = creationCommit("deck-1");
  await store.commitCreation(creation);

  const attempt = promptCreationAttempt("deck-1", "attempt-1");
  await store.createAttempt(attempt);
  const pending = {
    outputId: "output-1",
    deckId: "deck-1",
    slideId: attempt.slideId,
    shapeId: attempt.shapeId,
    creationAttemptId: attempt.id,
    state: "pending" as const,
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  };
  await store.registerPendingPromptOutput(pending);
  await store.registerPendingPromptOutput(pending);

  const stale = mutationCommit({ ...creation.head, revision: 9 }, 10);
  assert.equal(await store.commitMutation(stale), false);
  assert.equal((await store.getHead("deck-1"))?.revision, 0);
  assert.equal(await store.getSubmission("deck-1", stale.receipt.requestId), undefined);

  const accepted = mutationCommit(creation.head);
  const settledAttempt: PromptContentCreationAttempt = {
    ...attempt,
    state: "settled",
    candidateOutputId: "output-1",
    candidateHeadRevision: 1,
    settledChangeSetId: accepted.changeSet.id,
    updatedAt: timestamp(2)
  };
  accepted.attemptUpdates = [settledAttempt];
  accepted.promptOwnershipTransitions = [{
    outputId: "output-1",
    deckId: "deck-1",
    slideId: attempt.slideId,
    shapeId: attempt.shapeId,
    creationAttemptId: attempt.id,
    state: "attached",
    attachedRevision: 1,
    at: timestamp(2)
  }];

  assert.equal(await store.commitMutation(accepted), true);
  assert.deepEqual(await store.getAttemptById(attempt.id), settledAttempt);
  assert.deepEqual(await store.getPromptOutputOwnership("output-1"), {
    ...pending,
    state: "attached",
    attachedRevision: 1,
    updatedAt: timestamp(2)
  });

  const rollback = mutationCommit(accepted.head);
  rollback.promptOwnershipTransitions = [{
    outputId: "missing-output",
    deckId: "deck-1",
    slideId: attempt.slideId,
    shapeId: "missing-shape",
    state: "attached",
    attachedRevision: 2,
    at: timestamp(3)
  }];
  await assert.rejects(store.commitMutation(rollback), /ownership not found/);
  assert.equal((await store.getHead("deck-1"))?.revision, 1);
  assert.equal(await store.getChangeSet("deck-1", rollback.changeSet.id), undefined);
  assert.equal(await store.getCommittedFact(rollback.fact.factId), undefined);

  await store.updatePromptOutputOwnership({
    outputId: "output-1",
    deckId: "deck-1",
    slideId: attempt.slideId,
    shapeId: attempt.shapeId,
    state: "detached",
    detachedRevision: 2,
    at: timestamp(3)
  });
  assert.deepEqual(
    (await store.listDetachedPromptOutputs()).map((item) => item.outputId),
    ["output-1"]
  );
  store.close();
});

test("Slide delegated claims, attempts, and stages are replay-safe and recoverable", async () => {
  const store = new SQLiteSlideStore("project", createStorePath());
  await store.commitCreation(creationCommit("deck-2"));
  const attempt = promptCreationAttempt("deck-2", "attempt-stage");
  await store.createAttempt(attempt);
  assert.deepEqual(
    await store.getPromptCreationAttemptByShape("deck-2", attempt.shapeId),
    attempt
  );
  await assert.rejects(
    store.createAttempt({
      ...attempt,
      id: "attempt-same-shape",
      clientRequestId: "client-same-shape"
    }),
    /UNIQUE/
  );
  assert.deepEqual(await store.listRecoverableAttempts(), [attempt]);

  const proposed: PromptContentCreationAttempt = {
    ...attempt,
    state: "proposed",
    candidateOutputId: "dedicated-output",
    candidateHeadRevision: 3,
    updatedAt: timestamp(2)
  };
  await store.updateAttempt(proposed);

  const compute: SlideStageReceipt = {
    attemptId: attempt.id,
    stage: "compute",
    idempotencyKey: "attempt-stage:compute",
    requestDigest: attempt.requestDigest,
    state: "running",
    createdAt: timestamp(2),
    updatedAt: timestamp(2)
  };
  assert.equal(await store.claimStage(compute), "claimed");
  assert.equal(await store.claimStage(compute), "running");
  await store.completeStage({
    ...compute,
    state: "completed",
    result: { outputId: "dedicated-output" },
    updatedAt: timestamp(3)
  });
  assert.equal(await store.claimStage(compute), "completed");
  await assert.rejects(
    store.claimStage({ ...compute, requestDigest: "different" }),
    /does not match/
  );

  const settle: SlideStageReceipt = {
    attemptId: attempt.id,
    stage: "settle",
    idempotencyKey: "attempt-stage:settle",
    requestDigest: attempt.requestDigest,
    state: "running",
    createdAt: timestamp(3),
    updatedAt: timestamp(3)
  };
  assert.equal(await store.claimStage(settle), "claimed");
  await store.failStage({
    ...settle,
    state: "failed",
    diagnostic: { code: "temporary", message: "Retry this stage" },
    updatedAt: timestamp(4)
  });
  assert.equal(await store.claimStage({ ...settle, updatedAt: timestamp(5) }), "claimed");
  assert.equal(await store.recoverInterruptedStages(timestamp(6)), 1);
  assert.equal(await store.claimStage({ ...settle, updatedAt: timestamp(7) }), "claimed");

  await store.registerPendingPromptOutput({
    outputId: "dedicated-output",
    deckId: "deck-2",
    slideId: attempt.slideId,
    shapeId: attempt.shapeId,
    creationAttemptId: attempt.id,
    state: "pending",
    createdAt: timestamp(6),
    updatedAt: timestamp(6)
  });
  const diagnostic = { code: "settlement_failed", message: "Identity conflict" };
  const failedAttempt: PromptContentCreationAttempt = {
    ...proposed,
    state: "failed",
    diagnostic,
    updatedAt: timestamp(8)
  };
  const failedSettle: SlideStageReceipt = {
    ...settle,
    state: "failed",
    diagnostic,
    updatedAt: timestamp(8)
  };
  await store.failPromptCreationStage({ attempt: failedAttempt, receipt: failedSettle });
  await store.failPromptCreationStage({ attempt: failedAttempt, receipt: failedSettle });
  assert.equal(
    (await store.getPromptOutputOwnership("dedicated-output"))?.state,
    "detached"
  );

  const claim = {
    deckId: "deck-2",
    requestId: "definition-update",
    requestDigest: "definition-digest",
    kind: "prompt-content.update-definition" as const,
    targetOutputId: "dedicated-output",
    state: "pending" as const,
    createdAt: timestamp(9),
    updatedAt: timestamp(9)
  };
  assert.deepEqual(await store.claimDelegatedCommand(claim), { type: "claim", claim });
  assert.deepEqual(await store.claimDelegatedCommand(claim), { type: "claim", claim });
  await assert.rejects(
    store.claimDelegatedCommand({ ...claim, requestDigest: "different" }),
    (error: unknown) => error instanceof SlideIdempotencyMismatchError
  );
  const receipt = {
    deckId: "deck-2",
    requestId: claim.requestId,
    requestDigest: claim.requestDigest,
    result: { type: "prompt-content.create-requested" as const, attemptId: attempt.id },
    createdAt: timestamp(10)
  };
  await store.completeDelegatedCommand(claim, receipt);
  await store.completeDelegatedCommand(claim, receipt);
  assert.deepEqual(await store.getSubmission("deck-2", claim.requestId), receipt);
  assert.equal(
    (await store.getDelegatedCommandClaim("deck-2", claim.requestId))?.state,
    "completed"
  );

  store.close();
});

test("Slide history pagination and pruning retain a loadable cutoff/head tail and active attempts", async () => {
  const store = new SQLiteSlideStore("history-project", createStorePath());
  const creation = creationCommit("history-deck");
  await store.commitCreation(creation);
  const initial = creation.base.snapshot;
  let head = creation.head;

  for (let revision = 1; revision <= 6; revision += 1) {
    const commit = mutationCommit(head, revision);
    assert.equal(await store.commitMutation(commit), true);
    head = (await store.getHead(head.id))!;
    if (revision % 2 === 0) {
      assert.equal(
        await store.appendBaseIfHead(head.id, head.revision, baseForHead(initial, head)),
        true
      );
      head = (await store.getHead(head.id))!;
    }
  }

  const firstPage = await store.listChangeSets(head.id, undefined, 2);
  assert.deepEqual(firstPage.items.map((change) => change.seq), [6, 5]);
  assert.ok(firstPage.nextCursor);
  const secondPage = await store.listChangeSets(head.id, firstPage.nextCursor, 2);
  assert.deepEqual(secondPage.items.map((change) => change.seq), [4, 3]);
  assert.deepEqual(
    (await store.getChangeSets(head.id, 4, 6)).map((change) => change.seq),
    [5, 6]
  );

  const malformedHeadCursor = Buffer.from(JSON.stringify({
    kind: "deck-head",
    updatedAt: 42,
    id: head.id
  }), "utf8").toString("base64url");
  await assert.rejects(
    store.listHeads(malformedHeadCursor),
    (error: unknown) => error instanceof InvalidSlideCursorError
  );
  const malformedChangeCursor = Buffer.from(JSON.stringify({
    kind: "deck-change",
    seq: "4"
  }), "utf8").toString("base64url");
  await assert.rejects(
    store.listChangeSets(head.id, malformedChangeCursor, 2),
    (error: unknown) => error instanceof InvalidSlideCursorError
  );

  assert.equal(
    await store.appendBaseIfHead(
      head.id,
      5,
      baseForHead(initial, { ...head, revision: 5 })
    ),
    false
  );

  const terminalAttempts: SlideAttempt[] = [
    promptRefreshAttempt(head.id, "terminal-1", "settled", timestamp(10)),
    promptRefreshAttempt(head.id, "terminal-2", "failed", timestamp(11)),
    promptRefreshAttempt(head.id, "terminal-3", "stale", timestamp(12))
  ];
  for (const attempt of terminalAttempts) await store.createAttempt(attempt);
  const active = promptRefreshAttempt(
    head.id,
    "active-attempt",
    "computing",
    timestamp(13)
  );
  await store.createAttempt(active);

  await store.pruneHistory(head.id, 2, 2, 1);

  assert.equal(await store.getBaseAtOrBefore(head.id, 3), undefined);
  assert.equal((await store.getBaseAtOrBefore(head.id, 4))?.baseSeq, 4);
  assert.deepEqual(
    (await store.getChangeSets(head.id, 0, 6)).map((change) => change.seq),
    [5, 6]
  );
  assert.equal(await store.getAttempt(head.id, "terminal-1"), undefined);
  assert.equal(await store.getAttempt(head.id, "terminal-2"), undefined);
  assert.ok(await store.getAttempt(head.id, "terminal-3"));
  assert.deepEqual(await store.getAttempt(head.id, active.id), active);

  store.close();
});
