import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JobRegistry } from "../../src/workflows/registry.js";
import { JobScheduler } from "../../src/workflows/scheduler.js";
import { createApp } from "../../src/initialization/runtimes/app.js";
import { registerHttpTransport } from "../../src/api/registerHttpTransport.js";
import {
  SQLitePersonaStore,
  createPersonaCapability,
  type PersonaContextPort
} from "../../src/capabilities/persona/index.js";
import { registerPersonaEndpoints } from "../../src/api/routes/persona/registerPersonaEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const backendPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { imports?: Record<string, unknown> };

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 8,
  concurrentQueueMaxSize: 8
};

const DEFINITION = {
  focus: "Contract terms.",
  background: "",
  approach: "Cite the clause first.",
  outputPreferences: "",
  verification: ""
};

let fixtureSequence = 0;

const createNoopContext = (): PersonaContextPort => {
  let sequence = 0;
  return {
    declare: async () => ({ id: `wrapper-${(sequence += 1)}`, revision: 1 }),
    delete: async () => undefined,
    purge: async () => undefined
  };
};

const createHarness = () => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry();
  const projectId = `persona-wiring-project-${(fixtureSequence += 1)}`;
  const directory = mkdtempSync(join(tmpdir(), "icarus-persona-wiring-"));
  const store = new SQLitePersonaStore(projectId, join(directory, "personas.db"));
  const personas = createPersonaCapability(store, { context: createNoopContext(), logger });
  registerPersonaEndpoints(registry, personas, logger);
  const app = createApp();
  registerHttpTransport(app, {
    scheduler: new JobScheduler(schedulerConfig, logger),
    registry,
    logger
  });
  return { app, registry, logger };
};

test("Persona aliases are available to the built runtime", () => {
  const imports = backendPackage.imports ?? {};
  for (const alias of ["#persona", "#persona/*"]) {
    assert.ok(alias in imports, `missing package import alias: ${alias}`);
  }
});

test("Persona commands are serial and queries are concurrent", () => {
  const { registry } = createHarness();
  const queueFor = (path: string): string => {
    const job = registry.createJob({
      requestId: `request-${path}`,
      method: "POST",
      path,
      params: {},
      query: {},
      headers: {},
      body: {}
    });
    return job.queueType;
  };

  assert.equal(queueFor("/personas/command"), "serial");
  assert.equal(queueFor("/personas/query"), "concurrent");
});

test("a persona round-trips through the command and query endpoints", async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.create",
      displayName: "Analyst",
      description: "Reads contracts.",
      definition: DEFINITION
    }
  });
  assert.equal(created.statusCode, 201);
  const createdBody = created.json() as {
    type: string;
    record: { id: string; revision: number; definitionDigest: string };
  };
  assert.equal(createdBody.type, "persona.created");
  assert.equal(createdBody.record.revision, 1);

  const fetched = await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.get", id: createdBody.record.id }
  });
  assert.equal(fetched.statusCode, 200);
  assert.equal(
    (fetched.json() as { record: { displayName: string } }).record.displayName,
    "Analyst"
  );

  const listed = await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.list" }
  });
  assert.equal(listed.statusCode, 200);
  assert.equal((listed.json() as { records: unknown[] }).records.length, 1);

  const deleted = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.delete",
      id: createdBody.record.id,
      expectedRevision: createdBody.record.revision
    }
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal((deleted.json() as { type: string }).type, "persona.deleted");
});

test("render is a pure query that returns the exact fragment and its digest", async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.render", definition: DEFINITION, sections: ["focus"] }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    prompt: string;
    promptDigest: string;
    sections: string[];
  };
  assert.equal(body.prompt, "## Focus\nContract terms.");
  assert.deepEqual(body.sections, ["focus"]);
  assert.equal(body.promptDigest.length, 64);

  // Nothing was persisted by the preview.
  const listed = await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.list" }
  });
  assert.equal((listed.json() as { records: unknown[] }).records.length, 0);
});

test("an unknown field is rejected with 400 rather than silently ignored", async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.create",
      displayName: "Analyst",
      definition: DEFINITION,
      personality: "chirpy"
    }
  });

  assert.equal(response.statusCode, 400);
  const body = response.json() as { error: string; message: string };
  assert.equal(body.error, "persona_invalid");
  assert.match(body.message, /personality/);
});

test("a missing expectedRevision is a 400, not a misleading revision conflict", async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: { type: "persona.create", displayName: "Analyst", definition: DEFINITION }
  });
  const personaId = (created.json() as { record: { id: string } }).record.id;

  const response = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: { type: "persona.update", id: personaId, description: "no revision supplied" }
  });

  // Number(undefined) would be NaN here, which compares unequal to every stored
  // revision and would surface a malformed request as 409 revision_conflict.
  assert.equal(response.statusCode, 400);
  assert.equal((response.json() as { error: string }).error, "persona_invalid");
});

test("typed errors map to their documented statuses and wire codes", async (t) => {
  const { app } = createHarness();
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: { type: "persona.create", displayName: "Analyst", definition: DEFINITION }
  });
  const record = (created.json() as { record: { id: string; revision: number } }).record;

  const missing = await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.get", id: "does-not-exist" }
  });
  assert.equal(missing.statusCode, 404);
  assert.equal((missing.json() as { error: string }).error, "persona_not_found");

  const duplicate = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: { type: "persona.create", displayName: "analyst", definition: DEFINITION }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal((duplicate.json() as { error: string }).error, "persona_name_conflict");

  const stale = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.update",
      id: record.id,
      expectedRevision: record.revision + 5,
      description: "stale"
    }
  });
  assert.equal(stale.statusCode, 409);
  assert.equal((stale.json() as { error: string }).error, "persona_revision_conflict");

  const builtin = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.delete",
      id: "builtin:default",
      expectedRevision: 0
    }
  });
  assert.equal(builtin.statusCode, 409);
  assert.equal((builtin.json() as { error: string }).error, "persona_builtin_immutable");

  const unsupported = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: { type: "persona.explode" }
  });
  assert.equal(unsupported.statusCode, 400);
  assert.equal((unsupported.json() as { error: string }).error, "persona_invalid");
});

test("persona logs carry digests and never section text", async (t) => {
  const { app, logger } = createHarness();
  t.after(() => app.close());

  await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.create",
      displayName: "Analyst",
      description: "Reads contracts.",
      definition: DEFINITION
    }
  });

  const serialized = JSON.stringify(logger.entries);
  assert.match(serialized, /persona\.create/);
  assert.match(serialized, /definitionDigest/);
  assert.doesNotMatch(serialized, /Contract terms\./);
  assert.doesNotMatch(serialized, /Cite the clause first\./);
  assert.doesNotMatch(serialized, /Reads contracts\./);
});

test("persona construction logs a runtime.created event", () => {
  const { logger } = createHarness();
  assert.ok(
    logger.entries.some((entry) => entry.message === "persona.runtime.created")
  );
});

test("every persona query dispatches a persona.query.completed log", async (t) => {
  const { app, logger } = createHarness();
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.create",
      displayName: "Analyst",
      description: "Reads contracts.",
      definition: DEFINITION
    }
  });
  const createdBody = created.json() as { record: { id: string } };

  await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.get", id: createdBody.record.id }
  });
  await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.getByName", displayName: "Analyst" }
  });
  await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.list" }
  });
  await app.inject({
    method: "POST",
    url: "/personas/query",
    payload: { type: "persona.render", definition: DEFINITION }
  });

  const queryLogs = logger.entries.filter((entry) => entry.message === "persona.query.completed");
  const loggedTypes = queryLogs.map((entry) => (entry.data as { type: string }).type);
  assert.deepEqual(
    new Set(loggedTypes),
    new Set(["persona.get", "persona.getByName", "persona.list", "persona.render"])
  );
});

test("wrapper declare and delete are logged for every Context write", async (t) => {
  const { app, logger } = createHarness();
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.create",
      displayName: "Analyst",
      description: "Reads contracts.",
      definition: { ...DEFINITION, context: { id: "context-1", kind: "context" } }
    }
  });
  const createdBody = created.json() as { record: { id: string; revision: number } };
  const declaredCount = (): number =>
    logger.entries.filter((entry) => entry.message === "persona.wrapper.declared").length;
  assert.equal(declaredCount(), 1, "create with a context declares a wrapper");

  await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.update",
      id: createdBody.record.id,
      expectedRevision: createdBody.record.revision,
      definition: { ...DEFINITION, context: { id: "context-2", kind: "context" } }
    }
  });
  // A changed context declares a fresh wrapper and deletes the old one, rather
  // than mutating the existing wrapper in place.
  assert.equal(declaredCount(), 2, "changing an existing context declares a fresh wrapper");
  assert.ok(
    logger.entries.some((entry) => entry.message === "persona.wrapper.deleted"),
    "changing an existing context deletes the old wrapper"
  );

  await app.inject({
    method: "POST",
    url: "/personas/command",
    payload: {
      type: "persona.update",
      id: createdBody.record.id,
      expectedRevision: createdBody.record.revision + 1,
      definition: DEFINITION
    }
  });
  const deletedCount = logger.entries.filter((entry) => entry.message === "persona.wrapper.deleted").length;
  assert.equal(deletedCount, 2, "removing the context deletes the wrapper again");
});
