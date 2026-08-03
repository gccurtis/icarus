import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.ICARUS_SMOKE_BASE_URL ?? "http://127.0.0.1:4000";
const connectorLocator =
  process.env.ICARUS_SMOKE_CONNECTOR_LOCATOR ??
  fileURLToPath(new URL("../../../../flake.lock", import.meta.url));

const samples = [];

async function request(label, path, options, expectedStatus) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { "content-type": "application/json" } : {}),
      ...options?.headers
    }
  });
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  samples.push({ label, statusCode: response.status, durationMs });
  assert.equal(response.status, expectedStatus, `${label}: ${text}`);
  return body;
}

const json = (value) => JSON.stringify(value);

const health = await request("health", "/health", undefined, 200);
assert.equal(health.status, "ok");

await request("route-not-found", "/smoke/missing", undefined, 404);
await request("structured-list", "/structured-data", undefined, 200);

const declared = await request(
  "structured-declare",
  "/structured-data",
  {
    method: "POST",
    body: json({
      kind: "variable",
      displayName: "smokeRate",
      body: "SUM([40, 2])"
    })
  },
  201
);
assert.equal(declared.displayName, "smokeRate");

const evaluated = await request(
  "formula-evaluate",
  "/structured-data/evaluate",
  { method: "POST", body: json({ source: "smokeRate * 2" }) },
  200
);
assert.deepEqual(evaluated.value, {
  kind: "number",
  numerator: "84",
  denominator: "1"
});

const unresolved = await request(
  "formula-error",
  "/structured-data/evaluate",
  { method: "POST", body: json({ source: "missingSmokeName" }) },
  400
);
assert.equal(unresolved.error, "evaluation_error");

const uploaded = await request(
  "general-upload",
  "/general-files/upload",
  {
    method: "POST",
    body: json({ fileName: "README", content: "smoke file version one" })
  },
  200
);
assert.equal(uploaded.file.extension, "");

const updated = await request(
  "general-update",
  "/general-files/update",
  {
    method: "POST",
    body: json({ id: uploaded.file.id, content: "smoke file version two" })
  },
  200
);
assert.notEqual(updated.file.id, uploaded.file.id);

const fetchedFile = await request(
  "general-get",
  "/general-files/get",
  { method: "POST", body: json({ id: updated.file.id }) },
  200
);
assert.equal(fetchedFile.content, "smoke file version two");
await request(
  "general-list",
  "/general-files/list",
  { method: "POST", body: json({}) },
  200
);
await request(
  "general-delete",
  "/general-files/delete",
  { method: "POST", body: json({ id: updated.file.id }) },
  200
);

const registered = await request(
  "connector-register",
  "/connector/register",
  {
    method: "POST",
    body: json({
      providerKind: "filesystem",
      locator: connectorLocator,
      syncInterval: "5min"
    })
  },
  200
);
assert.equal(registered.entry.syncConfig.interval, "5min");
assert.equal(registered.entry.kind, "connector::file::other");

const connectorId = registered.entry.id;
const connectorContent = await request(
  "connector-read",
  "/connector/read-all",
  { method: "POST", body: json({ id: connectorId }) },
  200
);
assert.ok(connectorContent.text.length > 0);
await request(
  "connector-refresh",
  "/connector/refresh",
  { method: "POST", body: json({ id: connectorId }) },
  200
);
await request(
  "connector-list",
  "/connector/list",
  { method: "POST", body: json({}) },
  200
);
await request(
  "connector-delete",
  "/connector/delete",
  { method: "POST", body: json({ id: connectorId }) },
  200
);

const firstQuestion = await request(
  "investigation-question-create-1",
  "/questions/create",
  {
    method: "POST",
    body: json({
      text: "What explains the smoke-test observation?",
      context: "End-to-end Investigation smoke coverage",
      assumptions: ["The test service is isolated"],
      tags: ["smoke"]
    })
  },
  201
);
const secondQuestion = await request(
  "investigation-question-create-2",
  "/questions/create",
  {
    method: "POST",
    body: json({ text: "Can the observation be reproduced?", tags: ["smoke"] })
  },
  201
);

const hypothesis = await request(
  "investigation-hypothesis-create",
  "/hypotheses/create",
  {
    method: "POST",
    body: json({
      questionIds: [firstQuestion.id, secondQuestion.id],
      statement: "The coherent Investigation flow is reproducible",
      rationale: "All three records share one runtime and store",
      confidenceLevel: "uncertain"
    })
  },
  201
);
assert.deepEqual(hypothesis.questionIds, [firstQuestion.id, secondQuestion.id]);

const finding = await request(
  "investigation-finding-propose",
  "/findings/propose",
  {
    method: "POST",
    body: json({
      claim: "The Investigation HTTP flow created linked records",
      references: [
        {
          kind: "url",
          href: "https://example.com/icarus-smoke-observation",
          observedAt: new Date().toISOString()
        }
      ],
      tags: ["smoke"],
      questionLinks: [
        { questionId: firstQuestion.id, relationship: "supports" },
        { questionId: secondQuestion.id, relationship: "contextualizes" }
      ],
      hypothesisLinks: [
        { hypothesisId: hypothesis.id, relationship: "qualifies" }
      ]
    })
  },
  201
);

const questionFindings = await request(
  "investigation-findings-by-question",
  `/findings/list?questionId=${encodeURIComponent(firstQuestion.id)}`,
  undefined,
  200
);
assert.equal(questionFindings.records.length, 1);
assert.equal(questionFindings.records[0].id, finding.id);

const hypothesisFindings = await request(
  "investigation-findings-by-hypothesis",
  `/findings/list?hypothesisId=${encodeURIComponent(hypothesis.id)}`,
  undefined,
  200
);
assert.equal(hypothesisFindings.records.length, 1);

const relatedHypotheses = await request(
  "investigation-hypotheses-by-question",
  `/hypotheses/list?questionId=${encodeURIComponent(secondQuestion.id)}`,
  undefined,
  200
);
assert.equal(relatedHypotheses.records.length, 1);

const reviewMarked = await request(
  "investigation-reference-mark-review",
  "/findings/mark-reference-review",
  { method: "POST", body: json({ id: finding.id, referenceIndex: 0 }) },
  200
);
assert.equal(reviewMarked.references[0].needsReview, true);
const reviewCleared = await request(
  "investigation-reference-clear-review",
  "/findings/clear-reference-review",
  { method: "POST", body: json({ id: finding.id, referenceIndex: 0 }) },
  200
);
assert.equal(reviewCleared.references[0].needsReview, undefined);

const accepted = await request(
  "investigation-finding-accept",
  "/findings/accept",
  { method: "POST", body: json({ id: finding.id }) },
  200
);
assert.equal(accepted.status, "accepted");
assert.equal(accepted.knowledgeSourceId, `finding:${finding.id}`);
const acceptedAgain = await request(
  "investigation-finding-accept-idempotent",
  "/findings/accept",
  { method: "POST", body: json({ id: finding.id }) },
  200
);
assert.equal(acceptedAgain.knowledgeSourceId, accepted.knowledgeSourceId);

const proposedAnswer = await request(
  "investigation-question-propose-answer",
  "/questions/propose-answer",
  {
    method: "POST",
    body: json({
      id: firstQuestion.id,
      currentAnswer: "The unified runtime completed the tested flow"
    })
  },
  200
);
assert.equal(proposedAnswer.status, "proposed");
const confirmedAnswer = await request(
  "investigation-question-confirm-answer",
  "/questions/confirm-answer",
  { method: "POST", body: json({ id: firstQuestion.id }) },
  200
);
assert.equal(confirmedAnswer.status, "answered");

const assessedHypothesis = await request(
  "investigation-hypothesis-assess",
  "/hypotheses/update",
  {
    method: "POST",
    body: json({
      id: hypothesis.id,
      status: "accepted",
      confidenceLevel: "strongly_supported"
    })
  },
  200
);
assert.equal(assessedHypothesis.status, "accepted");

await request(
  "investigation-finding-delete",
  `/findings/delete?id=${encodeURIComponent(finding.id)}`,
  { method: "DELETE" },
  204
);
await request(
  "investigation-hypothesis-delete",
  `/hypotheses/delete?id=${encodeURIComponent(hypothesis.id)}`,
  { method: "DELETE" },
  204
);
await request(
  "investigation-question-delete-1",
  `/questions/delete?id=${encodeURIComponent(firstQuestion.id)}`,
  { method: "DELETE" },
  204
);
await request(
  "investigation-question-delete-2",
  `/questions/delete?id=${encodeURIComponent(secondQuestion.id)}`,
  { method: "DELETE" },
  204
);
await request(
  "investigation-finding-deleted-read",
  `/findings/get?id=${encodeURIComponent(finding.id)}`,
  undefined,
  404
);
await request(
  "investigation-hypothesis-deleted-read",
  `/hypotheses/get?id=${encodeURIComponent(hypothesis.id)}`,
  undefined,
  404
);
await request(
  "investigation-question-deleted-read",
  `/questions/get?id=${encodeURIComponent(firstQuestion.id)}`,
  undefined,
  404
);

await request("derived-not-found", "/derived-outputs?id=smoke-missing", undefined, 404);

// Templates: the catalog queries are live, but no resource adapter is
// registered yet, so registration is expected to answer unsupported_kind.
const templateList = await request(
  "templates-list",
  "/templates/query",
  { method: "POST", body: json({ query: { type: "template.list" } }) },
  200
);
assert.equal(templateList.type, "template.records");

await request(
  "templates-register-unsupported-kind",
  "/templates/command",
  {
    method: "POST",
    body: json({
      requestId: "smoke-template-1",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "smoke-doc" }
      }
    })
  },
  400
);

await request(
  "templates-get-missing",
  "/templates/query",
  {
    method: "POST",
    body: json({ query: { type: "template.get", templateId: "smoke-missing" } })
  },
  404
);

const deck = await request(
  "slides-create",
  "/slides/command",
  {
    method: "POST",
    body: json({
      origin: "interactive",
      command: { type: "deck.create", title: "Smoke deck" }
    })
  },
  201
);

const deckId = deck.head.id;

await request(
  "slides-submit",
  "/slides/command",
  {
    method: "POST",
    body: json({
      origin: "interactive",
      command: {
        type: "deck.submit",
        deckId,
        expectedRevision: 1,
        operations: [{ type: "deck.rename", title: "Smoke deck renamed" }]
      }
    })
  },
  200
);

const loadedDeck = await request(
  "slides-load",
  "/slides/query",
  {
    method: "POST",
    body: json({ query: { type: "deck.load", deckId } })
  },
  200
);
assert.equal(loadedDeck.snapshot.title, "Smoke deck renamed");

const deckOutline = await request(
  "slides-outline",
  "/slides/query",
  {
    method: "POST",
    body: json({ query: { type: "deck.outline", deckId } })
  },
  200
);
assert.equal(typeof deckOutline.text, "string");
assert.equal(deckOutline.revision, 2);

// The revision the caller already used: a conflict, not a second write.
await request(
  "slides-revision-conflict",
  "/slides/command",
  {
    method: "POST",
    body: json({
      origin: "interactive",
      command: {
        type: "deck.submit",
        deckId,
        expectedRevision: 1,
        operations: [{ type: "deck.rename", title: "Loser" }]
      }
    })
  },
  409
);

// An unknown field must be a 400 rather than a silently ignored key.
await request(
  "slides-unknown-field",
  "/slides/command",
  {
    method: "POST",
    body: json({
      origin: "interactive",
      command: { type: "deck.create", title: "Bad", deckId: "caller-chosen" }
    })
  },
  400
);

await request(
  "slides-load-missing",
  "/slides/query",
  {
    method: "POST",
    body: json({
      query: { type: "deck.load", deckId: "smoke-missing" }
    })
  },
  404
);


// ─── Structured Analytic ──────────────────────────────────────────────────────
//
// The flow that distinguishes `save` from `copy`, which is the pair most likely
// to be got wrong: append a row to a source afterwards and confirm the saved
// formula moves while the copied table does not.

const analyticSuffix = Date.now().toString(36);
const ordersName = `smokeOrders${analyticSuffix}`;
const repsName = `smokeReps${analyticSuffix}`;

const smokeOrders = await request(
  "analytic-declare-orders",
  "/structured-data",
  {
    method: "POST",
    body: json({
      kind: "table",
      displayName: ordersName,
      schema: [
        { name: "repId", kind: "text" },
        { name: "region", kind: "text" },
        { name: "amount", kind: "number" }
      ],
      rows: [
        { repId: "r1", region: "north", amount: 100 },
        { repId: "r1", region: "north", amount: 50 },
        { repId: "r2", region: "south", amount: 30 }
      ]
    })
  },
  201
);

await request(
  "analytic-declare-reps",
  "/structured-data",
  {
    method: "POST",
    body: json({
      kind: "table",
      displayName: repsName,
      schema: [{ name: "id", kind: "text" }, { name: "name", kind: "text" }],
      rows: [{ id: "r1", name: "Ada" }, { id: "r2", name: "Grace" }]
    })
  },
  201
);

const analyticDefinition = {
  inputs: [{ name: ordersName }, { name: repsName }],
  joins: [
    {
      kind: "left",
      left: ordersName,
      right: repsName,
      on: [{ leftField: "repId", rightField: "id" }]
    }
  ],
  columns: [
    { id: "p1", field: { input: ordersName, field: "region" }, aggregation: "none", label: "Region" }
  ],
  rows: [
    { id: "p2", field: { input: ordersName, field: "amount" }, aggregation: "sum", label: "Total" }
  ],
  filters: [],
  sorts: [{ placementId: "p2", direction: "desc" }],
  display: { kind: "bar" }
};

const created = await request(
  "analytic-create",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({
      type: "analytic.create",
      input: { title: "Revenue by region", definition: analyticDefinition }
    })
  },
  201
);
const analyticId = created.analytic.id;
assert.equal(created.analytic.revision, 1);
// The entry ids were captured from the project, not supplied by this request.
assert.equal(created.analytic.definition.inputs[0].entryId, smokeOrders.id);

const pulled = await request(
  "analytic-pull",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.pull", id: analyticId }) },
  200
);
// Rows placements first, then Columns — not the compiled order.
assert.deepEqual(pulled.pull.fields.map((f) => f.name), ["Total", "Region"]);
assert.equal(pulled.pull.display.kind, "bar");
assert.equal(pulled.pull.rows.length, 2);
// north totals 150 and sorts before south's 30.
assert.equal(pulled.pull.rows[0][1].value, "north");
assert.equal(pulled.pull.rows[0][0].numerator, "150");
// The receipt names what actually answered.
assert.equal(pulled.pull.sources.length, 2);
assert.equal(pulled.pull.sources[0].status, "ok");
assert.equal(pulled.pull.sources[0].entryId, smokeOrders.id);
// The pills come back with the data, because compilation is one-way.
assert.ok(pulled.pull.definition.inputs.length === 2);

const savedName = `smokeSaved${analyticSuffix}`;
await request(
  "analytic-save",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({ type: "analytic.save", input: { id: analyticId, name: savedName } })
  },
  200
);

const copiedName = `smokeCopied${analyticSuffix}`;
const copied = await request(
  "analytic-copy",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({ type: "analytic.copy", input: { id: analyticId, name: copiedName } })
  },
  200
);
assert.equal(copied.rowCount, 2);

// The saved formula resolves through Structured Data like any other entry.
const savedBefore = await request(
  "analytic-saved-resolves",
  `/structured-data/by-name?displayName=${encodeURIComponent(savedName)}`,
  undefined,
  200
);
assert.equal(savedBefore.kind, "variable");
assert.match(savedBefore.body, /^DISPLAY\(/);

// ── The distinction: append a row and see which one moves ──
await request(
  "analytic-append-row",
  "/structured-data/rows",
  {
    method: "POST",
    body: json({
      id: smokeOrders.id,
      rows: [{ repId: "r2", region: "south", amount: 500 }],
      expectedRevision: smokeOrders.revision
    })
  },
  200
);

const pulledAfter = await request(
  "analytic-pull-after-append",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.pull", id: analyticId }) },
  200
);
// south is now 530 and sorts first; the analytic tracked the new row.
assert.equal(pulledAfter.pull.rows[0][1].value, "south");
assert.equal(pulledAfter.pull.rows[0][0].numerator, "530");

// The copy is frozen at what it resolved to.
const copiedAfter = await request(
  "analytic-copy-frozen",
  `/structured-data/by-name?displayName=${encodeURIComponent(copiedName)}`,
  undefined,
  200
);
assert.equal(copiedAfter.kind, "table");
assert.equal(copiedAfter.rows.length, 2, "a copy must not move when its source does");

// ── Rename a source; the pull heals without advancing the revision ──
const renamedOrders = `${ordersName}Renamed`;
await request(
  "analytic-rename-source",
  "/structured-data/rename",
  {
    method: "PATCH",
    body: json({
      id: smokeOrders.id,
      newDisplayName: renamedOrders,
      expectedRevision: smokeOrders.revision + 1
    })
  },
  200
);

const pulledRenamed = await request(
  "analytic-pull-after-rename",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.pull", id: analyticId }) },
  200
);
const ordersSource = pulledRenamed.pull.sources.find((s) => s.entryId === smokeOrders.id);
assert.equal(ordersSource.status, "renamed");
assert.equal(ordersSource.name, renamedOrders);
assert.equal(pulledRenamed.pull.rows.length, 2, "and the data still resolves");

const afterHeal = await request(
  "analytic-get-after-heal",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.get", id: analyticId }) },
  200
);
assert.equal(afterHeal.analytic.definition.inputs[0].name, renamedOrders, "healed on disk");
assert.equal(afterHeal.analytic.revision, 1, "viewing a chart must not bump the revision");
assert.equal(afterHeal.analytic.definition.inputs[0].as, ordersName, "the key did not move");

// ── The error ladder, over the wire ──
await request(
  "analytic-unknown-field",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({
      type: "analytic.purge",
      input: { id: analyticId, unexpected: true }
    })
  },
  400
);

await request(
  "analytic-not-found",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.pull", id: "smoke-missing" }) },
  404
);

await request(
  "analytic-purge-before-delete",
  "/structured-analytics/command",
  { method: "POST", body: json({ type: "analytic.purge", input: { id: analyticId } }) },
  409
);

await request(
  "analytic-stale-revision",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({
      type: "analytic.delete",
      input: { id: analyticId, expectedRevision: 99 }
    })
  },
  409
);

// ── Delete, then purge ──
await request(
  "analytic-delete",
  "/structured-analytics/command",
  {
    method: "POST",
    body: json({ type: "analytic.delete", input: { id: analyticId, expectedRevision: 1 } })
  },
  200
);

await request(
  "analytic-get-after-delete",
  "/structured-analytics/query",
  { method: "POST", body: json({ type: "analytic.get", id: analyticId }) },
  404
);

await request(
  "analytic-purge",
  "/structured-analytics/command",
  { method: "POST", body: json({ type: "analytic.purge", input: { id: analyticId } }) },
  200
);

process.stdout.write(`${JSON.stringify({ baseUrl, samples }, null, 2)}\n`);
