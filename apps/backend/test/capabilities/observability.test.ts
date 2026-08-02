import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLogger } from "../../src/1-init/create/logger.js";
import { NoopLogger } from "../../src/0-platform/observability/logger.js";
import type { BackendConfig } from "../../src/0-utils/config/loadBackendConfig.js";

const fakeConfig = (overrides: Partial<BackendConfig["logging"]>, directory: string): BackendConfig =>
  ({
    logging: {
      enabled: true,
      level: "debug",
      directory,
      ...overrides
    }
  }) as BackendConfig;

const readLogLines = (directory: string): unknown[] => {
  const [fileName] = readdirSync(directory);
  const contents = readFileSync(join(directory, fileName), "utf-8");
  return contents
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
};

test("the file logger buffers writes through a stream and flushes on close", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-logger-"));
  const logger = createLogger(fakeConfig({}, directory));

  logger.info("test.event.one", { value: 1 });
  logger.warn("test.event.two", { value: 2 });
  logger.error("test.event.three", { value: 3 });
  await logger.close?.();

  const entries = readLogLines(directory) as { level: string; message: string }[];
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.message),
    ["test.event.one", "test.event.two", "test.event.three"]
  );
  assert.deepEqual(
    entries.map((entry) => entry.level),
    ["info", "warn", "error"]
  );
});

test("the minimum level filters out lower-priority entries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-logger-"));
  const logger = createLogger(fakeConfig({ level: "warn" }, directory));

  logger.debug("test.debug.suppressed");
  logger.info("test.info.suppressed");
  logger.warn("test.warn.kept");
  await logger.close?.();

  const entries = readLogLines(directory) as { message: string }[];
  assert.deepEqual(entries.map((entry) => entry.message), ["test.warn.kept"]);
});

test("a disabled logger writes nothing and close is a safe no-op", async () => {
  const logger = new NoopLogger();
  logger.info("test.event");
  await logger.close?.();
});
