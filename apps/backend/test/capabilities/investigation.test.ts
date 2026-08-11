import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import type { Knowledge } from "../../src/capabilities/knowledge/knowledge.js";
import type { KnowledgeScopeManifest } from "../../src/capabilities/knowledge/types.js";
import { createApp } from "../../src/initialization/runtimes/app.js";
import { createResourceReader } from "../../src/initialization/runtimes/resource-reader.js";
import { JobRegistry } from "../../src/workflows/registry.js";
import { JobScheduler } from "../../src/workflows/scheduler.js";
import { registerHttpTransport } from "../../src/api/registerHttpTransport.js";
import type { ContextManager } from "../../src/capabilities/context/context.js";
import {
  FINDING_RELATIONSHIPS,
  HYPOTHESIS_CONFIDENCE_LEVELS,
  HYPOTHESIS_STATUSES,
  InvestigationError,
  SQLiteInvestigationStore,
  createInvestigationRuntime,
  findingNeedsReview,
} from "../../src/capabilities/investigation/index.js";
import { registerInvestigationEndpoints } from "../../src/api/routes/investigation/registerInvestigationEndpoints.js";
import { CapturingLogger, ZERO_USAGE } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/shared/persistence/resourceHistory.js";

type KnowledgeItem = Parameters<Knowledge["add"]>[0];

class FakeKnowledge {
  readonly addCalls: KnowledgeItem[] = [];
  readonly removeCalls: string[] = [];
  readonly active = new Map<string, KnowledgeItem>();

  constructor(
    private readonly beforeAdd?: (
      item: KnowledgeItem,
      callIndex: number,
    ) => Promise<void>,
  ) {}

  async add(item: KnowledgeItem): Promise<Awaited<ReturnType<Knowledge["add"]>>> {
    const call = { ...item };
    const callIndex = this.addCalls.push(call) - 1;
    await this.beforeAdd?.(call, callIndex);
    const prior = this.active.get(item.sourceId);
    const skipped = prior?.revision === item.revision;
    this.active.set(item.sourceId, call);
    return {
      sourceId: item.sourceId,
      skipped,
      windowsAdded: skipped ? 0 : 1,
      windowsReused: 0,
      usage: ZERO_USAGE,
    };
  }

  async remove(sourceId: string): Promise<void> {
    this.removeCalls.push(sourceId);
    this.active.delete(sourceId);
  }

  asKnowledge(): Knowledge {
    return this as unknown as Knowledge;
  }
}

const createHarness = (knowledge = new FakeKnowledge()) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-investigation-"));
  const dbPath = join(directory, "investigation.db");
  const store = new SQLiteInvestigationStore("project-for-investigation-tests", dbPath);
  const logger = new CapturingLogger();
  let idSequence = 0;
  let timeSequence = 0;
  const runtime = createInvestigationRuntime(
    store,
    knowledge.asKnowledge(),
    logger,
    {
      actorId: "test-actor",
      generateId: () => `investigation-${++idSequence}`,
      now: () =>
        new Date(Date.UTC(2026, 0, 1, 0, 0, timeSequence++)).toISOString(),
    },
  );
  return {
    directory,
    dbPath,
    knowledge,
    logger,
    runtime,
    store,
    close: () => {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

const urlReference = (overrides: Record<string, unknown> = {}) => ({
  kind: "url" as const,
  href: "https://example.test/research",
  observedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const request = (
  method: string,
  path: string,
  options: { body?: unknown; query?: Record<string, unknown> } = {},
) => ({
  requestId: `request:${method}:${path}`,
  method,
  path,
  params: {},
  query: options.query ?? {},
  headers: {},
  body: options.body,
});

test("one SQLite store constructor creates current tables and one shared history table", (t) => {
  const harness = createHarness();
  t.after(harness.close);

  const inspection = new Database(harness.dbPath, { readonly: true });
  t.after(() => inspection.close());
  const tableNames = (
    inspection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'inv_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);

  assert.equal(tableNames.length, 4);
  assert.deepEqual(
    tableNames.map((name) => name.replace(/^inv_[a-f0-9]{16}_/, "")),
    ["findings", "history", "hypotheses", "questions"],
  );
  assert.ok(tableNames.every((name) => /^inv_[a-f0-9]{16}_/.test(name)));
});

test("Questions archive every prior revision, disappear on logical delete, and can be purged", async (t) => {
  const { runtime, close, dbPath } = createHarness();
  t.after(close);

  const question = await runtime.createQuestion({
    text: "  Which market should we enter?  ",
    context: "Original framing",
    assumptions: ["Demand remains stable"],
    tags: [" strategy ", "strategy", "market"],
  });
  const other = await runtime.createQuestion({
    text: "What should be deferred?",
    tags: ["later"],
  });

  assert.equal(question.text, "Which market should we enter?");
  assert.deepEqual(question.tags, ["strategy", "market"]);
  assert.equal(question.status, "open");
  assert.equal(question.revision, 1);
  assert.equal(question.createdBy, "test-actor");

  const updated = await runtime.updateQuestion(question.id, {
    text: "Which segment should we enter?",
    context: null,
    assumptions: ["Budget is approved", "A launch is feasible"],
    tags: ["market"],
  });
  assert.equal(updated.text, "Which segment should we enter?");
  assert.equal(updated.context, undefined);
  assert.deepEqual(updated.assumptions, ["Budget is approved", "A launch is feasible"]);
  assert.equal(updated.revision, 2);
  assert.deepEqual((await runtime.listQuestions({ tag: "market" })).map(({ id }) => id), [
    question.id,
  ]);

  const proposed = await runtime.proposeQuestionAnswer(
    question.id,
    "  Start with the enterprise segment.  ",
  );
  assert.equal(proposed.currentAnswer, "Start with the enterprise segment.");
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.revision, 3);
  assert.deepEqual((await runtime.listQuestions({ status: "proposed" })).map(({ id }) => id), [
    question.id,
  ]);

  const answered = await runtime.confirmQuestionAnswer(question.id);
  assert.equal(answered.status, "answered");
  assert.equal(answered.revision, 4);
  assert.equal((await runtime.confirmQuestionAnswer(question.id)).status, "answered");
  const cleared = await runtime.clearQuestionAnswer(question.id);
  assert.equal(cleared.status, "open");
  assert.equal(cleared.revision, 5);
  assert.equal(cleared.currentAnswer, undefined);

  await assert.rejects(() => runtime.purgeQuestion(question.id), ResourceNotDeletedError);
  await runtime.deleteQuestion(question.id);
  assert.equal(await runtime.getQuestion(question.id), null);
  assert.deepEqual((await runtime.listQuestions()).map(({ id }) => id), [other.id]);

  const inspection = new Database(dbPath, { readonly: true });
  const historyTable = (inspection.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'inv_%_history'"
  ).get() as { name: string }).name;
  const history = inspection.prepare(
    `SELECT revision, record_type FROM ${historyTable}
     WHERE resource_kind = 'question' AND resource_id = ? ORDER BY revision`
  ).all(question.id) as Array<{ revision: number; record_type: string }>;
  inspection.close();
  assert.deepEqual(history, [
    { revision: 1, record_type: "snapshot" },
    { revision: 2, record_type: "snapshot" },
    { revision: 3, record_type: "snapshot" },
    { revision: 4, record_type: "snapshot" },
    { revision: 5, record_type: "snapshot" },
    { revision: 6, record_type: "deleted" }
  ]);

  await runtime.purgeQuestion(question.id);
  await assert.rejects(() => runtime.purgeQuestion(question.id), ResourceHistoryNotFoundError);
});

test("Hypotheses allow zero or many Questions and filter only through live targets", async (t) => {
  const { runtime, close } = createHarness();
  t.after(close);

  assert.deepEqual(HYPOTHESIS_STATUSES, [
    "proposed",
    "accepted",
    "refuted",
    "inconclusive",
  ]);
  assert.deepEqual(HYPOTHESIS_CONFIDENCE_LEVELS, [
    "strongly_refuted",
    "weakly_refuted",
    "uncertain",
    "weakly_supported",
    "strongly_supported",
  ]);

  const unlinked = await runtime.createHypothesis({ statement: "A standalone explanation" });
  assert.deepEqual(unlinked.questionIds, []);
  assert.equal(unlinked.status, "proposed");

  const firstQuestion = await runtime.createQuestion({ text: "First question" });
  const secondQuestion = await runtime.createQuestion({ text: "Second question" });
  const hypothesis = await runtime.createHypothesis({
    statement: "  One explanation connects both questions.  ",
    questionIds: [firstQuestion.id, secondQuestion.id, firstQuestion.id],
    rationale: "Initial rationale",
    assumptions: ["The samples are comparable"],
    confidenceLevel: "uncertain",
  });

  assert.equal(hypothesis.statement, "One explanation connects both questions.");
  assert.deepEqual(hypothesis.questionIds, [firstQuestion.id, secondQuestion.id]);
  assert.deepEqual(
    (await runtime.listHypotheses({ questionId: firstQuestion.id })).map(({ id }) => id),
    [hypothesis.id],
  );

  const updated = await runtime.updateHypothesis(hypothesis.id, {
    rationale: null,
    status: "accepted",
    confidenceLevel: "strongly_supported",
    assumptions: ["A confounder has been ruled out"],
  });
  assert.equal(updated.rationale, undefined);
  assert.equal(updated.status, "accepted");
  assert.equal(updated.confidenceLevel, "strongly_supported");
  assert.deepEqual(
    (await runtime.listHypotheses({ status: "accepted" })).map(({ id }) => id),
    [hypothesis.id],
  );

  await runtime.deleteQuestion(firstQuestion.id);
  assert.deepEqual(await runtime.listHypotheses({ questionId: firstQuestion.id }), []);
  assert.deepEqual(
    (await runtime.listHypotheses({ questionId: secondQuestion.id })).map(({ id }) => id),
    [hypothesis.id],
  );

  await runtime.deleteHypothesis(hypothesis.id);
  assert.equal(await runtime.getHypothesis(hypothesis.id), null);
  assert.deepEqual((await runtime.listHypotheses()).map(({ id }) => id), [unlinked.id]);
  await runtime.purgeHypothesis(hypothesis.id);
  await assert.rejects(
    () => runtime.purgeHypothesis(hypothesis.id),
    ResourceHistoryNotFoundError
  );
});

test("Findings persist lightweight references, exact relationship vocabulary, review state, and derived reverse views", async (t) => {
  const { runtime, close } = createHarness();
  t.after(close);

  assert.deepEqual(FINDING_RELATIONSHIPS, [
    "supports",
    "refutes",
    "qualifies",
    "contextualizes",
  ]);

  const questions = await Promise.all([
    runtime.createQuestion({ text: "Question one" }),
    runtime.createQuestion({ text: "Question two" }),
    runtime.createQuestion({ text: "Question three" }),
  ]);
  const hypotheses = await Promise.all([
    runtime.createHypothesis({ statement: "Hypothesis one" }),
    runtime.createHypothesis({ statement: "Hypothesis two" }),
  ]);
  const finding = await runtime.proposeFinding({
    claim: "A traceable finding",
    references: [
      urlReference({ span: { kind: "characters", start: 4, end: 12 } }),
      {
        kind: "resource",
        resourceKind: "document",
        resourceId: "document-7",
        resourceRevision: 3,
        locator: "section:results",
        span: { kind: "lines", startLine: 10, endLine: 14 },
        note: "Check the sample definition",
        needsReview: true,
      },
      {
        kind: "resource",
        resourceKind: "connector::directory::text",
        resourceId: "connector-item-2",
        resourceRevision: "provider-revision-token",
      },
    ],
    questionLinks: [
      { questionId: questions[0].id, relationship: "supports" },
      { questionId: questions[1].id, relationship: "qualifies" },
      { questionId: questions[2].id, relationship: "contextualizes" },
      { questionId: questions[0].id, relationship: "supports" },
    ],
    hypothesisLinks: [
      { hypothesisId: hypotheses[0].id, relationship: "refutes" },
      { hypothesisId: hypotheses[0].id, relationship: "refutes" },
      { hypothesisId: hypotheses[1].id },
    ],
  });

  assert.equal(finding.questionLinks.length, 3);
  assert.equal(finding.hypothesisLinks.length, 2);
  assert.equal(findingNeedsReview(finding), true);
  assert.equal((finding.references[1] as { resourceRevision?: number }).resourceRevision, 3);
  assert.equal(
    (finding.references[2] as { resourceRevision?: string }).resourceRevision,
    "provider-revision-token",
  );
  assert.deepEqual(
    (await runtime.listFindings({ questionId: questions[0].id })).map(({ id }) => id),
    [finding.id],
  );
  assert.deepEqual(
    (await runtime.listFindings({ hypothesisId: hypotheses[0].id })).map(({ id }) => id),
    [finding.id],
  );

  const cleared = await runtime.clearFindingReferenceReview(finding.id, 1);
  assert.equal(findingNeedsReview(cleared), false);
  const marked = await runtime.markFindingReferenceForReview(finding.id, 0);
  assert.equal(findingNeedsReview(marked), true);

  await runtime.deleteQuestion(questions[0].id);
  assert.deepEqual(await runtime.listFindings({ questionId: questions[0].id }), []);
  assert.equal((await runtime.getFinding(finding.id))?.questionLinks.length, 3);

  await runtime.deleteHypothesis(hypotheses[0].id);
  assert.deepEqual(await runtime.listFindings({ hypothesisId: hypotheses[0].id }), []);
  assert.equal((await runtime.getFinding(finding.id))?.hypothesisLinks.length, 2);
});

test("runtime validation rejects unsupported states and malformed domain input", async (t) => {
  const { runtime, close } = createHarness();
  t.after(close);

  await assert.rejects(
    runtime.createQuestion({ text: "   " }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  const question = await runtime.createQuestion({ text: "A valid question" });
  await assert.rejects(
    runtime.confirmQuestionAnswer(question.id),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_operation",
  );
  await assert.rejects(
    runtime.listQuestions({ status: "closed" as never }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  await assert.rejects(
    runtime.createHypothesis({
      statement: "Invalid confidence",
      confidenceLevel: "certain" as never,
    }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  await assert.rejects(
    runtime.proposeFinding({ claim: "No evidence", references: [] }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  await assert.rejects(
    runtime.proposeFinding({
      claim: "Bad URL",
      references: [urlReference({ href: "file:///private/research" })],
    }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  await assert.rejects(
    runtime.proposeFinding({
      claim: "Missing owner revision",
      references: [
        { kind: "resource", resourceKind: "document", resourceId: "document-1" },
      ],
    }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  await assert.rejects(
    runtime.proposeFinding({
      claim: "Bad relationship",
      references: [urlReference()],
      questionLinks: [{ questionId: question.id, relationship: "mentions" as never }],
    }),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
  const finding = await runtime.proposeFinding({
    claim: "Valid finding",
    references: [urlReference()],
  });
  await assert.rejects(
    runtime.markFindingReferenceForReview(finding.id, 1),
    (error: unknown) => error instanceof InvestigationError && error.code === "invalid_input",
  );
});

test("Finding acceptance is idempotent, uses one stable Knowledge source, and refreshes only changed claims", async (t) => {
  const harness = createHarness();
  t.after(harness.close);
  const { knowledge, runtime } = harness;

  const finding = await runtime.proposeFinding({
    claim: "Revenue increased in the observed period",
    references: [urlReference()],
    tags: ["finance"],
  });
  const accepted = await runtime.acceptFinding(finding.id);
  const acceptedAgain = await runtime.acceptFinding(finding.id);

  assert.equal(accepted.status, "accepted");
  assert.equal(acceptedAgain.status, "accepted");
  assert.equal(accepted.knowledgeSourceId, `finding:${finding.id}`);
  assert.equal(acceptedAgain.knowledgeSourceId, accepted.knowledgeSourceId);
  assert.equal(knowledge.active.size, 1);
  assert.equal(knowledge.active.get(`finding:${finding.id}`)?.text, finding.claim);
  assert.deepEqual(new Set(knowledge.addCalls.map(({ sourceId }) => sourceId)), new Set([
    `finding:${finding.id}`,
  ]));
  assert.equal(new Set(knowledge.addCalls.map(({ revision }) => revision)).size, 1);

  const callsBeforeMetadataUpdate = knowledge.addCalls.length;
  await runtime.updateFinding(finding.id, { tags: ["finance", "reviewed"] });
  assert.equal(
    knowledge.addCalls.length,
    callsBeforeMetadataUpdate,
    "metadata-only edits must not ask Knowledge to re-index an unchanged claim",
  );

  const oldRevision = knowledge.active.get(`finding:${finding.id}`)?.revision;
  await runtime.updateFinding(finding.id, {
    claim: "Revenue increased after excluding the anomalous period",
  });
  assert.equal(
    knowledge.active.get(`finding:${finding.id}`)?.text,
    "Revenue increased after excluding the anomalous period",
  );
  assert.notEqual(knowledge.active.get(`finding:${finding.id}`)?.revision, oldRevision);

  const unaccepted = await runtime.unacceptFinding(finding.id);
  assert.equal(unaccepted.status, "proposed");
  assert.equal(unaccepted.knowledgeSourceId, undefined);
  assert.ok(knowledge.removeCalls.includes(`finding:${finding.id}`));
  assert.equal(knowledge.active.has(`finding:${finding.id}`), false);

  await runtime.acceptFinding(finding.id);
  const rejected = await runtime.rejectFinding(finding.id);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.knowledgeSourceId, undefined);
  assert.equal(knowledge.active.has(`finding:${finding.id}`), false);

  const deletable = await runtime.proposeFinding({
    claim: "A separately deletable accepted claim",
    references: [urlReference()],
  });
  await runtime.acceptFinding(deletable.id);
  await runtime.deleteFinding(deletable.id);
  assert.equal(await runtime.getFinding(deletable.id), null);
  assert.ok(knowledge.removeCalls.includes(`finding:${deletable.id}`));
  assert.equal(knowledge.active.has(`finding:${deletable.id}`), false);
  await runtime.purgeFinding(deletable.id);
  await assert.rejects(
    () => runtime.purgeFinding(deletable.id),
    ResourceHistoryNotFoundError
  );
});

test("an edit that wins while acceptance ingests is the claim ultimately accepted", async (t) => {
  let releaseFirstAdd!: () => void;
  let signalFirstAdd!: () => void;
  const firstAddStarted = new Promise<void>((resolve) => {
    signalFirstAdd = resolve;
  });
  const firstAddReleased = new Promise<void>((resolve) => {
    releaseFirstAdd = resolve;
  });
  const knowledge = new FakeKnowledge(async (_item, callIndex) => {
    if (callIndex !== 0) return;
    signalFirstAdd();
    await firstAddReleased;
  });
  const harness = createHarness(knowledge);
  t.after(harness.close);

  const finding = await harness.runtime.proposeFinding({
    claim: "Initial claim",
    references: [urlReference()],
  });
  const acceptance = harness.runtime.acceptFinding(finding.id);
  await firstAddStarted;
  await harness.runtime.updateFinding(finding.id, { claim: "Edited claim" });
  releaseFirstAdd();
  const accepted = await acceptance;

  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.claim, "Edited claim");
  assert.equal(knowledge.active.get(`finding:${finding.id}`)?.text, "Edited claim");
  assert.ok(knowledge.addCalls.some(({ text }) => text === "Initial claim"));
  assert.ok(knowledge.addCalls.some(({ text }) => text === "Edited claim"));
});

test("Investigation logs carry operational metadata without authored content", async (t) => {
  const harness = createHarness();
  t.after(harness.close);
  const secret = {
    question: "PRIVATE_QUESTION_TEXT",
    context: "PRIVATE_CONTEXT_TEXT",
    answer: "PRIVATE_CURRENT_ANSWER",
    hypothesis: "PRIVATE_HYPOTHESIS_STATEMENT",
    rationale: "PRIVATE_RATIONALE",
    claim: "PRIVATE_FINDING_CLAIM",
    url: "https://example.test/PRIVATE_URL_PATH",
    note: "PRIVATE_REFERENCE_NOTE",
  };

  const question = await harness.runtime.createQuestion({
    text: secret.question,
    context: secret.context,
    assumptions: ["PRIVATE_QUESTION_ASSUMPTION"],
  });
  await harness.runtime.proposeQuestionAnswer(question.id, secret.answer);
  await harness.runtime.createHypothesis({
    statement: secret.hypothesis,
    rationale: secret.rationale,
    assumptions: ["PRIVATE_HYPOTHESIS_ASSUMPTION"],
  });
  const finding = await harness.runtime.proposeFinding({
    claim: secret.claim,
    commentary: "PRIVATE_FINDING_COMMENTARY",
    references: [urlReference({ href: secret.url, note: secret.note })],
  });
  await harness.runtime.acceptFinding(finding.id);

  const encodedLogs = JSON.stringify(harness.logger.entries);
  for (const protectedValue of [
    ...Object.values(secret),
    "PRIVATE_QUESTION_ASSUMPTION",
    "PRIVATE_HYPOTHESIS_ASSUMPTION",
    "PRIVATE_FINDING_COMMENTARY",
  ]) {
    assert.equal(encodedLogs.includes(protectedValue), false, protectedValue);
  }
  assert.ok(
    harness.logger.entries.some(({ message }) => message === "investigation.findings.accepted"),
  );
});

test("the resource registry resolves and reads only live accepted Findings", async (t) => {
  const harness = createHarness();
  t.after(harness.close);
  const contexts = {
    resolve: async (entries: Array<{ id: string; kind: string }>) => entries,
  } as unknown as ContextManager;
  const registry = createResourceReader(contexts, harness.logger);
  registry.registerInvestigation(harness.runtime);

  const finding = await harness.runtime.proposeFinding({
    claim: "First line\nSecond line",
    references: [urlReference()],
  });
  assert.deepEqual(await registry.resolve([{ id: finding.id, kind: "finding" }]), []);

  const accepted = await harness.runtime.acceptFinding(finding.id);
  assert.deepEqual(await registry.resolve([{ id: finding.id, kind: "finding" }]), [
    { id: `finding:${finding.id}`, kind: "document" },
  ]);
  const descriptor = await registry.describeSource(`finding:${finding.id}`);
  assert.deepEqual(descriptor, {
    sourceId: `finding:${finding.id}`,
    resourceId: finding.id,
    resourceKind: "finding",
  });
  assert.equal(accepted.knowledgeSourceId, descriptor?.sourceId);

  const scope: KnowledgeScopeManifest = {
    inputEntries: [{ id: finding.id, kind: "finding" }],
    resolvedEntries: [{ id: `finding:${finding.id}`, kind: "document" }],
    resources: [descriptor!],
    resolvedSourceIds: [`finding:${finding.id}`],
    contextDigest: "test-context-digest",
    scopeDigest: "test-scope-digest",
    resolvedAt: "2026-01-01T00:00:00.000Z",
  };
  const content = await registry.read(finding.id, "finding", 2, 2, scope);
  assert.equal(content?.text, "Second line");
  assert.equal(content?.resourceKind, "finding");

  await harness.runtime.rejectFinding(finding.id);
  assert.deepEqual(await registry.resolve([{ id: finding.id, kind: "finding" }]), []);
  assert.equal(await registry.describeSource(`finding:${finding.id}`), null);
  assert.equal(await registry.read(finding.id, "finding", 1, 2, scope), null);
});

test("all Investigation endpoints are registered with intentional queue policies", async (t) => {
  const harness = createHarness();
  t.after(harness.close);
  const registry = new JobRegistry();
  registerInvestigationEndpoints(registry, harness.runtime, harness.logger);

  assert.equal(registry.listEndpoints().length, 26);
  const policies: Array<[string, string, "serial" | "concurrent"]> = [
    ["POST", "/questions/create", "serial"],
    ["POST", "/questions/update", "serial"],
    ["POST", "/questions/propose-answer", "serial"],
    ["POST", "/questions/confirm-answer", "serial"],
    ["POST", "/questions/clear-answer", "serial"],
    ["GET", "/questions/get", "concurrent"],
    ["GET", "/questions/list", "concurrent"],
    ["DELETE", "/questions/delete", "serial"],
    ["POST", "/questions/purge", "serial"],
    ["POST", "/hypotheses/create", "serial"],
    ["POST", "/hypotheses/update", "serial"],
    ["GET", "/hypotheses/get", "concurrent"],
    ["GET", "/hypotheses/list", "concurrent"],
    ["DELETE", "/hypotheses/delete", "serial"],
    ["POST", "/hypotheses/purge", "serial"],
    ["POST", "/findings/propose", "concurrent"],
    ["POST", "/findings/update", "serial"],
    ["POST", "/findings/accept", "concurrent"],
    ["POST", "/findings/unaccept", "serial"],
    ["POST", "/findings/reject", "serial"],
    ["POST", "/findings/mark-reference-review", "serial"],
    ["POST", "/findings/clear-reference-review", "serial"],
    ["GET", "/findings/get", "concurrent"],
    ["GET", "/findings/list", "concurrent"],
    ["DELETE", "/findings/delete", "serial"],
    ["POST", "/findings/purge", "serial"],
  ];
  for (const [method, path, queueType] of policies) {
    assert.equal(registry.createJob(request(method, path)).queueType, queueType, path);
  }

  const createJob = registry.createJob(
    request("POST", "/questions/create", {
      body: { text: "Question created through the endpoint" },
    }),
  );
  assert.equal(createJob.responseMode, "inline");
  if (createJob.responseMode !== "inline") return;
  const createResponse = await createJob.work();
  assert.equal(createResponse.statusCode, 201);
  const createdId = (createResponse.body as { id: string }).id;

  const getJob = registry.createJob(
    request("GET", "/questions/get", { query: { id: createdId } }),
  );
  if (getJob.responseMode !== "inline") return;
  assert.equal((await getJob.work()).statusCode, 200);

  const invalidJob = registry.createJob(
    request("POST", "/hypotheses/create", {
      body: { statement: "Hypothesis", confidenceLevel: "definitely" },
    }),
  );
  if (invalidJob.responseMode !== "inline") return;
  const invalidResponse = await invalidJob.work();
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal((invalidResponse.body as { error: string }).error, "invalid_input");
});

test("Investigation runs a linked create, list, and delete flow over a real HTTP listener", async (t) => {
  const harness = createHarness();
  const registry = new JobRegistry();
  registerInvestigationEndpoints(registry, harness.runtime, harness.logger);
  const app = createApp();
  registerHttpTransport(app, {
    registry,
    logger: harness.logger,
    scheduler: new JobScheduler(
      {
        concurrentWorkers: 2,
        serialQueueMaxSize: 16,
        concurrentQueueMaxSize: 16,
      },
      harness.logger,
    ),
  });
  t.after(async () => {
    await app.close();
    harness.close();
  });

  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, body: (await response.json()) as Record<string, unknown> };
  };

  const questionResult = await post("/questions/create", {
    text: "Which explanation best fits the observations?",
  });
  assert.equal(questionResult.response.status, 201);
  const questionId = questionResult.body.id as string;

  const hypothesisResult = await post("/hypotheses/create", {
    statement: "The observed change followed the intervention",
    questionIds: [questionId],
  });
  assert.equal(hypothesisResult.response.status, 201);
  const hypothesisId = hypothesisResult.body.id as string;

  const findingResult = await post("/findings/propose", {
    claim: "The measured value rose after the intervention",
    references: [urlReference()],
    questionLinks: [{ questionId, relationship: "supports" }],
    hypothesisLinks: [{ hypothesisId, relationship: "qualifies" }],
  });
  assert.equal(findingResult.response.status, 201);
  const findingId = findingResult.body.id as string;

  const listResponse = await fetch(
    `${baseUrl}/findings/list?questionId=${encodeURIComponent(questionId)}`,
  );
  assert.equal(listResponse.status, 200);
  const listed = (await listResponse.json()) as { records: Array<{ id: string }> };
  assert.deepEqual(listed.records.map(({ id }) => id), [findingId]);

  const deleteResponse = await fetch(
    `${baseUrl}/findings/delete?id=${encodeURIComponent(findingId)}`,
    { method: "DELETE" },
  );
  assert.equal(deleteResponse.status, 204);
  const afterDelete = await fetch(
    `${baseUrl}/findings/list?questionId=${encodeURIComponent(questionId)}`,
  );
  assert.deepEqual((await afterDelete.json()) as { records: unknown[] }, { records: [] });
});
