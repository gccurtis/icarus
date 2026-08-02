import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  DerivedOutput,
  DerivedOutputRevision,
  DerivedRefreshResult,
  DeclareDerivedOutputOptions,
  DeclareDerivedOutputRequest,
  RefreshDerivedOutputOptions,
  UpdateDefinitionRequest,
  UpdateDerivedOutputDefinitionOptions
} from "../../src/3-capabilities/derived-outputs/domain/model.js";
import { createFormulaEngine } from "../../src/0-platform/formula/engine.js";
import type { FormulaResolverSnapshot } from "../../src/0-platform/formula/resolver.js";
import {
  createRichText,
  DEFAULT_CONFIG as DEFAULT_RICH_TEXT_CONFIG
} from "../../src/0-platform/rich-text/index.js";
import type {
  InternalJobsRuntime,
  JobDispatchReceipt
} from "../../src/0-utils/jobs/internalRuntime.js";
import { QueueCapacityError } from "../../src/0-utils/jobs/scheduler.js";
import {
  createDocumentCapability,
  type DocumentCapability,
  type DocumentDependencies
} from "../../src/3-capabilities/document/application/documentService.js";
import {
  CompensationConflictError,
  DocumentIdentityReuseError,
  DocumentOperationError,
  HistoryPrunedError,
  IdempotencyMismatchError,
  RevisionConflictError
} from "../../src/3-capabilities/document/domain/errors.js";
import type {
  DocumentBlock,
  DocumentCommandRequest,
  DocumentCommandResult,
  DocumentCommittedTransaction,
  DocumentInternalJobIntent,
  DocumentOperation,
  DocumentOptions,
  DocumentSnapshot,
  DocumentSubmissionReceipt,
  TextBlock
} from "../../src/3-capabilities/document/domain/model.js";
import type { DocumentDerivedOutputs } from "../../src/3-capabilities/document/ports/derivedOutputs.js";
import type { DocumentActivityPublisher } from "../../src/3-capabilities/document/ports/activityPublisher.js";
import type { PromptCreationFailureCommit } from "../../src/3-capabilities/document/ports/documentStore.js";
import { SQLiteDocumentStore } from "../../src/3-capabilities/document/persistence/sqliteDocumentStore.js";
import { createDocumentInternalJob } from "../../src/4-job-wiring/document/createDocumentJobs.js";
import {
  CapturingLogger,
  TEST_FORMULA_LIMITS
} from "../helpers/testDoubles.js";

const NORMAL_STYLE = "document-style-normal";

const OPTIONS: DocumentOptions = {
  history: {
    retainedBaseCount: 5,
    retainedChangeSetCount: 1_000,
    retainedTerminalAttemptCount: 1_000
  },
  limits: {
    maxRowsPerDocument: 100,
    maxBlocksPerRow: 16,
    maxStylesPerDocument: 100,
    maxNestingDepth: 12,
    maxAtomsPerBlockContent: 1_000,
    maxTableRows: 100,
    maxTableColumns: 50
  }
};

const clone = <T>(value: T): T => structuredClone(value);

class CapturingJobs implements InternalJobsRuntime<DocumentInternalJobIntent> {
  readonly intents: DocumentInternalJobIntent[] = [];

  async dispatch(intent: DocumentInternalJobIntent): Promise<JobDispatchReceipt> {
    this.intents.push(clone(intent));
    return {
      jobId: `captured-${this.intents.length}`,
      acceptedAt: new Date().toISOString()
    };
  }
}

class CapacityOnceJobs extends CapturingJobs {
  dispatchAttempts = 0;

  override async dispatch(
    intent: DocumentInternalJobIntent
  ): Promise<JobDispatchReceipt> {
    this.dispatchAttempts += 1;
    if (this.dispatchAttempts === 1) {
      throw new QueueCapacityError("concurrent", "Simulated full queue");
    }
    return super.dispatch(intent);
  }
}

class CapturingActivityPublisher implements DocumentActivityPublisher {
  readonly transactions: DocumentCommittedTransaction[] = [];
  failuresRemaining = 0;

  async publish(transaction: DocumentCommittedTransaction): Promise<void> {
    this.transactions.push(clone(transaction));
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("Simulated Activity publisher failure");
    }
  }
}

class FailOnceRecordSubmissionStore extends SQLiteDocumentStore {
  recordSubmissionAttempts = 0;

  override async recordSubmission(
    receipt: DocumentSubmissionReceipt
  ): Promise<void> {
    this.recordSubmissionAttempts += 1;
    if (this.recordSubmissionAttempts === 1) {
      throw new Error("Simulated crash before the local receipt commits");
    }
    await super.recordSubmission(receipt);
  }
}

class InterruptPromptCreationFailureStore extends SQLiteDocumentStore {
  failureFinalizationAttempts = 0;

  override async failPromptCreationStage(
    _commit: PromptCreationFailureCommit
  ): Promise<void> {
    this.failureFinalizationAttempts += 1;
    throw new Error("Simulated interruption before Prompt creation failure commit");
  }
}

class FakeDerivedOutputs implements DocumentDerivedOutputs {
  readonly outputs = new Map<string, DerivedOutput>();
  readonly revisions = new Map<string, DerivedOutputRevision>();
  readonly declarations = new Map<string, string>();
  readonly refreshes = new Map<string, DerivedRefreshResult>();
  readonly definitionUpdates = new Map<string, {
    outputId: string;
    request: UpdateDefinitionRequest;
    result: DerivedOutput;
  }>();
  private sequence = 0;
  refreshFailuresRemaining = 0;
  failEveryRefresh = false;

  async declare(
    request: DeclareDerivedOutputRequest,
    options?: DeclareDerivedOutputOptions
  ): Promise<DerivedOutput> {
    if (options) {
      const existingId = this.declarations.get(options.idempotencyKey);
      if (existingId) return clone(this.outputs.get(existingId)!);
    }

    this.sequence += 1;
    const id = `dedicated-output-${this.sequence}`;
    const timestamp = new Date().toISOString();
    const output: DerivedOutput = {
      id,
      kind: "prompt",
      revision: 1,
      definition: {
        prompt: request.prompt,
        contextEntries: clone(request.contextEntries ?? []),
        stabilisationText: request.stabilisationText ?? "",
        definitionRevision: 1
      },
      headRevision: 0,
      freshness: { state: "refreshing", lastCheckedAt: null },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.outputs.set(id, output);
    if (options) this.declarations.set(options.idempotencyKey, id);
    return clone(output);
  }

  async get(id: string): Promise<DerivedOutput | null> {
    const output = this.outputs.get(id);
    return output ? clone(output) : null;
  }

  async getRevision(
    id: string,
    revision: number
  ): Promise<DerivedOutputRevision | null> {
    const value = this.revisions.get(`${id}:${revision}`);
    return value ? clone(value) : null;
  }

  async updateDefinition(
    id: string,
    request: UpdateDefinitionRequest,
    options?: UpdateDerivedOutputDefinitionOptions
  ): Promise<DerivedOutput> {
    if (options) {
      const replay = this.definitionUpdates.get(options.idempotencyKey);
      if (replay) {
        assert.equal(replay.outputId, id);
        assert.deepEqual(replay.request, request);
        return clone(replay.result);
      }
    }
    const current = this.outputs.get(id);
    if (!current) throw new Error(`Missing Derived Output: ${id}`);
    if (current.definition.definitionRevision !== request.expectedDefinitionRevision) {
      throw new Error("Stale Derived Output definition");
    }
    const timestamp = new Date().toISOString();
    const updated: DerivedOutput = {
      ...current,
      revision: current.revision + 1,
      definition: {
        prompt: request.prompt,
        contextEntries: clone(request.contextEntries),
        stabilisationText: request.stabilisationText,
        definitionRevision: current.definition.definitionRevision + 1
      },
      freshness: {
        state: "stale",
        lastCheckedAt: timestamp,
        staleSince: timestamp
      },
      updatedAt: timestamp
    };
    this.outputs.set(id, updated);
    if (options) {
      this.definitionUpdates.set(options.idempotencyKey, {
        outputId: id,
        request: clone(request),
        result: clone(updated)
      });
    }
    return clone(updated);
  }

  async refresh(
    id: string,
    options?: RefreshDerivedOutputOptions
  ): Promise<DerivedRefreshResult> {
    if (options) {
      const existing = this.refreshes.get(options.idempotencyKey);
      if (existing) return clone(existing);
    }
    const current = this.outputs.get(id);
    if (!current) throw new Error(`Missing Derived Output: ${id}`);
    if (this.failEveryRefresh || this.refreshFailuresRemaining > 0) {
      if (this.refreshFailuresRemaining > 0) {
        this.refreshFailuresRemaining -= 1;
      }
      throw new Error("Simulated refresh failure");
    }
    const revisionNumber = current.headRevision + 1;
    const timestamp = new Date().toISOString();
    const revision: DerivedOutputRevision = {
      outputId: id,
      revision: revisionNumber,
      definitionRevision: current.definition.definitionRevision,
      content: `Generated ${id} revision ${revisionNumber}`,
      evidence: [],
      status: "ok",
      createdAt: timestamp
    };
    const output: DerivedOutput = {
      ...current,
      revision: current.revision + 1,
      headRevision: revisionNumber,
      freshness: { state: "current", lastCheckedAt: timestamp },
      updatedAt: timestamp
    };
    this.outputs.set(id, output);
    this.revisions.set(`${id}:${revisionNumber}`, revision);
    const result = { output: clone(output), revision: clone(revision), skipped: false };
    if (options) this.refreshes.set(options.idempotencyKey, clone(result));
    return result;
  }

  async delete(id: string): Promise<void> {
    this.outputs.delete(id);
  }

  async purge(id: string): Promise<void> {
    this.outputs.delete(id);
    for (const key of [...this.revisions.keys()]) {
      if (key.startsWith(`${id}:`)) this.revisions.delete(key);
    }
  }
}

interface Harness {
  document: DocumentCapability;
  store: SQLiteDocumentStore;
  derivedOutputs: FakeDerivedOutputs;
  jobs: CapturingJobs;
  dbPath: string;
  logger: CapturingLogger;
}

interface HarnessOverrides {
  jobs?: CapturingJobs;
  derivedOutputs?: FakeDerivedOutputs;
  activityPublisher?: CapturingActivityPublisher;
  dbPath?: string;
  storeFactory?: (dbPath: string) => SQLiteDocumentStore;
  options?: DocumentOptions;
}

const createHarness = (
  overrides: HarnessOverrides = {}
): Harness => {
  const dbPath = overrides.dbPath ?? join(
    mkdtempSync(join(tmpdir(), "icarus-document-application-")),
    "documents.db"
  );
  const store = overrides.storeFactory
    ? overrides.storeFactory(dbPath)
    : new SQLiteDocumentStore("application-test-project", dbPath);
  const logger = new CapturingLogger();
  const jobs = overrides.jobs ?? new CapturingJobs();
  const derivedOutputs = overrides.derivedOutputs ?? new FakeDerivedOutputs();
  const resolverSnapshot: FormulaResolverSnapshot = {
    id: "resolver-snapshot",
    scope: { userId: "test-user", projectId: "application-test-project" },
    bindings: new Map(),
    snapshotDigest: "resolver-digest",
    createdFrom: []
  };
  const dependencies: DocumentDependencies = {
    richText: createRichText(DEFAULT_RICH_TEXT_CONFIG, logger),
    formula: createFormulaEngine(TEST_FORMULA_LIMITS, logger),
    formulaResolver: {
      buildSnapshot: async () => resolverSnapshot
    },
    derivedOutputs,
    jobs,
    logger,
    ...(overrides.activityPublisher
      ? { activityPublisher: overrides.activityPublisher }
      : {})
  };
  return {
    document: createDocumentCapability(
      store,
      dependencies,
      overrides.options ?? OPTIONS
    ),
    store,
    derivedOutputs,
    jobs,
    dbPath,
    logger
  };
};

const waitUntil = async (
  predicate: () => boolean,
  timeoutMs = 1_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      assert.fail(`Condition was not met within ${timeoutMs}ms`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
};

const command = (
  requestId: string,
  commandValue: DocumentCommandRequest["command"]
): DocumentCommandRequest => ({
  requestId,
  origin: "interactive",
  actorId: "test-actor",
  command: commandValue
});

const requireChanged = (
  result: DocumentCommandResult
): Extract<DocumentCommandResult, { type: "document.changed" }> => {
  assert.equal(result.type, "document.changed");
  return result as Extract<DocumentCommandResult, { type: "document.changed" }>;
};

const requireCreated = (
  result: DocumentCommandResult
): Extract<DocumentCommandResult, { type: "document.created" }> => {
  assert.equal(result.type, "document.created");
  return result as Extract<DocumentCommandResult, { type: "document.created" }>;
};

/** Creates a document and returns the id the service allocated for it. */
const createDocument = async (
  document: DocumentCapability,
  requestId: string,
  title = "Document"
): Promise<string> =>
  requireCreated(
    await document.command(command(requestId, { type: "document.create", title }))
  ).head.id;

const load = async (
  document: DocumentCapability,
  documentId: string,
  revision?: number
): Promise<Extract<Awaited<ReturnType<DocumentCapability["query"]>>, { type: "document.loaded" }>> => {
  const result = await document.query({
    requestId: `load-${documentId}-${revision ?? "head"}`,
    query: {
      type: "document.load",
      documentId,
      ...(revision === undefined ? {} : { revision })
    }
  });
  assert.equal(result.type, "document.loaded");
  return result as Extract<typeof result, { type: "document.loaded" }>;
};

const contentBlock = (id: string, text: string): TextBlock => ({
  id,
  kind: "text",
  styleId: NORMAL_STYLE,
  content: {
    atoms: [{ id: `${id}-atom`, kind: "text", text }],
    marks: []
  }
});

const rowInsert = (
  rowId: string,
  block: DocumentBlock,
  afterRowId?: string
): DocumentOperation => ({
  type: "row.insert",
  row: {
    id: rowId,
    blocks: [block],
    layout: {
      blockGapTwips: 0,
      marginBeforeTwips: 0,
      marginAfterTwips: 0,
      tracks: [{ blockId: block.id, widthUnits: 1 }]
    }
  },
  ...(afterRowId ? { afterRowId } : {})
});

const blockById = (
  snapshot: DocumentSnapshot,
  blockId: string
): DocumentBlock | undefined =>
  snapshot.rows.flatMap((row) => row.blocks).find((block) => block.id === blockId);

test("Document creation replays identical requests and rejects divergent request reuse", async () => {
  const harness = createHarness();
  const create = command("create-request", {
    type: "document.create",
    title: "Initial title"
  });

  const first = await harness.document.command(create);
  const documentId = requireCreated(first).head.id;

  // The replay must return the original result, including the same allocated id.
  // A second document here would be the failure this receipt exists to prevent.
  const replay = await harness.document.command(clone(create));
  assert.deepEqual(replay, first);
  assert.equal(requireCreated(replay).head.id, documentId);
  assert.equal((await load(harness.document, documentId)).snapshot.title, "Initial title");
  assert.equal(
    (await harness.document.query({
      requestId: "list-after-replay",
      query: { type: "document.list" }
    }) as { type: "document.listed"; items: unknown[] }).items.length,
    1
  );

  // A different request id is a different logical create, so it gets its own document.
  const second = requireCreated(
    await harness.document.command(command("create-request-2", {
      type: "document.create",
      title: "Initial title"
    }))
  );
  assert.notEqual(second.head.id, documentId);

  await assert.rejects(
    harness.document.command(command("create-request", {
      type: "document.create",
      title: "Different title"
    })),
    (error: unknown) =>
      error instanceof IdempotencyMismatchError &&
      error.requestId === "create-request"
  );
  await assert.rejects(
    harness.document.command(command("$document-internal$:caller", {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
      operations: [{ type: "document.rename", title: "Reserved" }]
    })),
    (error: unknown) =>
      error instanceof DocumentOperationError && /reserved Document namespace/.test(error.message)
  );

  const listed = await harness.document.query({
    requestId: "list-request",
    query: { type: "document.list" }
  });
  assert.equal(listed.type, "document.listed");
  if (listed.type === "document.listed") {
    // Two documents: the replayed create did not produce a third.
    assert.deepEqual(
      listed.items.map((head) => head.id).sort(),
      [documentId, second.head.id].sort()
    );
  }
  assert.equal((await harness.store.listUnpublishedTransactions()).length, 2);

  harness.store.close();
});

test("Document Activity publication is post-commit, best-effort, and recoverable", async () => {
  const publisher = new CapturingActivityPublisher();
  publisher.failuresRemaining = 1;
  const harness = createHarness({ activityPublisher: publisher });
  const create = command("activity-create", {
    type: "document.create",
    title: "Activity publication"
  });

  const result = await harness.document.command(create);
  assert.equal(result.type, "document.created");
  const documentId = requireCreated(result).head.id;
  assert.equal((await load(harness.document, documentId)).head.revision, 1);
  assert.equal(publisher.transactions.length, 1);

  const [pending] = await harness.store.listUnpublishedTransactions();
  assert.ok(pending);
  assert.equal(
    pending.sourceTransactionId,
    publisher.transactions[0]?.sourceTransactionId
  );
  assert.equal(pending.sourceRequestId, "activity-create");
  assert.equal(pending.origin, "interactive");
  assert.equal(pending.sourceSemanticDigest, result.head.semanticDigest);

  // An exact request replay does not create or publish a second transaction.
  assert.deepEqual(await harness.document.command(clone(create)), result);
  assert.equal(publisher.transactions.length, 1);

  assert.equal(await harness.document.publishPendingActivity(), 1);
  assert.equal(publisher.transactions.length, 2);
  assert.deepEqual(publisher.transactions[1], pending);
  assert.deepEqual(await harness.store.listUnpublishedTransactions(), []);

  harness.store.close();
});

test("a capacity-rejected internal intent is redriven in-process", async () => {
  const jobs = new CapacityOnceJobs();
  const harness = createHarness({ jobs });
  const documentId = await createDocument(harness.document, "create-dispatch-redrive", "Dispatch redrive");

  const requested = await harness.document.command(command("request-dispatch-redrive", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "dispatch-redrive-block",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "dispatch-redrive-row" },
    prompt: "Retry this admission",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") return;

  await waitUntil(() => jobs.intents.length === 1);
  assert.equal(jobs.dispatchAttempts, 2);
  assert.deepEqual(jobs.intents[0], {
    type: "document.prompt.create.compute",
    attemptId: requested.attemptId,
    idempotencyKey: `document:${requested.attemptId}:compute`
  });
  assert.equal(
    (await harness.store.getAttemptById(requested.attemptId))?.state,
    "requested"
  );

  harness.store.close();
});

test("capacity redrive also supports non-attempt compaction intents", async () => {
  const jobs = new CapacityOnceJobs();
  const harness = createHarness({
    jobs,
    options: {
      ...OPTIONS,
      history: {
        ...OPTIONS.history,
        retainedChangeSetCount: 1
      }
    }
  });
  const documentId = await createDocument(harness.document, "create-compaction-redrive", "Compaction redrive");
  await harness.document.command(command("change-compaction-redrive", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [{ type: "document.rename", title: "Changed" }]
  }));

  await waitUntil(() => jobs.intents.length === 1);
  assert.equal(jobs.dispatchAttempts, 2);
  assert.deepEqual(jobs.intents[0], {
    type: "document.compact",
    documentId,
    idempotencyKey: `document:compact:${documentId}:2`
  });

  harness.store.close();
});

test("late compaction anchors and preserves the configured historical tail", async () => {
  const retainedChangeSetCount = 3;
  const harness = createHarness({
    options: {
      ...OPTIONS,
      history: {
        retainedBaseCount: 5,
        retainedChangeSetCount,
        retainedTerminalAttemptCount: 10
      }
    }
  });
  const documentId = await createDocument(harness.document, "create-retention-compaction", "Revision 1");
  for (let revision = 2; revision <= 9; revision += 1) {
    await harness.document.command(command(`retention-change-${revision}`, {
      type: "document.submit",
      documentId,
      expectedRevision: revision - 1,
      operations: [{
        type: "document.rename",
        title: `Revision ${revision}`
      }]
    }));
  }

  const compactIntents = harness.jobs.intents.filter(
    (intent) => intent.type === "document.compact"
  );
  assert.equal(compactIntents[0]?.documentId, documentId);
  assert.equal(compactIntents[0]?.idempotencyKey, `document:compact:${documentId}:4`);

  assert.equal(await harness.document.compact(documentId), true);
  assert.equal((await harness.store.getHead(documentId))?.baseSeq, 9);
  assert.equal((await harness.store.getBaseAtOrBefore(documentId, 6))?.baseSeq, 6);
  assert.equal((await harness.store.getBaseAtOrBefore(documentId, 9))?.baseSeq, 9);

  for (let revision = 6; revision <= 9; revision += 1) {
    const historical = await load(harness.document, documentId, revision);
    assert.equal(historical.snapshot.revision, revision);
    assert.equal(historical.snapshot.title, `Revision ${revision}`);
  }
  await assert.rejects(
    load(harness.document, documentId, 5),
    (error: unknown) =>
      error instanceof HistoryPrunedError && error.revision === 5
  );
  const history = await harness.document.query({
    requestId: "retained-history-query",
    query: { type: "document.history", documentId, limit: 20 }
  });
  assert.equal(history.type, "document.history");
  if (history.type === "document.history") {
    assert.deepEqual(
      history.items.map((changeSet) => changeSet.revision),
      [9, 8, 7]
    );
  }

  const dispatchCount = harness.jobs.intents.length;
  await harness.document.command(command("retention-change-10", {
    type: "document.submit",
    documentId,
    expectedRevision: 9,
    operations: [{ type: "document.rename", title: "Revision 10" }]
  }));
  assert.equal(
    harness.jobs.intents.length,
    dispatchCount,
    "a fresh head Base must reset the automatic compaction threshold"
  );

  harness.store.close();
});

test("compensation rejects a preserved target when compaction pruned intervening history", async () => {
  const harness = createHarness({
    options: {
      ...OPTIONS,
      history: {
        ...OPTIONS.history,
        retainedChangeSetCount: 1
      }
    }
  });
  const documentId = await createDocument(harness.document, "create-pruned-compensation", "Original");
  const renamed = requireChanged(await harness.document.command(command(
    "rename-before-pruned-compensation",
    {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
      operations: [{ type: "document.rename", title: "Changed" }]
    }
  )));
  await harness.document.command(command("initial-compensation", {
    type: "document.compensate",
    documentId,
    targetChangeSetId: renamed.changeSet.id,
    intent: "undo",
    expectedRevision: 2
  }));
  for (let revision = 4; revision <= 6; revision += 1) {
    await harness.document.command(command(`lifecycle-change-${revision}`, {
      type: "document.submit",
      documentId,
      expectedRevision: revision - 1,
      operations: [{
        type: "document.set-lifecycle",
        lifecycle: revision % 2 === 0 ? "active" : "archived"
      }]
    }));
  }

  assert.equal(await harness.document.compact(documentId), true);
  assert.equal(
    (await harness.store.getChangeSet(documentId, renamed.changeSet.id))?.revision,
    2,
    "a referenced compensation target remains addressable after pruning"
  );
  assert.deepEqual(
    (await harness.store.getChangeSets(documentId, 1, 5)).map((changeSet) => changeSet.revision),
    [2],
    "the target no longer has a complete intervening history"
  );

  await assert.rejects(
    harness.document.command(command("compensation-after-pruning", {
      type: "document.compensate",
      documentId,
      targetChangeSetId: renamed.changeSet.id,
      intent: "undo",
      expectedRevision: 6
    })),
    (error: unknown) =>
      error instanceof CompensationConflictError && /history has been pruned/.test(error.message)
  );

  harness.store.close();
});

test("Document compaction internal work is wired to the serial queue", () => {
  const harness = createHarness();
  const job = createDocumentInternalJob(harness.document, {
    type: "document.compact",
    documentId: "document-to-compact",
    idempotencyKey: "document:compact:document-to-compact:1"
  });

  assert.equal(job.name, "documents.compact");
  assert.equal(job.queueType, "serial");
  harness.store.close();
});

test("Every attempt's compute stage is concurrent and its settle stage is serial", () => {
  const harness = createHarness();
  const intents: DocumentInternalJobIntent[] = [
    { type: "document.prompt.create.compute", attemptId: "a", idempotencyKey: "k" },
    { type: "document.prompt.create.settle", attemptId: "a", idempotencyKey: "k" },
    { type: "document.prompt.refresh.compute", attemptId: "a", idempotencyKey: "k" },
    { type: "document.prompt.refresh.settle", attemptId: "a", idempotencyKey: "k" },
    { type: "document.formula.evaluate.compute", attemptId: "a", idempotencyKey: "k" },
    { type: "document.formula.evaluate.settle", attemptId: "a", idempotencyKey: "k" }
  ];
  for (const intent of intents) {
    const job = createDocumentInternalJob(harness.document, intent);
    const expectedQueue = intent.type.endsWith(".settle") ? "serial" : "concurrent";
    assert.equal(job.queueType, expectedQueue, intent.type);
  }
  harness.store.close();
});

test("commands cannot reuse tombstoned identities while exact compensation restores them", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-identity-ledger", "Identity ledger");

  const originalBlock = contentBlock("identity-block", "Original");
  await harness.document.command(command("insert-identities", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [rowInsert("identity-row", originalBlock)]
  }));

  const deleted = requireChanged(await harness.document.command(command(
    "delete-identities",
    {
      type: "document.submit",
      documentId,
      expectedRevision: 2,
      operations: [{ type: "block.delete", blockId: originalBlock.id }]
    }
  )));
  assert.equal((await load(harness.document, documentId)).snapshot.rows.length, 0);
  assert.deepEqual(
    await harness.store.getIdentity(documentId, "identity-block"),
    {
      documentId,
      id: "identity-block",
      kind: "block",
      state: "tombstoned",
      firstRevision: 2,
      lastTransitionRevision: 3,
      tombstonedRevision: 3
    }
  );

  await assert.rejects(
    harness.document.command(command("reuse-identities", {
      type: "document.submit",
      documentId,
      expectedRevision: 3,
      operations: [rowInsert(
        "identity-row",
        contentBlock("identity-block", "Replacement")
      )]
    })),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError &&
      error.identityId === "identity-block" &&
      error.previousKind === "block" &&
      error.requestedKind === "block"
  );
  assert.equal((await harness.store.getHead(documentId))?.revision, 3);
  assert.equal((await load(harness.document, documentId)).snapshot.rows.length, 0);

  await assert.rejects(
    harness.document.command(command("reuse-cross-kind", {
      type: "document.submit",
      documentId,
      expectedRevision: 3,
      operations: [rowInsert(
        "identity-block",
        contentBlock("fresh-block", "Cross kind")
      )]
    })),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError &&
      error.identityId === "identity-block" &&
      error.previousKind === "block" &&
      error.requestedKind === "row"
  );
  assert.equal((await harness.store.getHead(documentId))?.revision, 3);

  const restored = requireChanged(await harness.document.command(command(
    "restore-identities",
    {
      type: "document.compensate",
      documentId,
      targetChangeSetId: deleted.changeSet.id,
      intent: "undo",
      expectedRevision: 3
    }
  )));
  assert.equal(restored.changeSet.revision, 4);
  const snapshot = (await load(harness.document, documentId)).snapshot;
  assert.equal(snapshot.rows[0]?.id, "identity-row");
  assert.equal(snapshot.rows[0]?.blocks[0]?.id, "identity-block");
  assert.equal(
    (await harness.store.getIdentity(documentId, "identity-block"))?.state,
    "active"
  );
  assert.equal(
    (await harness.store.getIdentity(documentId, "identity-block"))
      ?.lastTransitionRevision,
    4
  );

  harness.store.close();
});

test("submit, historical load, disjoint stale rebase, conflict, undo, and redo compose through SQLite history", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-history", "History");

  const nestedPrompt: DocumentBlock = {
    id: "nested-prompt-container",
    kind: "callout",
    styleId: NORMAL_STYLE,
    tone: "info",
    rows: [{
      id: "nested-prompt-row",
      blocks: [{
        id: "forged-prompt",
        kind: "prompt",
        styleId: NORMAL_STYLE,
        output: { outputId: "caller-supplied-output", appliedRevision: 1 }
      }],
      layout: {
        blockGapTwips: 0,
        marginBeforeTwips: 0,
        marginAfterTwips: 0,
        tracks: [{ blockId: "forged-prompt", widthUnits: 1 }]
      }
    }]
  };
  await assert.rejects(
    harness.document.command(command("forged-nested-prompt", {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
      operations: [rowInsert("forged-row", nestedPrompt)]
    })),
    (error: unknown) =>
      error instanceof DocumentOperationError && /Prompt Blocks must be created/.test(error.message)
  );

  const initial = requireChanged(await harness.document.command(command("insert-rows", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [
      rowInsert("row-a", contentBlock("block-a", "A")),
      rowInsert("row-b", contentBlock("block-b", "B"), "row-a")
    ]
  })));
  assert.equal(initial.changeSet.revision, 2);

  const changeA = requireChanged(await harness.document.command(command("change-a", {
    type: "document.submit",
    documentId,
    expectedRevision: 2,
    operations: [{
      type: "block.set-presentation",
      blockId: "block-a",
      presentation: { alignment: "center" }
    }]
  })));
  assert.equal(changeA.changeSet.revision, 3);

  const staleButDisjoint = requireChanged(await harness.document.command(command("change-b-stale", {
    type: "document.submit",
    documentId,
    expectedRevision: 2,
    operations: [{
      type: "block.set-presentation",
      blockId: "block-b",
      presentation: { alignment: "right" }
    }]
  })));
  assert.equal(staleButDisjoint.changeSet.authoredRevision, 2);
  assert.equal(staleButDisjoint.changeSet.priorRevision, 3);
  assert.equal(staleButDisjoint.changeSet.revision, 4);

  await assert.rejects(
    harness.document.command(command("change-a-conflict", {
      type: "document.submit",
      documentId,
      expectedRevision: 2,
      operations: [{
        type: "block.set-presentation",
        blockId: "block-a",
        presentation: { alignment: "left" }
      }]
    })),
    (error: unknown) =>
      error instanceof RevisionConflictError &&
      error.expected === 2 &&
      error.actual === 4
  );

  const beforeUndo = await load(harness.document, documentId);
  assert.equal(blockById(beforeUndo.snapshot, "block-a")?.presentation?.alignment, "center");
  assert.equal(blockById(beforeUndo.snapshot, "block-b")?.presentation?.alignment, "right");
  const historical = await load(harness.document, documentId, 2);
  assert.equal(historical.snapshot.revision, 2);
  assert.equal(blockById(historical.snapshot, "block-a")?.presentation, undefined);
  assert.equal(blockById(historical.snapshot, "block-b")?.presentation, undefined);

  const undoRequest = command("undo-a", {
    type: "document.compensate",
    documentId,
    targetChangeSetId: changeA.changeSet.id,
    intent: "undo",
    expectedRevision: 4
  });
  const undo = requireChanged(await harness.document.command(undoRequest));
  assert.equal(undo.changeSet.revision, 5);
  assert.deepEqual(undo.changeSet.compensation, {
    intent: "undo",
    targetChangeSetId: changeA.changeSet.id
  });
  assert.equal(
    blockById((await load(harness.document, documentId)).snapshot, "block-a")?.presentation,
    undefined
  );
  assert.deepEqual(await harness.document.command(clone(undoRequest)), undo);

  const redo = requireChanged(await harness.document.command(command("redo-a", {
    type: "document.compensate",
    documentId,
    targetChangeSetId: undo.changeSet.id,
    intent: "redo",
    expectedRevision: 5
  })));
  assert.equal(redo.changeSet.revision, 6);
  assert.equal(
    blockById((await load(harness.document, documentId)).snapshot, "block-a")?.presentation?.alignment,
    "center"
  );

  const history = await harness.document.query({
    requestId: "history-query",
    query: { type: "document.history", documentId, limit: 10 }
  });
  assert.equal(history.type, "document.history");
  if (history.type === "document.history") {
    assert.deepEqual(history.items.map((changeSet) => changeSet.revision), [6, 5, 4, 3, 2]);
  }

  harness.store.close();
});

test("Prompt creation gives every Block a dedicated output, refresh adopts an exact revision, and deletion detaches ownership", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-prompts", "Prompts");

  const requestFirst = command("prompt-one-request", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "prompt-block-1",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "prompt-row-1" },
    prompt: "First question",
    contextEntries: [{ id: "source-a", kind: "document" }],
    stabilisationText: ""
  });
  const firstRequested = await harness.document.command(requestFirst);
  assert.equal(firstRequested.type, "prompt.create-requested");
  if (firstRequested.type !== "prompt.create-requested") return;
  await assert.rejects(
    harness.document.command(command("prompt-one-competing-request", {
      type: "prompt.create.request",
      documentId,
      expectedRevision: 1,
      blockId: "prompt-block-1",
      styleId: NORMAL_STYLE,
      placement: { kind: "new-row", rowId: "competing-row" },
      prompt: "Competing question",
      contextEntries: [],
      stabilisationText: ""
    })),
    (error: unknown) =>
      error instanceof DocumentOperationError && /already reserved/.test(error.message)
  );
  const intentCount = harness.jobs.intents.length;
  assert.deepEqual(await harness.document.command(clone(requestFirst)), firstRequested);
  assert.equal(harness.jobs.intents.length, intentCount, "an idempotent retry must not redispatch");

  await harness.document.computePromptCreation(firstRequested.attemptId);
  await harness.document.computePromptCreation(firstRequested.attemptId);
  assert.equal(harness.derivedOutputs.outputs.size, 1, "compute retry must reuse the dedicated output");
  const firstProposed = await harness.store.getAttemptById(firstRequested.attemptId);
  assert.equal(firstProposed?.state, "proposed");
  const firstOutputId = firstProposed?.kind === "prompt-create"
    ? firstProposed.candidateOutputId
    : undefined;
  assert.ok(firstOutputId);
  assert.equal((await harness.store.getPromptOutputOwnership(firstOutputId))?.state, "pending");

  await harness.document.settlePromptCreation(firstRequested.attemptId);
  await harness.document.settlePromptCreation(firstRequested.attemptId);
  assert.equal((await harness.store.getPromptOutputOwnership(firstOutputId))?.state, "attached");
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 2);

  const firstDefinitionRequest = command("prompt-one-definition-v2", {
    type: "prompt.update-definition",
    documentId,
    promptBlockId: "prompt-block-1",
    expectedDefinitionRevision: 1,
    prompt: "First revised question",
    contextEntries: [{ id: "source-a", kind: "document" }],
    stabilisationText: "First answer"
  });
  const firstDefinition = await harness.document.command(firstDefinitionRequest);
  assert.equal(firstDefinition.type, "prompt.definition-updated");
  if (firstDefinition.type !== "prompt.definition-updated") return;
  assert.equal(firstDefinition.output.definition.definitionRevision, 2);

  const secondDefinition = await harness.document.command(command("prompt-one-definition-v3", {
    type: "prompt.update-definition",
    documentId,
    promptBlockId: "prompt-block-1",
    expectedDefinitionRevision: 2,
    prompt: "First final question",
    contextEntries: [{ id: "source-a", kind: "document" }],
    stabilisationText: "Second answer"
  }));
  assert.equal(secondDefinition.type, "prompt.definition-updated");
  if (secondDefinition.type !== "prompt.definition-updated") return;
  assert.equal(secondDefinition.output.definition.definitionRevision, 3);
  assert.deepEqual(
    await harness.document.command(clone(firstDefinitionRequest)),
    firstDefinition,
    "an old retry must replay its exact historical result"
  );
  await assert.rejects(
    harness.document.command(command("prompt-one-definition-v2", {
      type: "prompt.update-definition",
      documentId,
      promptBlockId: "prompt-block-1",
      expectedDefinitionRevision: 1,
      prompt: "Divergent retry",
      contextEntries: [],
      stabilisationText: ""
    })),
    (error: unknown) => error instanceof IdempotencyMismatchError
  );

  const secondRequested = await harness.document.command(command("prompt-two-request", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 2,
    blockId: "prompt-block-2",
    styleId: NORMAL_STYLE,
    placement: {
      kind: "new-row",
      rowId: "prompt-row-2",
      afterRowId: "prompt-row-1"
    },
    prompt: "Second question",
    contextEntries: [{ id: "source-b", kind: "document" }],
    stabilisationText: "Prior wording"
  }));
  assert.equal(secondRequested.type, "prompt.create-requested");
  if (secondRequested.type !== "prompt.create-requested") return;
  await harness.document.computePromptCreation(secondRequested.attemptId);
  await harness.document.settlePromptCreation(secondRequested.attemptId);
  const secondAttempt = await harness.store.getAttemptById(secondRequested.attemptId);
  const secondOutputId = secondAttempt?.kind === "prompt-create"
    ? secondAttempt.candidateOutputId
    : undefined;
  assert.ok(secondOutputId);
  assert.notEqual(secondOutputId, firstOutputId);
  assert.equal((await harness.store.getPromptOutputOwnership(secondOutputId))?.state, "attached");

  const beforeRefresh = await load(harness.document, documentId);
  assert.equal(beforeRefresh.snapshot.revision, 3);
  assert.equal(beforeRefresh.promptRevisions.length, 2);
  assert.equal(
    (blockById(beforeRefresh.snapshot, "prompt-block-1") as { output?: { appliedRevision?: number } })
      .output?.appliedRevision,
    1
  );

  const refreshRequested = await harness.document.command(command("refresh-prompt-one", {
    type: "prompt.refresh.request",
    documentId,
    promptBlockId: "prompt-block-1",
    expectedRevision: 3
  }));
  assert.equal(refreshRequested.type, "prompt.refresh-requested");
  if (refreshRequested.type !== "prompt.refresh-requested") return;
  await harness.document.computePromptRefresh(refreshRequested.attemptId);
  await harness.document.settlePromptRefresh(refreshRequested.attemptId);

  const afterRefresh = await load(harness.document, documentId);
  assert.equal(afterRefresh.snapshot.revision, 4);
  assert.equal(
    (blockById(afterRefresh.snapshot, "prompt-block-1") as { output?: { appliedRevision?: number } })
      .output?.appliedRevision,
    2
  );
  assert.equal((await harness.store.getAttemptById(refreshRequested.attemptId))?.state, "settled");

  requireChanged(await harness.document.command(command("delete-prompt-one", {
    type: "document.submit",
    documentId,
    expectedRevision: 4,
    operations: [{ type: "block.delete", blockId: "prompt-block-1" }]
  })));
  const detached = await harness.store.getPromptOutputOwnership(firstOutputId);
  assert.equal(detached?.state, "detached");
  assert.equal(detached?.detachedRevision, 5);
  assert.equal((await harness.store.getPromptOutputOwnership(secondOutputId))?.state, "attached");

  harness.store.close();
});

test("the attempt lifecycle is logged end-to-end for prompt creation and refresh", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-lifecycle", "Lifecycle");

  const requested = await harness.document.command(command("lifecycle-prompt-request", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "lifecycle-block",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "lifecycle-row" },
    prompt: "Lifecycle question",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") return;

  await harness.document.computePromptCreation(requested.attemptId);
  await harness.document.settlePromptCreation(requested.attemptId);

  const eventsFor = (attemptId: string): string[] =>
    harness.logger.entries
      .filter((entry) => (entry.data as { attemptId?: string } | undefined)?.attemptId === attemptId)
      .map((entry) => entry.message);

  assert.deepEqual(eventsFor(requested.attemptId), [
    "document.attempt.requested",
    "document.attempt.computing",
    "document.attempt.proposed",
    "document.attempt.settled"
  ]);

  const refreshRequested = await harness.document.command(command("lifecycle-refresh-request", {
    type: "prompt.refresh.request",
    documentId,
    promptBlockId: "lifecycle-block",
    expectedRevision: 2
  }));
  assert.equal(refreshRequested.type, "prompt.refresh-requested");
  if (refreshRequested.type !== "prompt.refresh-requested") return;

  await harness.document.computePromptRefresh(refreshRequested.attemptId);
  assert.deepEqual(eventsFor(refreshRequested.attemptId), [
    "document.attempt.requested",
    "document.attempt.computing",
    "document.attempt.proposed"
  ]);

  await harness.document.query({
    requestId: "lifecycle-list-query",
    query: { type: "document.list" }
  });
  assert.ok(
    harness.logger.entries.some(
      (entry) =>
        entry.message === "document.query.completed" &&
        (entry.data as { type: string }).type === "document.list"
    )
  );

  harness.store.close();
});

test("prompt.update-definition survives a crash before its local receipt commits", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-document-definition-crash-"));
  const dbPath = join(directory, "documents.db");
  const derivedOutputs = new FakeDerivedOutputs();
  const first = createHarness({
    dbPath,
    derivedOutputs,
    storeFactory: (path) => new FailOnceRecordSubmissionStore(
      "application-test-project",
      path
    )
  });
  const documentId = await createDocument(first.document, "create-definition-crash", "Definition crash");
  const creation = await first.document.command(command("create-crash-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "crash-prompt-block",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "crash-prompt-row" },
    prompt: "Original prompt",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(creation.type, "prompt.create-requested");
  if (creation.type !== "prompt.create-requested") return;
  await first.document.computePromptCreation(creation.attemptId);
  await first.document.settlePromptCreation(creation.attemptId);
  const creationAttempt = await first.store.getAttemptById(creation.attemptId);
  const outputId = creationAttempt?.kind === "prompt-create"
    ? creationAttempt.candidateOutputId
    : undefined;
  assert.ok(outputId);

  const updateRequest = command("definition-crash-request", {
    type: "prompt.update-definition",
    documentId,
    promptBlockId: "crash-prompt-block",
    expectedDefinitionRevision: 1,
    prompt: "Updated exactly once",
    contextEntries: [{ id: "source-a", kind: "document" }],
    stabilisationText: "Prior answer"
  });
  await assert.rejects(
    first.document.command(updateRequest),
    /Simulated crash before the local receipt commits/
  );
  // Derived Outputs already committed the definition update before the crash.
  assert.equal(derivedOutputs.outputs.get(outputId)?.definition.definitionRevision, 2);
  assert.equal(derivedOutputs.definitionUpdates.size, 1);
  assert.equal(
    await first.store.getSubmission(documentId, updateRequest.requestId),
    undefined
  );
  first.store.close();

  const resumed = createHarness({ dbPath, derivedOutputs });
  const recovered = await resumed.document.command(clone(updateRequest));
  assert.equal(recovered.type, "prompt.definition-updated");
  if (recovered.type !== "prompt.definition-updated") return;
  assert.equal(recovered.output.id, outputId);
  assert.equal(recovered.output.definition.definitionRevision, 2);
  // Derived Outputs' own idempotency key recognised the retry: no second
  // definition update was applied, even without any Document-side claim.
  assert.equal(derivedOutputs.definitionUpdates.size, 1);
  assert.deepEqual(await resumed.document.command(clone(updateRequest)), recovered);
  assert.deepEqual(
    (await resumed.store.getSubmission(documentId, updateRequest.requestId))?.result,
    recovered
  );

  resumed.store.close();
});

test("prompt.update-definition fails cleanly if its Prompt Block is deleted during a crash window", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-document-definition-crash-delete-"));
  const dbPath = join(directory, "documents.db");
  const derivedOutputs = new FakeDerivedOutputs();
  const first = createHarness({
    dbPath,
    derivedOutputs,
    storeFactory: (path) => new FailOnceRecordSubmissionStore(
      "application-test-project",
      path
    )
  });
  const documentId = await createDocument(
    first.document,
    "create-definition-crash-delete",
    "Definition crash delete"
  );
  const creation = await first.document.command(command("create-crash-prompt-delete", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "crash-prompt-block-delete",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "crash-prompt-row-delete" },
    prompt: "Original prompt",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(creation.type, "prompt.create-requested");
  if (creation.type !== "prompt.create-requested") return;
  await first.document.computePromptCreation(creation.attemptId);
  await first.document.settlePromptCreation(creation.attemptId);

  const updateRequest = command("definition-crash-delete-request", {
    type: "prompt.update-definition",
    documentId,
    promptBlockId: "crash-prompt-block-delete",
    expectedDefinitionRevision: 1,
    prompt: "Updated exactly once",
    contextEntries: [],
    stabilisationText: ""
  });
  await assert.rejects(
    first.document.command(updateRequest),
    /Simulated crash before the local receipt commits/
  );
  first.store.close();

  const resumed = createHarness({ dbPath, derivedOutputs });
  requireChanged(await resumed.document.command(command("delete-before-exact-retry", {
    type: "document.submit",
    documentId,
    expectedRevision: 2,
    operations: [{ type: "block.delete", blockId: "crash-prompt-block-delete" }]
  })));

  // There is no frozen target to fall back on, so the retry cannot resolve
  // the Block and fails cleanly. This is an accepted trade-off, not a
  // correctness bug: the external update already happened and is not undone
  // or duplicated — the retry just cannot be replayed once its Block is gone.
  await assert.rejects(
    resumed.document.command(clone(updateRequest)),
    /Prompt Block not found/
  );

  resumed.store.close();
});

test("a transient Prompt creation exception retries without abandoning its dedicated output", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-transient-prompt-document", "Transient Prompt");
  const requested = await harness.document.command(command("request-transient-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "transient-prompt-block",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "transient-prompt-row" },
    prompt: "This refresh fails once",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") return;

  harness.derivedOutputs.refreshFailuresRemaining = 1;
  await harness.document.computePromptCreation(requested.attemptId);
  const proposed = await harness.store.getAttemptById(requested.attemptId);
  assert.equal(proposed?.state, "proposed");
  const output = [...harness.derivedOutputs.outputs.values()][0];
  assert.ok(output);
  assert.equal(
    (await harness.store.getPromptOutputOwnership(output.id))?.state,
    "pending"
  );

  await harness.document.settlePromptCreation(requested.attemptId);
  assert.equal(
    (await harness.store.getAttemptById(requested.attemptId))?.state,
    "settled"
  );
  assert.equal(
    (await harness.store.getPromptOutputOwnership(output.id))?.state,
    "attached"
  );
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 2);

  harness.store.close();
});

test("failed initial Prompt refresh records a detached dedicated output", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-failed-prompt-document", "Failed Prompt");
  const requested = await harness.document.command(command("request-failed-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId: "failed-prompt-block",
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "failed-prompt-row" },
    prompt: "This refresh will fail",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") return;

  harness.derivedOutputs.failEveryRefresh = true;
  await assert.rejects(
    harness.document.computePromptCreation(requested.attemptId),
    /Simulated refresh failure/
  );
  const attempt = await harness.store.getAttemptById(requested.attemptId);
  assert.equal(attempt?.state, "failed");
  const output = [...harness.derivedOutputs.outputs.values()][0];
  assert.ok(output);
  const ownership = await harness.store.getPromptOutputOwnership(output.id);
  assert.equal(ownership?.state, "detached");
  assert.equal(ownership?.detachedRevision, undefined);
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 1);

  harness.store.close();
});

test("Prompt creation settlement detaches its output after an identity conflict and restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-document-prompt-settle-recovery-"));
  const dbPath = join(directory, "documents.db");
  const derivedOutputs = new FakeDerivedOutputs();
  let interruptedStore!: InterruptPromptCreationFailureStore;
  const first = createHarness({
    dbPath,
    derivedOutputs,
    storeFactory: (path) => {
      interruptedStore = new InterruptPromptCreationFailureStore(
        "application-test-project",
        path
      );
      return interruptedStore;
    }
  });
  const documentId = await createDocument(
    first.document,
    "create-prompt-settle-recovery",
    "Prompt settlement recovery"
  );
  const blockId = "identity-conflicted-prompt-block";
  const requested = await first.document.command(command("request-conflicted-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId,
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "conflicted-prompt-row" },
    prompt: "This Prompt cannot claim its Block identity",
    contextEntries: [],
    stabilisationText: ""
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") return;

  requireChanged(await first.document.command(command("claim-conflicted-identity", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [rowInsert("temporary-identity-row", contentBlock(blockId, "Temporary"))]
  })));
  requireChanged(await first.document.command(command("tombstone-conflicted-identity", {
    type: "document.submit",
    documentId,
    expectedRevision: 2,
    operations: [{ type: "block.delete", blockId }]
  })));

  await first.document.computePromptCreation(requested.attemptId);
  const proposed = await first.store.getAttemptById(requested.attemptId);
  assert.equal(proposed?.state, "proposed");
  const outputId = proposed?.kind === "prompt-create"
    ? proposed.candidateOutputId
    : undefined;
  assert.ok(outputId);
  assert.equal(
    (await first.store.getPromptOutputOwnership(outputId))?.state,
    "pending"
  );

  await assert.rejects(
    first.document.settlePromptCreation(requested.attemptId),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError && error.identityId === blockId
  );
  assert.equal(interruptedStore.failureFinalizationAttempts, 3);
  assert.equal(
    (await first.store.getAttemptById(requested.attemptId))?.state,
    "proposed",
    "an interrupted failure commit must remain recoverable"
  );
  assert.equal(
    (await first.store.getPromptOutputOwnership(outputId))?.state,
    "pending"
  );
  first.store.close();

  const resumed = createHarness({ dbPath, derivedOutputs });
  assert.equal(await resumed.document.recoverPendingAttempts(), 1);
  await assert.rejects(
    resumed.document.settlePromptCreation(requested.attemptId),
    (error: unknown) =>
      error instanceof DocumentIdentityReuseError && error.identityId === blockId
  );
  assert.equal(
    (await resumed.store.getAttemptById(requested.attemptId))?.state,
    "failed"
  );
  assert.equal(
    (await resumed.store.getPromptOutputOwnership(outputId))?.state,
    "detached"
  );
  await resumed.document.settlePromptCreation(requested.attemptId);
  resumed.store.close();

  const restarted = createHarness({ dbPath, derivedOutputs });
  assert.equal(await restarted.document.recoverPendingAttempts(), 0);
  assert.equal(
    (await restarted.store.getPromptOutputOwnership(outputId))?.state,
    "detached"
  );
  restarted.store.close();
});

test("logical deletion refuses a stale revision and retains revision history", async () => {
  const harness = createHarness();
  const documentId = await createDocument(harness.document, "create-guarded", "Guarded");

  await assert.rejects(
    harness.document.command(command("delete-stale", {
      type: "document.delete",
      documentId,
      expectedRevision: 0
    })),
    RevisionConflictError
  );
  assert.ok(await harness.store.getHead(documentId));

  const deleted = await harness.document.command(command("delete-it", {
    type: "document.delete",
    documentId,
    expectedRevision: 1
  }));
  assert.deepEqual(deleted, { type: "document.deleted", documentId, revision: 2 });
  assert.equal(await harness.store.getHead(documentId), undefined);
  assert.equal((await harness.store.getHistoricalHead(documentId, 1))?.id, documentId);
  assert.equal(
    (await harness.document.query({
      requestId: "load-deleted-revision",
      query: { type: "document.load", documentId, revision: 1 }
    })).type,
    "document.loaded"
  );
  assert.deepEqual(
    await harness.document.command(command("delete-it", {
      type: "document.delete",
      documentId,
      expectedRevision: 1
    })),
    deleted
  );

  harness.store.close();
});

test("deleting a document clears its owned state and frees its create request", async () => {
  const derivedOutputs = new FakeDerivedOutputs();
  const harness = createHarness({ derivedOutputs });
  const documentId = await createDocument(harness.document, "create-purged", "Purged");

  const blockId = "purged-prompt-block";
  const requested = await harness.document.command(command("request-purged-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 1,
    blockId,
    styleId: NORMAL_STYLE,
    placement: { kind: "new-row", rowId: "purged-prompt-row" },
    prompt: "Question?",
    contextEntries: []
  }));
  assert.equal(requested.type, "prompt.create-requested");
  if (requested.type !== "prompt.create-requested") throw new Error("expected attempt");
  await harness.document.computePromptCreation(requested.attemptId);
  await harness.document.settlePromptCreation(requested.attemptId);

  const [owned] = await harness.store.listPromptOutputsForDocument(documentId);
  assert.ok(owned, "the settled Prompt Block should own a Derived Output");
  assert.ok(await derivedOutputs.get(owned.outputId));

  const head = await harness.store.getHead(documentId);
  assert.ok(head);

  await harness.document.command(command("delete-purged", {
    type: "document.delete",
    documentId,
    expectedRevision: head.revision
  }));

  // The Derived Output lives in another store, so the cascade cannot reach it —
  // deletion has to remove it explicitly.
  assert.equal(await derivedOutputs.get(owned.outputId), null);
  // Everything Document owned went with the cascade.
  assert.equal(await harness.store.getHead(documentId), undefined);
  assert.deepEqual(await harness.store.listPromptOutputsForDocument(documentId), []);
  assert.equal(await harness.store.getSubmission(documentId, "create-purged"), undefined);
  assert.equal(await harness.store.getAttemptById(requested.attemptId), undefined);
  const deletionTransaction = await harness.store.getCommittedTransactionByRequest(
    documentId,
    "delete-purged"
  );
  assert.equal(deletionTransaction?.kind, "document.deleted");

  await harness.document.command(command("purge-purged", {
    type: "document.purge",
    documentId
  }));
  assert.equal(await harness.store.hasResource(documentId), false);
  assert.deepEqual(
    await harness.store.getCommittedTransactionByRequest(documentId, "delete-purged"),
    deletionTransaction,
    "resource purge must not prune the immutable transaction outbox"
  );

  // The create receipt goes too. Replaying the original create must not hand
  // back a head for a document that no longer exists — it makes a new one.
  assert.equal(await harness.store.getCreateSubmission("create-purged"), undefined);
  const replayed = requireCreated(
    await harness.document.command(command("create-purged", {
      type: "document.create",
      title: "Purged"
    }))
  );
  assert.notEqual(replayed.head.id, documentId);
  assert.ok(await harness.store.getHead(replayed.head.id));

  harness.store.close();
});
