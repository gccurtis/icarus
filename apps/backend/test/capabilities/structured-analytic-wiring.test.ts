// The wire decoders and the endpoint error ladder.
//
// The ladder is the part worth testing: every rung is a decision about what a
// client should do next, and getting one wrong turns "fix your data" into "fix
// your request" or, worse, a 500 that says nothing.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/0-utils/persistence/resourceHistory.js";
import {
  AnalyticCompilationError,
  AnalyticConfigurationError,
  AnalyticNameConflictError,
  AnalyticNotFoundError,
  AnalyticPullError,
  AnalyticValidationError,
  AnalyticWireError,
  StaleAnalyticRevisionError
} from "../../src/3-capabilities/structured-analytic/domain/errors.js";
import { decodeAnalyticCommand } from "../../src/3-capabilities/structured-analytic/wire/commandSchemas.js";
import { decodeAnalyticQuery } from "../../src/3-capabilities/structured-analytic/wire/querySchemas.js";
import { registerStructuredAnalyticEndpoints } from "../../src/4-job-wiring/structured-analytic/registerStructuredAnalyticEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const definition = {
  inputs: [{ name: "Orders" }],
  joins: [],
  columns: [{ id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" }],
  rows: [],
  filters: [],
  sorts: [],
  display: { kind: "table" }
};

// ─── Command decoding ─────────────────────────────────────────────────────────

test("commands decode strictly", async (t) => {
  await t.test("create keeps the definition untouched", () => {
    const command = decodeAnalyticCommand({
      type: "analytic.create",
      input: { title: "Revenue", definition }
    });
    assert.equal(command.type, "analytic.create");
    // Passed through, not re-validated here: the domain owns what a definition
    // may contain, and a second copy of that rule would drift from the first.
    assert.deepEqual(command.input.definition, definition);
    assert.equal("description" in command.input, false);
  });

  await t.test("an optional description is carried when present, absent when not", () => {
    const withIt = decodeAnalyticCommand({
      type: "analytic.create",
      input: { title: "T", description: "why", definition }
    });
    assert.equal(withIt.input.description, "why");
  });

  await t.test("update requires a positive integer revision", () => {
    for (const bad of [0, -1, 1.5, "1", undefined, null]) {
      assert.throws(
        () => decodeAnalyticCommand({
          type: "analytic.update",
          input: { id: "an-1", expectedRevision: bad, title: "T", definition }
        }),
        AnalyticWireError,
        `expectedRevision ${String(bad)} must be refused`
      );
    }
    const ok = decodeAnalyticCommand({
      type: "analytic.update",
      input: { id: "an-1", expectedRevision: 3, title: "T", definition }
    });
    assert.equal(ok.type === "analytic.update" && ok.input.expectedRevision, 3);
  });

  // A misspelled `expectedRevision` would otherwise decode as an update with a
  // missing CAS, which is exactly the mistake that most deserves a 400.
  await t.test("an unknown field is refused, not ignored", () => {
    assert.throws(
      () => decodeAnalyticCommand({
        type: "analytic.update",
        input: { id: "an-1", expectedRevison: 1, title: "T", definition }
      }),
      /unexpected field 'expectedRevison'/
    );
    assert.throws(
      () => decodeAnalyticCommand({
        type: "analytic.create",
        input: { title: "T", definition },
        extra: true
      }),
      /unexpected field 'extra'/
    );
  });

  await t.test("an unknown command type lists the ones that exist", () => {
    assert.throws(
      () => decodeAnalyticCommand({ type: "analytic.explode", input: {} }),
      /must be one of: analytic.create, analytic.update/
    );
  });

  await t.test("save and copy share a shape and stay distinct", () => {
    const saved = decodeAnalyticCommand({
      type: "analytic.save",
      input: { id: "an-1", name: "Revenue" }
    });
    const copied = decodeAnalyticCommand({
      type: "analytic.copy",
      input: { id: "an-1", name: "Revenue" }
    });
    assert.equal(saved.type, "analytic.save");
    assert.equal(copied.type, "analytic.copy");
  });

  await t.test("a non-object body is refused before anything reads it", () => {
    for (const bad of [null, "create", 5, []]) {
      assert.throws(() => decodeAnalyticCommand(bad), AnalyticWireError);
    }
  });
});

// ─── Query decoding ───────────────────────────────────────────────────────────

test("queries decode strictly", async (t) => {
  await t.test("the three id-bearing queries require an id", () => {
    for (const type of ["analytic.get", "analytic.pull", "analytic.check"]) {
      assert.equal(decodeAnalyticQuery({ type, id: "an-1" }).type, type);
      assert.throws(() => decodeAnalyticQuery({ type }), AnalyticWireError);
    }
  });

  await t.test("list takes nothing at all", () => {
    assert.deepEqual(decodeAnalyticQuery({ type: "analytic.list" }), { type: "analytic.list" });
  });

  // Ignoring a cursor would leave a paging client silently reading only the
  // first page forever.
  await t.test("a cursor on list is refused rather than ignored", () => {
    assert.throws(
      () => decodeAnalyticQuery({ type: "analytic.list", cursor: "abc" }),
      /unexpected field 'cursor'/
    );
  });
});

// ─── The error ladder ─────────────────────────────────────────────────────────

interface Registered {
  readonly path: string;
  readonly queueType: string;
  run(body: unknown): Promise<{ statusCode: number; body: unknown }>;
}

const endpoints = (throwing: unknown): { command: Registered; query: Registered } => {
  const registered: Registered[] = [];
  const registry = {
    register: (
      route: { method: string; path: string },
      factory: (request: { body: unknown; requestId: string }) => {
        queueType: string;
        work: () => Promise<{ statusCode: number; body: unknown }>;
      }
    ) => {
      registered.push({
        path: route.path,
        queueType: factory({ body: {}, requestId: "r" }).queueType,
        run: (body: unknown) => factory({ body, requestId: "r" }).work()
      });
    }
  };

  const service = {
    command: async () => { throw throwing; },
    query: async () => { throw throwing; },
    pruneHistory: () => 0,
    purgeExpired: () => 0
  };

  registerStructuredAnalyticEndpoints(registry as never, service as never, new CapturingLogger());
  return { command: registered[0], query: registered[1] };
};

const statusFor = async (error: unknown): Promise<{ statusCode: number; body: never }> => {
  const { command } = endpoints(error);
  const response = await command.run({ type: "analytic.purge", input: { id: "an-1" } });
  return response as { statusCode: number; body: never };
};

test("every error maps to the rung a client can act on", async (t) => {
  const ladder: ReadonlyArray<readonly [string, unknown, number, string]> = [
    ["still current", new ResourceNotDeletedError("structured-analytic", "an-1"), 409, "not_deleted"],
    ["no history", new ResourceHistoryNotFoundError("structured-analytic", "an-1"), 404, "not_found"],
    ["absent", new AnalyticNotFoundError("an-1"), 404, "not_found"],
    ["stale CAS", new StaleAnalyticRevisionError("an-1", 1, 2), 409, "revision_conflict"],
    ["name taken", new AnalyticNameConflictError("Revenue"), 409, "name_conflict"],
    ["malformed request", new AnalyticWireError("bad"), 400, "validation_error"],
    ["bad definition", new AnalyticValidationError("inputs", "must not be empty"), 400, "validation_error"],
    ["will not compile", new AnalyticCompilationError("column collision"), 400, "validation_error"],
    ["data cannot satisfy it", new AnalyticPullError("no such input", "Orders", "input_not_found"), 422, "analytic_pull_invalid"]
  ];

  for (const [label, error, statusCode, code] of ladder) {
    await t.test(label, async () => {
      const response = await statusFor(error);
      assert.equal(response.statusCode, statusCode);
      assert.equal((response.body as { error: string }).error, code);
    });
  }

  await t.test("a validation error carries its field, which names the offending pill", async () => {
    const response = await statusFor(new AnalyticValidationError("columns[1].id", "duplicates"));
    assert.equal((response.body as { field: string }).field, "columns[1].id");
  });

  await t.test("a pull error carries its reason and the input at fault", async () => {
    const response = await statusFor(
      new AnalyticPullError("broken upstream", "Orders", "input_unresolved")
    );
    assert.equal((response.body as { reason: string }).reason, "input_unresolved");
    assert.equal((response.body as { input: string }).input, "Orders");
  });

  // Reaching job wiring at all would mean the process should not have booted,
  // so it is deliberately NOT dressed up as a client error.
  await t.test("a configuration fault is a 500, not a 400", async () => {
    const response = await statusFor(new AnalyticConfigurationError("maxInputs", "must be positive"));
    assert.equal(response.statusCode, 500);
    assert.equal((response.body as { error: string }).error, "internal_error");
  });

  await t.test("an unrecognised error does not leak its message", async () => {
    const response = await statusFor(new Error("connection string with a password in it"));
    assert.equal(response.statusCode, 500);
    assert.equal(
      (response.body as { message: string }).message,
      "Structured Analytic operation failed"
    );
  });
});

test("commands are serial and queries concurrent", () => {
  const { command, query } = endpoints(new AnalyticNotFoundError("an-1"));
  assert.equal(command.path, "/structured-analytics/command");
  assert.equal(command.queueType, "serial");
  assert.equal(query.path, "/structured-analytics/query");
  assert.equal(query.queueType, "concurrent");
});

test("a failing request is logged with the body that caused it", async () => {
  const registered: Array<{ run(body: unknown): Promise<unknown> }> = [];
  const logger = new CapturingLogger();
  const registry = {
    register: (
      _route: unknown,
      factory: (request: { body: unknown; requestId: string }) => {
        work: () => Promise<unknown>;
      }
    ) => {
      registered.push({ run: (body: unknown) => factory({ body, requestId: "r-9" }).work() });
    }
  };
  const service = {
    command: async () => { throw new AnalyticNotFoundError("an-1"); },
    query: async () => ({}),
    pruneHistory: () => 0,
    purgeExpired: () => 0
  };
  registerStructuredAnalyticEndpoints(registry as never, service as never, logger);

  const body = { type: "analytic.purge", input: { id: "an-1" } };
  await registered[0].run(body);

  const entry = logger.entries.find(
    e => e.message === "structured-analytic.endpoint.command.failed"
  );
  assert.ok(entry);
  assert.equal(entry.detail, "content");
  const data = entry.data as Record<string, unknown>;
  assert.equal(data.statusCode, 404);
  assert.equal(data.requestId, "r-9");
  assert.deepEqual(data.body, body, "the request that failed is in the log verbatim");
});

// ─── Composition ──────────────────────────────────────────────────────────────

test("the whole composition graph still resolves with the capability in it", async () => {
  // This catches an alias that was added to package.json but not tsconfig, a
  // circular import between capabilities, and a missing export from the barrel
  // — none of which the unit tests above can see.
  const module = await import("../../src/1-init/startBackend.js");
  assert.equal(typeof module.startBackend, "function");
});
