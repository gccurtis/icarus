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

await request("derived-not-found", "/derived-outputs?id=smoke-missing", undefined, 404);

process.stdout.write(`${JSON.stringify({ baseUrl, samples }, null, 2)}\n`);
