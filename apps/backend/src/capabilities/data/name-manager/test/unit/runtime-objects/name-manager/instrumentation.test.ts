import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Logger } from "#observability";
import { createNameManager } from "#name-manager";

interface Record_ {
  level: string;
  event: string;
  data: Record<string, unknown>;
}

const recording = (): { logger: Logger; records: Record_[] } => {
  const records: Record_[] = [];
  const at = (level: string) => (event: string, data?: unknown): void => {
    records.push({ level, event, data: (data ?? {}) as Record<string, unknown> });
  };
  return {
    records,
    logger: { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") }
  };
};

const scalar = {
  name: "TaxRate",
  type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
  value: 0.0825
} as const;

describe("every call is recorded", () => {
  test("a successful call records what it was asked for and how it ended", () => {
    const { logger, records } = recording();

    createNameManager(logger).define(scalar);

    assert.deepEqual(
      records.map((r) => r.event),
      ["name-manager.define.started", "name-manager.define.completed"]
    );
    assert.equal(records[0]?.data["name"], "TaxRate");
    assert.equal(records[0]?.data["kind"], "scalar");
    assert.equal(records[1]?.data["catalogSize"], 1);
  });

  test("an expected failure is a warning carrying its code", () => {
    const { logger, records } = recording();
    const manager = createNameManager(logger);
    manager.define(scalar);
    records.length = 0;

    assert.throws(() => manager.define(scalar));

    const rejection = records.at(-1);
    assert.equal(rejection?.event, "name-manager.define.rejected");
    assert.equal(rejection?.level, "warn");
    assert.equal(rejection?.data["errorCode"], "name-conflict");
  });
});

describe("what a record may contain", () => {
  test("an authored value never reaches the log", () => {
    const { logger, records } = recording();

    createNameManager(logger).define({
      name: "ApiKey",
      type: { kind: "scalar", field: { name: "secret", type: { kind: "text" } } },
      value: "sk-do-not-log-this"
    });

    const written = JSON.stringify(records);
    assert.ok(!written.includes("sk-do-not-log-this"), `logged an authored value: ${written}`);
  });

  test("a rejected call logs the name it was given, not the value it carried", () => {
    const { logger, records } = recording();

    assert.throws(() =>
      createNameManager(logger).define({
        name: "not a valid identifier",
        type: { kind: "scalar", field: { name: "v", type: { kind: "number" } } },
        value: 1
      })
    );

    const rejection = records.at(-1);
    assert.equal(rejection?.data["errorCode"], "invalid-name");
    assert.equal(rejection?.data["name"], "not a valid identifier");
  });
});
