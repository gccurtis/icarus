import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
import { get } from "$name-manager/api/get/get";
import { list } from "$name-manager/api/list/list";
import { record } from "$name-manager/api/shared/record";
import { installDatabases, scopeFor } from "$name-manager/test/fixture";
import { stub } from "$name-manager/test/stub";
import type { NamedVariableInput } from "$name-manager/types/variables";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$name-manager/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");
const events = () => stub.records.map(({ message }) => message);
const last = () => stub.records.at(-1);

const scalar = {
  name: "TaxRate",
  type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
  value: 0.0825
} as const satisfies NamedVariableInput;

describe("every call is recorded", () => {
  test("a successful call records what it was asked for and that it finished", async () => {
    await define(scope, scalar);

    assert.deepEqual(events(), ["name-manager.define.started", "name-manager.define.completed"]);
    assert.equal((stub.records[0]?.data as { name: string }).name, "TaxRate");
  });

  test("a stated refusal is a warning carrying its code", async () => {
    await define(scope, scalar);
    stub.records.length = 0;

    await assert.rejects(() => define(scope, scalar));

    assert.equal(last()?.message, "name-manager.define.rejected");
    assert.equal(last()?.level, "warn");
    assert.equal((last()?.data as { errorCode: string }).errorCode, "name-conflict");
  });

  test("a fault is an error, and is not mistaken for a refusal", async () => {
    // The distinction the two levels exist for: if an ordinary rejection and a
    // real bug were logged the same way, neither would stand out.
    const failure = new Error("database unavailable");

    await assert.rejects(
      () =>
        record("get", { name: "TaxRate" }, async () => {
          throw failure;
        }),
      (error: unknown) => error === failure
    );

    assert.equal(last()?.message, "name-manager.get.failed");
    assert.equal(last()?.level, "error");
    assert.equal((last()?.data as { errorMessage: string }).errorMessage, "database unavailable");
  });

  test("every function records under its own operation name", async () => {
    await get(scope, "TaxRate");
    await list(scope);

    assert.ok(events().includes("name-manager.get.started"));
    assert.ok(events().includes("name-manager.list.completed"));
  });
});

describe("what a record may never contain", () => {
  test("an authored value never reaches the log", async () => {
    // The catalog holds whatever someone put in it, and a log is copied,
    // shipped, and retained far longer than the row it describes.
    await define(scope, {
      name: "ApiKey",
      type: { kind: "scalar", field: { name: "secret", type: { kind: "text" } } },
      value: "sk-do-not-log-this"
    });

    const written = JSON.stringify(stub.records);
    assert.ok(!written.includes("sk-do-not-log-this"), `logged an authored value: ${written}`);
  });

  test("a nested field name from inside a value does not either", async () => {
    await define(scope, {
      name: "Customer",
      type: { kind: "record", fields: [{ name: "socialSecurityNumber", type: { kind: "text" } }] },
      value: { socialSecurityNumber: "000-00-0000" }
    });

    const written = JSON.stringify(stub.records);
    assert.ok(!written.includes("000-00-0000"), written);
    assert.ok(!written.includes("socialSecurityNumber"), written);
  });

  test("a rejected call logs the name it was given, and nothing it carried", async () => {
    await assert.rejects(() =>
      define(scope, {
        name: "not a valid identifier",
        type: { kind: "scalar", field: { name: "v", type: { kind: "text" } } },
        value: "secret-payload"
      } as unknown as NamedVariableInput)
    );

    assert.equal((last()?.data as { errorCode: string }).errorCode, "invalid-name");
    assert.equal((last()?.data as { name: string }).name, "not a valid identifier");
    assert.ok(!JSON.stringify(stub.records).includes("secret-payload"));
  });

  test("list records no name at all", async () => {
    await define(scope, scalar);
    stub.records.length = 0;

    await list(scope);

    assert.ok(!JSON.stringify(stub.records).includes("TaxRate"));
  });
});
