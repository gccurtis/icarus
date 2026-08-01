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
  DocumentCommittedFact,
  DocumentDelegatedCommandClaim,
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
  readonly facts: DocumentCommittedFact[] = [];
  failuresRemaining = 0;

  async publish(fact: DocumentCommittedFact): Promise<void> {
    this.facts.push(clone(fact));
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("Simulated Activity publisher failure");
    }
  }
}

class FailOnceDelegatedCompletionStore extends SQLiteDocumentStore {
  completionAttempts = 0;

  override async completeDelegatedCommand(
    claim: DocumentDelegatedCommandClaim,
    receipt: DocumentSubmissionReceipt
  ): Promise<void> {
    this.completionAttempts += 1;
    if (this.completionAttempts === 1) {
      throw new Error("Simulated crash before delegated-command completion");
    }
    await super.completeDelegatedCommand(claim, receipt);
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
    dbPath
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
    documentId: "document-idempotency",
    title: "Initial title"
  });

  const first = await harness.document.command(create);
  const replay = await harness.document.command(clone(create));
  assert.deepEqual(replay, first);
  assert.equal((await load(harness.document, "document-idempotency")).snapshot.title, "Initial title");

  await assert.rejects(
    harness.document.command(command("create-request", {
      type: "document.create",
      documentId: "document-idempotency",
      title: "Different title"
    })),
    (error: unknown) =>
      error instanceof IdempotencyMismatchError &&
      error.requestId === "create-request"
  );
  await assert.rejects(
    harness.document.command(command("$document-internal$:caller", {
      type: "document.submit",
      documentId: "document-idempotency",
      expectedRevision: 0,
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
    assert.deepEqual(listed.items.map((head) => head.id), ["document-idempotency"]);
  }
  assert.equal((await harness.store.listUnpublishedFacts()).length, 1);

  harness.store.close();
});

test("Document Activity publication is post-commit, best-effort, and recoverable", async () => {
  const publisher = new CapturingActivityPublisher();
  publisher.failuresRemaining = 1;
  const harness = createHarness({ activityPublisher: publisher });
  const create = command("activity-create", {
    type: "document.create",
    documentId: "document-activity-publication",
    title: "Activity publication"
  });

  const result = await harness.document.command(create);
  assert.equal(result.type, "document.created");
  assert.equal((await load(harness.document, "document-activity-publication")).head.revision, 0);
  assert.equal(publisher.facts.length, 1);

  const [pending] = await harness.store.listUnpublishedFacts();
  assert.ok(pending);
  assert.equal(pending.factId, publisher.facts[0]?.factId);
  assert.equal(pending.sourceRequestId, "activity-create");
  assert.equal(pending.origin, "interactive");
  assert.equal(pending.sourceSemanticDigest, result.head.semanticDigest);

  // An exact request replay does not create or publish a second transaction.
  assert.deepEqual(await harness.document.command(clone(create)), result);
  assert.equal(publisher.facts.length, 1);

  assert.equal(await harness.document.publishPendingActivity(), 1);
  assert.equal(publisher.facts.length, 2);
  assert.deepEqual(publisher.facts[1], pending);
  assert.deepEqual(await harness.store.listUnpublishedFacts(), []);

  harness.store.close();
});

test("a capacity-rejected internal intent is redriven in-process", async () => {
  const jobs = new CapacityOnceJobs();
  const harness = createHarness({ jobs });
  const documentId = "document-dispatch-redrive";
  await harness.document.command(command("create-dispatch-redrive", {
    type: "document.create",
    documentId,
    title: "Dispatch redrive"
  }));

  const requested = await harness.document.command(command("request-dispatch-redrive", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
  const documentId = "document-compaction-redrive";
  await harness.document.command(command("create-compaction-redrive", {
    type: "document.create",
    documentId,
    title: "Compaction redrive"
  }));
  await harness.document.command(command("change-compaction-redrive", {
    type: "document.submit",
    documentId,
    expectedRevision: 0,
    operations: [{ type: "document.rename", title: "Changed" }]
  }));

  await waitUntil(() => jobs.intents.length === 1);
  assert.equal(jobs.dispatchAttempts, 2);
  assert.deepEqual(jobs.intents[0], {
    type: "document.compact",
    documentId,
    idempotencyKey: `document:compact:${documentId}:1`
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
  const documentId = "document-retention-compaction";
  await harness.document.command(command("create-retention-compaction", {
    type: "document.create",
    documentId,
    title: "Revision 0"
  }));
  for (let revision = 1; revision <= 8; revision += 1) {
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
  assert.equal(compactIntents[0]?.idempotencyKey, `document:compact:${documentId}:3`);

  assert.equal(await harness.document.compact(documentId), true);
  assert.equal((await harness.store.getHead(documentId))?.baseSeq, 8);
  assert.equal((await harness.store.getBaseAtOrBefore(documentId, 5))?.baseSeq, 5);
  assert.equal((await harness.store.getBaseAtOrBefore(documentId, 8))?.baseSeq, 8);

  for (let revision = 5; revision <= 8; revision += 1) {
    const historical = await load(harness.document, documentId, revision);
    assert.equal(historical.snapshot.revision, revision);
    assert.equal(historical.snapshot.title, `Revision ${revision}`);
  }
  await assert.rejects(
    load(harness.document, documentId, 4),
    (error: unknown) =>
      error instanceof HistoryPrunedError && error.revision === 4
  );
  const history = await harness.document.query({
    requestId: "retained-history-query",
    query: { type: "document.history", documentId, limit: 20 }
  });
  assert.equal(history.type, "document.history");
  if (history.type === "document.history") {
    assert.deepEqual(
      history.items.map((changeSet) => changeSet.revision),
      [8, 7, 6]
    );
  }

  const dispatchCount = harness.jobs.intents.length;
  await harness.document.command(command("retention-change-9", {
    type: "document.submit",
    documentId,
    expectedRevision: 8,
    operations: [{ type: "document.rename", title: "Revision 9" }]
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
  const documentId = "document-pruned-compensation";
  await harness.document.command(command("create-pruned-compensation", {
    type: "document.create",
    documentId,
    title: "Original"
  }));
  const renamed = requireChanged(await harness.document.command(command(
    "rename-before-pruned-compensation",
    {
      type: "document.submit",
      documentId,
      expectedRevision: 0,
      operations: [{ type: "document.rename", title: "Changed" }]
    }
  )));
  await harness.document.command(command("initial-compensation", {
    type: "document.compensate",
    documentId,
    targetChangeSetId: renamed.changeSet.id,
    intent: "undo",
    expectedRevision: 1
  }));
  for (let revision = 3; revision <= 5; revision += 1) {
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
    1,
    "a referenced compensation target remains addressable after pruning"
  );
  assert.deepEqual(
    (await harness.store.getChangeSets(documentId, 1, 5)).map((changeSet) => changeSet.revision),
    [5],
    "the target no longer has a complete intervening history"
  );

  await assert.rejects(
    harness.document.command(command("compensation-after-pruning", {
      type: "document.compensate",
      documentId,
      targetChangeSetId: renamed.changeSet.id,
      intent: "undo",
      expectedRevision: 5
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

test("commands cannot reuse tombstoned identities while exact compensation restores them", async () => {
  const harness = createHarness();
  const documentId = "document-identity-ledger";
  await harness.document.command(command("create-identity-ledger", {
    type: "document.create",
    documentId,
    title: "Identity ledger"
  }));

  const originalBlock = contentBlock("identity-block", "Original");
  await harness.document.command(command("insert-identities", {
    type: "document.submit",
    documentId,
    expectedRevision: 0,
    operations: [rowInsert("identity-row", originalBlock)]
  }));

  const deleted = requireChanged(await harness.document.command(command(
    "delete-identities",
    {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
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
      firstRevision: 1,
      lastTransitionRevision: 2,
      tombstonedRevision: 2
    }
  );

  await assert.rejects(
    harness.document.command(command("reuse-identities", {
      type: "document.submit",
      documentId,
      expectedRevision: 2,
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
  assert.equal((await harness.store.getHead(documentId))?.revision, 2);
  assert.equal((await load(harness.document, documentId)).snapshot.rows.length, 0);

  await assert.rejects(
    harness.document.command(command("reuse-cross-kind", {
      type: "document.submit",
      documentId,
      expectedRevision: 2,
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
  assert.equal((await harness.store.getHead(documentId))?.revision, 2);

  const restored = requireChanged(await harness.document.command(command(
    "restore-identities",
    {
      type: "document.compensate",
      documentId,
      targetChangeSetId: deleted.changeSet.id,
      intent: "undo",
      expectedRevision: 2
    }
  )));
  assert.equal(restored.changeSet.revision, 3);
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
    3
  );

  harness.store.close();
});

test("submit, historical load, disjoint stale rebase, conflict, undo, and redo compose through SQLite history", async () => {
  const harness = createHarness();
  const documentId = "document-history";
  await harness.document.command(command("create-history", {
    type: "document.create",
    documentId,
    title: "History"
  }));

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
      expectedRevision: 0,
      operations: [rowInsert("forged-row", nestedPrompt)]
    })),
    (error: unknown) =>
      error instanceof DocumentOperationError && /Prompt Blocks must be created/.test(error.message)
  );

  const initial = requireChanged(await harness.document.command(command("insert-rows", {
    type: "document.submit",
    documentId,
    expectedRevision: 0,
    operations: [
      rowInsert("row-a", contentBlock("block-a", "A")),
      rowInsert("row-b", contentBlock("block-b", "B"), "row-a")
    ]
  })));
  assert.equal(initial.changeSet.revision, 1);

  const changeA = requireChanged(await harness.document.command(command("change-a", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [{
      type: "block.set-presentation",
      blockId: "block-a",
      presentation: { alignment: "center" }
    }]
  })));
  assert.equal(changeA.changeSet.revision, 2);

  const staleButDisjoint = requireChanged(await harness.document.command(command("change-b-stale", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [{
      type: "block.set-presentation",
      blockId: "block-b",
      presentation: { alignment: "right" }
    }]
  })));
  assert.equal(staleButDisjoint.changeSet.authoredRevision, 1);
  assert.equal(staleButDisjoint.changeSet.priorRevision, 2);
  assert.equal(staleButDisjoint.changeSet.revision, 3);

  await assert.rejects(
    harness.document.command(command("change-a-conflict", {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
      operations: [{
        type: "block.set-presentation",
        blockId: "block-a",
        presentation: { alignment: "left" }
      }]
    })),
    (error: unknown) =>
      error instanceof RevisionConflictError &&
      error.expected === 1 &&
      error.actual === 3
  );

  const beforeUndo = await load(harness.document, documentId);
  assert.equal(blockById(beforeUndo.snapshot, "block-a")?.presentation?.alignment, "center");
  assert.equal(blockById(beforeUndo.snapshot, "block-b")?.presentation?.alignment, "right");
  const historical = await load(harness.document, documentId, 1);
  assert.equal(historical.snapshot.revision, 1);
  assert.equal(blockById(historical.snapshot, "block-a")?.presentation, undefined);
  assert.equal(blockById(historical.snapshot, "block-b")?.presentation, undefined);

  const undoRequest = command("undo-a", {
    type: "document.compensate",
    documentId,
    targetChangeSetId: changeA.changeSet.id,
    intent: "undo",
    expectedRevision: 3
  });
  const undo = requireChanged(await harness.document.command(undoRequest));
  assert.equal(undo.changeSet.revision, 4);
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
    expectedRevision: 4
  })));
  assert.equal(redo.changeSet.revision, 5);
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
    assert.deepEqual(history.items.map((changeSet) => changeSet.revision), [5, 4, 3, 2, 1]);
  }

  harness.store.close();
});

test("Prompt creation gives every Block a dedicated output, refresh adopts an exact revision, and deletion detaches ownership", async () => {
  const harness = createHarness();
  const documentId = "document-prompts";
  await harness.document.command(command("create-prompts", {
    type: "document.create",
    documentId,
    title: "Prompts"
  }));

  const requestFirst = command("prompt-one-request", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
      expectedRevision: 0,
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
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 1);

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
    expectedRevision: 1,
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
  assert.equal(beforeRefresh.snapshot.revision, 2);
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
    expectedRevision: 2
  }));
  assert.equal(refreshRequested.type, "prompt.refresh-requested");
  if (refreshRequested.type !== "prompt.refresh-requested") return;
  await harness.document.computePromptRefresh(refreshRequested.attemptId);
  await harness.document.settlePromptRefresh(refreshRequested.attemptId);

  const afterRefresh = await load(harness.document, documentId);
  assert.equal(afterRefresh.snapshot.revision, 3);
  assert.equal(
    (blockById(afterRefresh.snapshot, "prompt-block-1") as { output?: { appliedRevision?: number } })
      .output?.appliedRevision,
    2
  );
  assert.equal((await harness.store.getAttemptById(refreshRequested.attemptId))?.state, "settled");

  requireChanged(await harness.document.command(command("delete-prompt-one", {
    type: "document.submit",
    documentId,
    expectedRevision: 3,
    operations: [{ type: "block.delete", blockId: "prompt-block-1" }]
  })));
  const detached = await harness.store.getPromptOutputOwnership(firstOutputId);
  assert.equal(detached?.state, "detached");
  assert.equal(detached?.detachedRevision, 4);
  assert.equal((await harness.store.getPromptOutputOwnership(secondOutputId))?.state, "attached");

  harness.store.close();
});

test("Prompt definition delegation recovers exact work after a local completion crash", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-document-delegated-crash-"));
  const dbPath = join(directory, "documents.db");
  const derivedOutputs = new FakeDerivedOutputs();
  const first = createHarness({
    dbPath,
    derivedOutputs,
    storeFactory: (path) => new FailOnceDelegatedCompletionStore(
      "application-test-project",
      path
    )
  });
  const documentId = "document-definition-crash";
  await first.document.command(command("create-definition-crash", {
    type: "document.create",
    documentId,
    title: "Definition crash"
  }));
  const creation = await first.document.command(command("create-crash-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
    /Simulated crash before delegated-command completion/
  );
  assert.equal(derivedOutputs.outputs.get(outputId)?.definition.definitionRevision, 2);
  assert.equal(derivedOutputs.definitionUpdates.size, 1);
  assert.equal(
    await first.store.getSubmission(documentId, updateRequest.requestId),
    undefined
  );
  const pendingClaim = await first.store.getDelegatedCommandClaim(
    documentId,
    updateRequest.requestId
  );
  assert.equal(pendingClaim?.documentId, documentId);
  assert.equal(pendingClaim?.requestId, updateRequest.requestId);
  assert.equal(pendingClaim?.kind, "prompt.update-definition");
  assert.equal(pendingClaim?.targetOutputId, outputId);
  assert.equal(pendingClaim?.state, "pending");
  assert.ok(Number.isFinite(Date.parse(pendingClaim?.createdAt ?? "")));
  assert.equal(pendingClaim?.updatedAt, pendingClaim?.createdAt);
  first.store.close();

  const resumed = createHarness({ dbPath, derivedOutputs });
  await assert.rejects(
    resumed.document.command(command(updateRequest.requestId, {
      type: "document.submit",
      documentId,
      expectedRevision: 1,
      operations: [{ type: "document.rename", title: "Must not commit" }]
    })),
    (error: unknown) => error instanceof IdempotencyMismatchError
  );
  assert.equal((await load(resumed.document, documentId)).snapshot.title, "Definition crash");

  requireChanged(await resumed.document.command(command("delete-before-exact-retry", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
    operations: [{ type: "block.delete", blockId: "crash-prompt-block" }]
  })));
  assert.equal(blockById((await load(resumed.document, documentId)).snapshot, "crash-prompt-block"), undefined);

  const recovered = await resumed.document.command(clone(updateRequest));
  assert.equal(recovered.type, "prompt.definition-updated");
  if (recovered.type !== "prompt.definition-updated") return;
  assert.equal(recovered.output.id, outputId);
  assert.equal(recovered.output.definition.definitionRevision, 2);
  assert.equal(derivedOutputs.definitionUpdates.size, 1);
  assert.deepEqual(await resumed.document.command(clone(updateRequest)), recovered);
  assert.equal(
    (await resumed.store.getDelegatedCommandClaim(
      documentId,
      updateRequest.requestId
    ))?.state,
    "completed"
  );
  assert.deepEqual(
    (await resumed.store.getSubmission(documentId, updateRequest.requestId))?.result,
    recovered
  );

  resumed.store.close();
});

test("a transient Prompt creation exception retries without abandoning its dedicated output", async () => {
  const harness = createHarness();
  const documentId = "document-transient-prompt";
  await harness.document.command(command("create-transient-prompt-document", {
    type: "document.create",
    documentId,
    title: "Transient Prompt"
  }));
  const requested = await harness.document.command(command("request-transient-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 1);

  harness.store.close();
});

test("failed initial Prompt refresh records a detached dedicated output", async () => {
  const harness = createHarness();
  const documentId = "document-failed-prompt";
  await harness.document.command(command("create-failed-prompt-document", {
    type: "document.create",
    documentId,
    title: "Failed Prompt"
  }));
  const requested = await harness.document.command(command("request-failed-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
  assert.equal((await load(harness.document, documentId)).snapshot.revision, 0);

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
  const documentId = "document-prompt-settle-recovery";
  const blockId = "identity-conflicted-prompt-block";
  await first.document.command(command("create-prompt-settle-recovery", {
    type: "document.create",
    documentId,
    title: "Prompt settlement recovery"
  }));
  const requested = await first.document.command(command("request-conflicted-prompt", {
    type: "prompt.create.request",
    documentId,
    expectedRevision: 0,
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
    expectedRevision: 0,
    operations: [rowInsert("temporary-identity-row", contentBlock(blockId, "Temporary"))]
  })));
  requireChanged(await first.document.command(command("tombstone-conflicted-identity", {
    type: "document.submit",
    documentId,
    expectedRevision: 1,
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
