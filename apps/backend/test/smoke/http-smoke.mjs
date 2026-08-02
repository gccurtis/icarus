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

process.stdout.write(`${JSON.stringify({ baseUrl, samples }, null, 2)}\n`);
