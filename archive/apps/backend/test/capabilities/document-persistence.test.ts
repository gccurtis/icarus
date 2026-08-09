import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createBlankSnapshot } from "../../src/3-capabilities/document/application/createService.js";
import {
  DocumentIdentityReuseError,
  InvalidDocumentCursorError
} from "../../src/3-capabilities/document/domain/errors.js";
import { collectDocumentIdentities } from "../../src/3-capabilities/document/domain/identities.js";
import type {
  DocumentAttempt,
  DocumentBase,
  DocumentCommittedTransaction,
  DocumentHead,
  DocumentSnapshot,
  DocumentStageReceipt,
  PromptCreationAttempt,
  PromptRefreshAttempt
} from "../../src/3-capabilities/document/domain/model.js";
import type {
  DocumentCreationCommit,
  DocumentMutationCommit
} from "../../src/3-capabilities/document/ports/documentStore.js";
import { SQLiteDocumentStore } from "../../src/3-capabilities/document/persistence/sqliteDocumentStore.js";

const timestamp = (offset: number): string =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString();

const createStorePath = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-document-store-"));
  return join(directory, "documents.db");
};

const creationCommit = (
  documentId: string,
  requestId = `create-${documentId}`,
  title = `Document ${documentId}`
): DocumentCreationCommit => {
  const snapshot = createBlankSnapshot({ title });
  const head: DocumentHead = {
    id: documentId,
    title,
    lifecycle: "active",
    isTemplate: false,
    revision: 1,
    baseSeq: 1,
    semanticDigest: `digest-${documentId}-0`,
    createdAt: timestamp(0),
    updatedAt: timestamp(0)
  };
  return {
    head,
    identities: collectDocumentIdentities(snapshot),
    base: {
      documentId,
      baseSeq: 1,
      snapshot,
      semanticDigest: head.semanticDigest,
      createdAt: timestamp(0)
    },
    receipt: {
      documentId,
      requestId,
      requestDigest: `request-digest-${requestId}`,
      result: { type: "document.created", head },
      createdAt: timestamp(0)
    },
    createReceipt: {
      requestId,
      documentId,
      requestDigest: `request-digest-${requestId}`,
      result: { type: "document.created", head },
      createdAt: timestamp(0)
    },
    transaction: {
      sourceTransactionId: `transaction-${requestId}`,
      sourceRequestId: requestId,
      kind: "document.created",
      documentId,
      revision: 1,
      origin: "interactive",
      operationTypes: ["document.create"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: timestamp(0)
    }
  };
};

const mutationCommit = (
  prior: DocumentHead,
  revision = prior.revision + 1
): DocumentMutationCommit => {
  const title = `Title revision ${revision}`;
  const updatedAt = timestamp(revision);
  const head: DocumentHead = {
    ...prior,
    title,
    revision,
    semanticDigest: `digest-${prior.id}-${revision}`,
    updatedAt
  };
  const changeSet = {
    id: `change-${prior.id}-${revision}`,
    documentId: prior.id,
    clientRequestId: `request-${prior.id}-${revision}`,
    requestDigest: `request-digest-${prior.id}-${revision}`,
    authoredRevision: prior.revision,
    priorRevision: prior.revision,
    revision,
    seq: revision,
    origin: "interactive" as const,
    operations: [{ type: "document.rename" as const, title }],
    inverseOperations: [
      { type: "document.rename" as const, title: prior.title }
    ],
    touchedIds: [prior.id],
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
      documentId: prior.id,
      requestId: changeSet.clientRequestId,
      requestDigest: changeSet.requestDigest,
      result: { type: "document.changed", changeSet },
      createdAt: updatedAt
    },
    transaction: {
      sourceTransactionId: `transaction-${changeSet.id}`,
      sourceRequestId: changeSet.clientRequestId,
      kind: "document.changed",
      documentId: prior.id,
      revision,
      sourceChangeSetId: changeSet.id,
      actorId: "test-actor",
      origin: "interactive",
      operationTypes: ["document.rename"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: updatedAt
    }
  };
};

const promptCreationAttempt = (
  documentId: string,
  id: string,
  state: PromptCreationAttempt["state"] = "requested",
  updatedAt = timestamp(1)
): PromptCreationAttempt => ({
  kind: "prompt-create",
  id,
  documentId,
  clientRequestId: `client-${id}`,
  requestDigest: `digest-${id}`,
  blockId: `block-${id}`,
  frozenDocumentRevision: 1,
  state,
  styleId: "document-style-normal",
  placement: { kind: "new-row", rowId: `row-${id}` },
  definition: {
    prompt: "Ground this answer",
    context: { kind: "direct", target: { id: "source-1", kind: "document" } },
    stabilisationText: ""
  },
  createdAt: timestamp(1),
  updatedAt
});

const promptRefreshAttempt = (
  documentId: string,
  id: string,
  state: PromptRefreshAttempt["state"],
  updatedAt: string
): PromptRefreshAttempt => ({
  kind: "prompt-refresh",
  id,
  documentId,
  clientRequestId: `client-${id}`,
  requestDigest: `digest-${id}`,
  blockId: `block-${id}`,
  frozenDocumentRevision: 1,
  state,
  promptBlockId: `block-${id}`,
  outputId: `output-${id}`,
  frozenAppliedRevision: 1,
  createdAt: updatedAt,
  updatedAt
});

const baseForHead = (
  initial: DocumentSnapshot,
  head: DocumentHead
): DocumentBase => ({
  documentId: head.id,
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

test("Document stores use isolated project-hashed tables and persist creation atomically", async () => {
  const dbPath = createStorePath();
  const alpha = new SQLiteDocumentStore("project-alpha", dbPath);
  const beta = new SQLiteDocumentStore("project-beta", dbPath);
  const alphaCommit = creationCommit("shared-document", "create-alpha", "Alpha");
  const betaCommit = creationCommit("shared-document", "create-beta", "Beta");

  await alpha.commitCreation(alphaCommit);
  assert.equal((await alpha.getHead("shared-document"))?.title, "Alpha");
  assert.equal(await beta.getHead("shared-document"), undefined);

  await beta.commitCreation(betaCommit);
  assert.equal((await beta.getHead("shared-document"))?.title, "Beta");
  assert.deepEqual(
    await alpha.getBaseAtOrBefore("shared-document", 1),
    alphaCommit.base
  );
  assert.deepEqual(
    await alpha.getSubmission("shared-document", "create-alpha"),
    alphaCommit.receipt
  );
  // The create receipt is written in the same transaction and is keyed by
  // request id alone, so a retry can find it without knowing the allocated id.
  assert.deepEqual(
    await alpha.getCreateSubmission("create-alpha"),
    alphaCommit.createReceipt
  );
  // And it is project-scoped like everything else.
  assert.equal(await beta.getCreateSubmission("create-alpha"), undefined);
  assert.equal(await alpha.getCreateSubmission("never-requested"), undefined);
  assert.deepEqual(
    await alpha.getCommittedTransaction("transaction-create-alpha"),
    alphaCommit.transaction
  );

  const inspection = new Database(dbPath, { readonly: true });
  const journalMode = inspection.pragma("journal_mode", { simple: true });
  const documentTables = inspection
    .prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'doc_%_documents'
      ORDER BY name
    `)
    .all() as Array<{ name: string }>;
  inspection.close();
  assert.equal(journalMode, "wal");
  assert.equal(documentTables.length, 2);

  await assert.rejects(
    alpha.registerPendingPromptOutput({
      outputId: "orphan-output",
      documentId: "missing-document",
      blockId: "orphan-block",
      state: "pending",
      createdAt: timestamp(1),
      updatedAt: timestamp(1)
    }),
    /FOREIGN KEY/
  );

  const unpublished = await alpha.listUnpublishedTransactions();
  assert.deepEqual(unpublished, [alphaCommit.transaction]);
  await alpha.markTransactionPublished(alphaCommit.transaction.sourceTransactionId, timestamp(2));
  assert.deepEqual(await alpha.listUnpublishedTransactions(), []);

  const archived = creationCommit("archived-document", "create-archived", "Archived");
  archived.head.lifecycle = "archived";
  archived.base.snapshot.lifecycle = "archived";
  await alpha.commitCreation(archived);
  const firstHeadPage = await alpha.listHeads(undefined, undefined, 1);
  assert.equal(firstHeadPage.items.length, 1);
  assert.ok(firstHeadPage.nextCursor);
  const secondHeadPage = await alpha.listHeads(firstHeadPage.nextCursor, undefined, 1);
  assert.equal(secondHeadPage.items.length, 1);
  assert.deepEqual(
    new Set([...firstHeadPage.items, ...secondHeadPage.items].map((head) => head.id)),
    new Set(["shared-document", "archived-document"])
  );
  assert.deepEqual(
    (await alpha.listHeads(undefined, "archived")).items.map((head) => head.id),
    ["archived-document"]
  );

  alpha.close();
  beta.close();
});

test("Document outbox records retain self-contained Activity source data across history compaction", async () => {
  const store = new SQLiteDocumentStore("activity-source-project", createStorePath());
  const created = creationCommit("activity-source-document");
  await store.commitCreation(created);
  const first = mutationCommit(created.head, 2);
  await store.commitMutation(first);
  const second = mutationCommit(first.head, 3);
  await store.commitMutation(second);

  const byRequest = await store.getCommittedTransactionByRequest(
    first.head.id,
    first.changeSet.clientRequestId
  );
  assert.deepEqual(byRequest, first.transaction);
  assert.equal(byRequest?.sourceSemanticDigest, first.head.semanticDigest);
  assert.equal(byRequest?.origin, "interactive");

  await store.markTransactionPublished(first.transaction.sourceTransactionId, timestamp(3));
  assert.deepEqual(await store.listUnpublishedTransactions(), [created.transaction, second.transaction]);
  assert.deepEqual(
    await store.getCommittedTransactionByChangeSet(first.head.id, first.changeSet.id),
    first.transaction
  );

  assert.equal(
    await store.appendBaseIfHead(
      second.head.id,
      second.head.revision,
      baseForHead(created.base.snapshot, second.head)
    ),
    true
  );
  await store.pruneHistory(second.head.id, 1, 1, 1);
  assert.equal(await store.getChangeSet(second.head.id, first.changeSet.id), undefined);

  // The relational change_set_id was cleared by compaction, but the copied
  // source value still supports Activity publication/lookup.
  assert.deepEqual(
    await store.getCommittedTransactionByChangeSet(second.head.id, first.changeSet.id),
    first.transaction
  );
  store.close();
});

test("identity ledger tombstones removals, rejects reuse atomically, and permits exact same-kind compensation", async () => {
  const store = new SQLiteDocumentStore("identity-project", createStorePath());
  const creation = creationCommit("identity-document");
  await store.commitCreation(creation);

  assert.deepEqual(
    await store.getIdentity("identity-document", "document-style-normal"),
    {
      documentId: "identity-document",
      id: "document-style-normal",
      kind: "style",
      state: "active",
      firstRevision: 1,
      lastTransitionRevision: 1
    }
  );

  const added = mutationCommit(creation.head, 2);
  added.identityTransitions.added = [
    { id: "ledger-row", kind: "row" },
    { id: "ledger-block", kind: "block" },
    { id: "ledger-atom", kind: "rich-text-atom" }
  ];
  assert.equal(await store.commitMutation(added), true);
  assert.deepEqual(
    await store.getIdentity("identity-document", "ledger-block"),
    {
      documentId: "identity-document",
      id: "ledger-block",
      kind: "block",
      state: "active",
      firstRevision: 2,
      lastTransitionRevision: 2
    }
  );

  const removed = mutationCommit(added.head, 3);
  removed.identityTransitions.removed = [
    { id: "ledger-row", kind: "row" },
    { id: "ledger-block", kind: "block" },
    { id: "ledger-atom", kind: "rich-text-atom" }
  ];
  assert.equal(await store.commitMutation(removed), true);
  assert.deepEqual(
    await store.getIdentity("identity-document", "ledger-block"),
    {
      documentId: "identity-document",
      id: "ledger-block",
      kind: "block",
      state: "tombstoned",
      firstRevision: 2,
      lastTransitionRevision: 3,
      tombstonedRevision: 3
    }
  );

  const ordinaryReuse = mutationCommit(removed.head, 4);
  ordinaryReuse.identityTransitions.added = [
    { id: "ledger-block", kind: "block" }
  ];
  await assert.rejects(
    store.commitMutation(ordinaryReuse),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError &&
      error.identityId === "ledger-block" &&
      error.previousKind === "block" &&
      error.requestedKind === "block"
  );
  assert.equal((await store.getHead("identity-document"))?.revision, 3);
  assert.equal(
    await store.getChangeSet("identity-document", ordinaryReuse.changeSet.id),
    undefined
  );
  assert.equal(
    (await store.getIdentity("identity-document", "ledger-block"))?.state,
    "tombstoned"
  );

  const crossKindReuse = mutationCommit(removed.head, 4);
  crossKindReuse.identityTransitions.added = [
    { id: "ledger-block", kind: "row" }
  ];
  await assert.rejects(
    store.commitMutation(crossKindReuse),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError &&
      error.previousKind === "block" &&
      error.requestedKind === "row"
  );

  const compensated = mutationCommit(removed.head, 4);
  compensated.changeSet.compensation = {
    intent: "undo",
    targetChangeSetId: removed.changeSet.id
  };
  compensated.identityTransitions.added = [
    { id: "ledger-block", kind: "block" }
  ];
  compensated.identityReactivation = "same-kind-compensation";
  assert.equal(await store.commitMutation(compensated), true);
  assert.deepEqual(
    await store.getIdentity("identity-document", "ledger-block"),
    {
      documentId: "identity-document",
      id: "ledger-block",
      kind: "block",
      state: "active",
      firstRevision: 2,
      lastTransitionRevision: 4
    }
  );
  assert.equal(
    (await store.getIdentity("identity-document", "document-style-normal"))
      ?.lastTransitionRevision,
    1,
    "identities carried across a mutation must not be rewritten"
  );

  const crossKindCompensation = mutationCommit(compensated.head, 5);
  crossKindCompensation.changeSet.compensation = {
    intent: "undo",
    targetChangeSetId: removed.changeSet.id
  };
  crossKindCompensation.identityTransitions.added = [
    { id: "ledger-row", kind: "block" }
  ];
  crossKindCompensation.identityReactivation = "same-kind-compensation";
  await assert.rejects(
    store.commitMutation(crossKindCompensation),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError &&
      error.previousKind === "row" &&
      error.requestedKind === "block"
  );

  await store.pruneHistory("identity-document", 1, 1, 1);
  assert.equal(
    (await store.getIdentity("identity-document", "ledger-row"))?.state,
    "tombstoned",
    "identity tombstones outlive ordinary retained-history pruning"
  );

  store.close();
});

test("mutation CAS, attempt settlement, ownership, receipt, and outbox commit together", async () => {
  const store = new SQLiteDocumentStore("project", createStorePath());
  const creation = creationCommit("document-1");
  await store.commitCreation(creation);

  const attempt = promptCreationAttempt("document-1", "attempt-1");
  await store.createAttempt(attempt);
  await store.registerPendingPromptOutput({
    outputId: "output-1",
    documentId: "document-1",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "pending",
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  });
  await store.registerPendingPromptOutput({
    outputId: "output-1",
    documentId: "document-1",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "pending",
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  });

  const imaginaryPrior = { ...creation.head, revision: 9 };
  const stale = mutationCommit(imaginaryPrior, 10);
  assert.equal(await store.commitMutation(stale), false);
  assert.equal((await store.getHead("document-1"))?.revision, 1);
  assert.equal(await store.getChangeSet("document-1", stale.changeSet.id), undefined);
  assert.equal(await store.getSubmission("document-1", stale.receipt.requestId), undefined);

  const accepted = mutationCommit(creation.head);
  const settledAttempt: PromptCreationAttempt = {
    ...attempt,
    state: "settled",
    candidateOutputId: "output-1",
    candidateHeadRevision: 1,
    settledChangeSetId: accepted.changeSet.id,
    updatedAt: timestamp(2)
  };
  accepted.attemptUpdates = [settledAttempt];
  accepted.promptOwnershipTransitions = [
    {
      outputId: "output-1",
      documentId: "document-1",
      blockId: attempt.blockId,
      creationAttemptId: attempt.id,
      state: "attached",
      attachedRevision: 2,
      at: timestamp(2)
    }
  ];

  assert.equal(await store.commitMutation(accepted), true);
  assert.deepEqual(await store.getHead("document-1"), accepted.head);
  assert.deepEqual(
    await store.getChangeSet("document-1", accepted.changeSet.id),
    accepted.changeSet
  );
  assert.deepEqual(
    await store.getSubmission("document-1", accepted.receipt.requestId),
    accepted.receipt
  );
  assert.deepEqual(await store.getAttemptById(attempt.id), settledAttempt);
  assert.deepEqual(await store.getPromptOutputOwnership("output-1"), {
    outputId: "output-1",
    documentId: "document-1",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "attached",
    attachedRevision: 2,
    createdAt: timestamp(1),
    updatedAt: timestamp(2)
  });

  const rollback = mutationCommit(accepted.head);
  rollback.promptOwnershipTransitions = [
    {
      outputId: "missing-output",
      documentId: "document-1",
      blockId: "missing-block",
      state: "attached",
      attachedRevision: 2,
      at: timestamp(3)
    }
  ];
  await assert.rejects(store.commitMutation(rollback), /ownership not found/);
  assert.equal((await store.getHead("document-1"))?.revision, 2);
  assert.equal(
    await store.getChangeSet("document-1", rollback.changeSet.id),
    undefined
  );
  assert.equal(
    await store.getCommittedTransaction(rollback.transaction.sourceTransactionId),
    undefined
  );

  await store.updatePromptOutputOwnership({
    outputId: "output-1",
    documentId: "document-1",
    blockId: attempt.blockId,
    state: "detached",
    detachedRevision: 2,
    at: timestamp(3)
  });
  assert.deepEqual((await store.listDetachedPromptOutputs()).map((item) => item.outputId), [
    "output-1"
  ]);
  assert.deepEqual(await store.getPromptOutputOwnership("output-1"), {
    outputId: "output-1",
    documentId: "document-1",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "detached",
    attachedRevision: 2,
    detachedRevision: 2,
    createdAt: timestamp(1),
    updatedAt: timestamp(3)
  });

  store.close();
});

test("attempt and stage records round-trip and stage claims are retry-safe", async () => {
  const store = new SQLiteDocumentStore("project", createStorePath());
  await store.commitCreation(creationCommit("document-2"));
  const attempt = promptCreationAttempt("document-2", "attempt-stage");
  await store.createAttempt(attempt);
  assert.deepEqual(
    await store.getPromptCreationAttemptByBlock("document-2", attempt.blockId),
    attempt
  );
  await assert.rejects(
    store.createAttempt({
      ...attempt,
      id: "attempt-same-block",
      clientRequestId: "client-same-block"
    }),
    /UNIQUE/
  );

  assert.deepEqual(await store.getAttempt("document-2", attempt.id), attempt);
  assert.deepEqual(
    await store.getAttemptByRequest(
      "document-2",
      "prompt-create",
      attempt.clientRequestId
    ),
    attempt
  );
  assert.deepEqual(await store.listRecoverableAttempts(), [attempt]);

  const proposed: PromptCreationAttempt = {
    ...attempt,
    state: "proposed",
    candidateOutputId: "dedicated-output",
    candidateHeadRevision: 3,
    updatedAt: timestamp(2)
  };
  await store.updateAttempt(proposed);
  assert.deepEqual(await store.getAttemptById(attempt.id), proposed);

  const compute: DocumentStageReceipt = {
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

  const settle: DocumentStageReceipt = {
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
  assert.equal(
    await store.claimStage({ ...settle, updatedAt: timestamp(5) }),
    "claimed"
  );
  assert.equal(await store.recoverInterruptedStages(timestamp(6)), 1);
  assert.equal(
    await store.claimStage({ ...settle, updatedAt: timestamp(7) }),
    "claimed"
  );

  await store.registerPendingPromptOutput({
    outputId: "dedicated-output",
    documentId: "document-2",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "pending",
    createdAt: timestamp(6),
    updatedAt: timestamp(6)
  });
  const diagnostic = { code: "settlement_failed", message: "Identity conflict" };
  const failedAttempt: PromptCreationAttempt = {
    ...proposed,
    state: "failed",
    diagnostic,
    updatedAt: timestamp(8)
  };
  const failedSettle: DocumentStageReceipt = {
    ...settle,
    state: "failed",
    diagnostic,
    updatedAt: timestamp(8)
  };
  await store.failPromptCreationStage({
    attempt: failedAttempt,
    receipt: failedSettle
  });
  await store.failPromptCreationStage({
    attempt: failedAttempt,
    receipt: failedSettle
  });
  assert.deepEqual(await store.getAttemptById(attempt.id), failedAttempt);
  assert.deepEqual(await store.getPromptOutputOwnership("dedicated-output"), {
    outputId: "dedicated-output",
    documentId: "document-2",
    blockId: attempt.blockId,
    creationAttemptId: attempt.id,
    state: "detached",
    createdAt: timestamp(6),
    updatedAt: timestamp(8)
  });

  store.close();
});

test("history reads paginate and pruning retains the current replay tail and active attempts", async () => {
  const store = new SQLiteDocumentStore("project", createStorePath());
  const creation = creationCommit("document-history");
  await store.commitCreation(creation);
  const initial = creation.base.snapshot;
  let head = creation.head;

  for (let revision = 2; revision <= 7; revision += 1) {
    const commit = mutationCommit(head, revision);
    assert.equal(await store.commitMutation(commit), true);
    head = (await store.getHead(head.id))!;
    if (revision % 2 === 1) {
      assert.equal(
        await store.appendBaseIfHead(
          head.id,
          head.revision,
          baseForHead(initial, head)
        ),
        true
      );
      head = (await store.getHead(head.id))!;
    }
  }

  const firstPage = await store.listChangeSets(head.id, undefined, 2);
  assert.deepEqual(firstPage.items.map((change) => change.seq), [7, 6]);
  assert.ok(firstPage.nextCursor);
  const secondPage = await store.listChangeSets(head.id, firstPage.nextCursor, 2);
  assert.deepEqual(secondPage.items.map((change) => change.seq), [5, 4]);
  const malformedHeadCursor = Buffer.from(JSON.stringify({
    kind: "document-head",
    updatedAt: 42,
    id: head.id
  }), "utf8").toString("base64url");
  await assert.rejects(
    store.listHeads(malformedHeadCursor),
    (error: unknown) => error instanceof InvalidDocumentCursorError
  );
  const malformedChangeCursor = Buffer.from(JSON.stringify({
    kind: "document-change",
    seq: "4"
  }), "utf8").toString("base64url");
  await assert.rejects(
    store.listChangeSets(head.id, malformedChangeCursor, 2),
    (error: unknown) => error instanceof InvalidDocumentCursorError
  );
  assert.deepEqual(
    (await store.getChangeSets(head.id, 5, 7)).map((change) => change.seq),
    [6, 7]
  );

  const staleBase = baseForHead(initial, { ...head, revision: 5 });
  assert.equal(await store.appendBaseIfHead(head.id, 5, staleBase), false);

  const terminalAttempts: DocumentAttempt[] = [
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
  assert.equal((await store.getBaseAtOrBefore(head.id, 5))?.baseSeq, 5);
  assert.deepEqual(
    (await store.getChangeSets(head.id, 0, 7)).map((change) => change.seq),
    [6, 7]
  );
  assert.equal(await store.getAttempt(head.id, "terminal-1"), undefined);
  assert.equal(await store.getAttempt(head.id, "terminal-2"), undefined);
  assert.ok(await store.getAttempt(head.id, "terminal-3"));
  assert.deepEqual(await store.listRecoverableAttempts(), [active]);

  store.close();
});

test("retention anchors live and deleted Document bodies at the earliest retained revision", async () => {
  const store = new SQLiteDocumentStore("retention-project", createStorePath());
  const creation = creationCommit("retention-document");
  await store.commitCreation(creation);
  const revision2 = mutationCommit(creation.head, 2);
  const revision3 = mutationCommit(revision2.head, 3);
  const revision4 = mutationCommit(revision3.head, 4);
  assert.equal(await store.commitMutation(revision2), true);
  assert.equal(await store.commitMutation(revision3), true);
  assert.equal(await store.commitMutation(revision4), true);

  const liveCutoff = new Date(Date.parse(timestamp(3)) + 500).toISOString();
  assert.deepEqual(await store.listRetentionAnchors(liveCutoff), [{
    documentId: creation.head.id,
    revision: 3,
    currentRevision: 4
  }]);
  assert.equal(
    await store.compactRetentionHistory(
      { documentId: creation.head.id, revision: 3, currentRevision: 4 },
      baseForHead(creation.base.snapshot, revision3.head)
    ),
    true
  );
  await store.pruneRevisionHistory(liveCutoff);
  assert.equal(await store.getHistoricalHead(creation.head.id, 2), undefined);
  assert.deepEqual(await store.getHistoricalHead(creation.head.id, 3), revision3.head);
  assert.equal((await store.getBaseAtOrBefore(creation.head.id, 3))?.baseSeq, 3);
  assert.deepEqual(
    (await store.getChangeSets(creation.head.id, 3, 4)).map((change) => change.revision),
    [4]
  );

  const { sourceChangeSetId: _sourceChangeSetId, ...source } = revision4.transaction;
  const deletionTransaction: DocumentCommittedTransaction = {
    ...source,
    sourceTransactionId: "transaction-retention-document-deleted",
    sourceRequestId: "delete-retention-document",
    kind: "document.deleted",
    revision: 5,
    operationTypes: ["document.delete"],
    occurredAt: timestamp(5)
  };
  assert.equal(
    await store.deleteDocument(creation.head.id, timestamp(5), deletionTransaction),
    5
  );
  const deletedCutoff = new Date(Date.parse(timestamp(4)) + 500).toISOString();
  assert.deepEqual(await store.listRetentionAnchors(deletedCutoff), [{
    documentId: creation.head.id,
    revision: 4
  }]);
  assert.equal(
    await store.compactRetentionHistory(
      { documentId: creation.head.id, revision: 4 },
      baseForHead(creation.base.snapshot, revision4.head)
    ),
    true
  );
  await store.pruneRevisionHistory(deletedCutoff);
  assert.deepEqual(await store.getHistoricalHead(creation.head.id, 4), revision4.head);
  assert.equal((await store.getBaseAtOrBefore(creation.head.id, 4))?.baseSeq, 4);
  assert.deepEqual(await store.getChangeSets(creation.head.id, 4, 5), []);

  store.close();
});

test("a creation commit rejects prompt ownership naming an attempt that does not exist", async () => {
  // The copy path has no attempt: nothing was asked and nothing was answered, so
  // there is no attempts row for the ownership to point at. `creation_attempt_id`
  // is a real foreign key with `foreign_keys = ON`, so naming a non-attempt is a
  // constraint failure rather than a stray string — and it fails *after* the
  // Derived Outputs have already been declared, which is precisely how a copy
  // leaks one output per Prompt Block on every attempt.
  const store = new SQLiteDocumentStore("project-fk", createStorePath());
  const creation = creationCommit("document-fk");

  await assert.rejects(
    store.commitCreation({
      ...creation,
      promptOutputs: [
        {
          outputId: "output-fk",
          documentId: "document-fk",
          blockId: "block-fk",
          creationAttemptId: "not-an-attempt-id",
          state: "attached",
          attachedRevision: 1,
          createdAt: timestamp(0),
          updatedAt: timestamp(0)
        }
      ]
    }),
    /FOREIGN KEY constraint failed/
  );
  assert.equal(await store.getHead("document-fk"), undefined, "nothing is committed");

  store.close();
});

test("a creation commit accepts prompt ownership with no creation attempt", async () => {
  // Omitting it is what a copy must do, and the column is nullable precisely so
  // that "there was no attempt" is expressible.
  const store = new SQLiteDocumentStore("project-fk-ok", createStorePath());
  const creation = creationCommit("document-fk-ok");

  await store.commitCreation({
    ...creation,
    promptOutputs: [
      {
        outputId: "output-fk-ok",
        documentId: "document-fk-ok",
        blockId: "block-fk-ok",
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp(0),
        updatedAt: timestamp(0)
      },
      // Two Prompt Blocks in one copy. A shared creation attempt id would also
      // trip the UNIQUE constraint, so this is the second reason the copy path
      // cannot borrow its idempotency key for the column.
      {
        outputId: "output-fk-ok-2",
        documentId: "document-fk-ok",
        blockId: "block-fk-ok-2",
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp(0),
        updatedAt: timestamp(0)
      }
    ]
  });

  assert.equal((await store.getPromptOutputOwnership("output-fk-ok"))?.blockId, "block-fk-ok");
  assert.equal((await store.getPromptOutputOwnership("output-fk-ok-2"))?.blockId, "block-fk-ok-2");

  store.close();
});

test("detached prompt outputs are listed only once past the cutoff, and released only when detached", async () => {
  const store = new SQLiteDocumentStore("project-reap", createStorePath());
  const creation = creationCommit("document-reap");
  await store.commitCreation({
    ...creation,
    promptOutputs: [
      {
        outputId: "output-old",
        documentId: "document-reap",
        blockId: "block-old",
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp(0),
        updatedAt: timestamp(0)
      },
      {
        outputId: "output-recent",
        documentId: "document-reap",
        blockId: "block-recent",
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp(0),
        updatedAt: timestamp(0)
      },
      {
        outputId: "output-live",
        documentId: "document-reap",
        blockId: "block-live",
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp(0),
        updatedAt: timestamp(0)
      }
    ]
  });

  const detach = async (outputId: string, blockId: string, at: string): Promise<void> => {
    await store.updatePromptOutputOwnership({
      outputId,
      documentId: "document-reap",
      blockId,
      state: "detached",
      detachedRevision: 2,
      at
    });
  };
  await detach("output-old", "block-old", timestamp(10));
  await detach("output-recent", "block-recent", timestamp(40));

  // The grace period is the whole safety argument: compensation re-attaches a
  // detached output by ID, so only rows past the cutoff are genuinely
  // abandoned.
  const cutoff = timestamp(20);
  assert.deepEqual(
    (await store.listDetachedPromptOutputsBefore(cutoff)).map((entry) => entry.outputId),
    ["output-old"]
  );

  // An attached row is never released, even if named directly — that would
  // strand a live Prompt Block pointing at a deleted output.
  await store.deletePromptOutputOwnership("output-live");
  assert.equal((await store.getPromptOutputOwnership("output-live"))?.state, "attached");

  await store.deletePromptOutputOwnership("output-old");
  assert.equal(await store.getPromptOutputOwnership("output-old"), undefined);
  assert.deepEqual(await store.listDetachedPromptOutputsBefore(cutoff), []);
  // The recent one is untouched and still waiting for its grace period.
  assert.equal((await store.getPromptOutputOwnership("output-recent"))?.state, "detached");

  store.close();
});
