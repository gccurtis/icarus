import assert from "node:assert/strict";
import test from "node:test";
import {
  FileLogger,
  NoopLogger,
  type LogEntry
} from "../../src/0-platform/observability/logger.js";

const capture = (detail: "shape" | "content") => {
  const entries: LogEntry[] = [];
  const logger = new FileLogger(
    "unused",
    "debug",
    (entry) => entries.push(entry),
    undefined,
    detail
  );
  return { logger, entries };
};

test("A log record's detail label decides whether it is written", async (t) => {
  await t.test("an unlabelled record is treated as shape and always written", () => {
    // Every existing call site is unlabelled, so the default has to be the safe
    // one — otherwise turning on production logging would silently start
    // dropping records nobody labelled.
    const production = capture("shape");
    production.logger.info("capability.thing.happened", { count: 3 });
    assert.equal(production.entries.length, 1);
    assert.equal(production.entries[0].detail, undefined);
  });

  await t.test("content is written in development and dropped in production", () => {
    const development = capture("content");
    development.logger.debug("capability.thing.detail", { title: "Quarterly report" },
      { detail: "content" });
    assert.equal(development.entries.length, 1);
    assert.deepEqual(development.entries[0].data, { title: "Quarterly report" });
    // The label travels with the record, so a reader can filter after the fact
    // rather than only at write time.
    assert.equal(development.entries[0].detail, "content");

    const production = capture("shape");
    production.logger.debug("capability.thing.detail", { title: "Quarterly report" },
      { detail: "content" });
    // Dropped whole, not redacted field by field: a half-redacted record is
    // worse than an absent one, because it looks complete.
    assert.deepEqual(production.entries, []);
  });

  await t.test("the level filter still applies independently of the label", () => {
    const entries: LogEntry[] = [];
    const logger = new FileLogger("unused", "warn", (entry) => entries.push(entry),
      undefined, "content");
    logger.debug("too-quiet", { title: "x" }, { detail: "content" });
    logger.warn("loud-enough", { title: "x" }, { detail: "content" });
    assert.deepEqual(entries.map((entry) => entry.message), ["loud-enough"]);
  });

  await t.test("the no-op logger accepts the label without complaint", () => {
    const logger = new NoopLogger();
    // Not a formality: NoopLogger is what every capability gets when logging is
    // disabled, so a signature mismatch here would break the disabled path only.
    logger.info("anything", { title: "x" }, { detail: "content" });
  });
});
