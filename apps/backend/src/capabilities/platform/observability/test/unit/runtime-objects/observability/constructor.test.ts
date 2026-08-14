import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import {
  createObservabilityRuntime,
  type ObservabilityConfiguration
} from "#observability";

// The package directory, resolved the way the capability resolves it: through an
// alias, which lint rule 2 permits, rather than from a module's own location,
// which it forbids everywhere under src/. Deriving it from the runner's working
// directory would be the other option, and a worse one.
const packageRoot = dirname(fileURLToPath(import.meta.resolve("#package.json")));

/** A directory this file owns entirely, so cleanup cannot remove real logs. */
const testDirectory = join("logs", "unit-observability");
const absoluteTestDirectory = join(packageRoot, testDirectory);

const configuration = (values: Record<string, unknown>): ObservabilityConfiguration => ({
  get: (key: string): unknown => values[key]
});

const enabled = {
  "logging.enabled": true,
  "logging.level": "debug"
};

const filesWritten = (): string[] =>
  existsSync(absoluteTestDirectory) ? readdirSync(absoluteTestDirectory).sort() : [];

after(() => {
  rmSync(absoluteTestDirectory, { recursive: true, force: true });
});

describe("a file destination", () => {
  test("writes records into a file named for the moment the run started", async () => {
    const runtime = createObservabilityRuntime(
      configuration({
        ...enabled,
        "logging.destination.kind": "file",
        "logging.destination.directory": testDirectory
      })
    );

    runtime.logger.info("test.record", { value: 1 });
    await runtime.close();

    const written = filesWritten();
    assert.equal(written.length, 1);

    const name = written[0] ?? "";
    assert.match(name, /^backend-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.log$/);

    const record = JSON.parse(readFileSync(join(absoluteTestDirectory, name), "utf8").trim()) as {
      msg: string;
      data: { value: number };
    };
    assert.equal(record.msg, "test.record");
    assert.equal(record.data.value, 1);
  });

  test("names the file so that sorting it is ordering it by time", () => {
    const name = filesWritten()[0] ?? "";
    const stamp = name.slice("backend-".length, -".log".length);

    // Reversing the substitution the name makes must give a real instant, which
    // is what lets a fixed-width lexicographic sort be a chronological one.
    const iso = `${stamp.slice(0, 10)}T${stamp.slice(11, 19).replace(/-/g, ":")}.${stamp.slice(20, 23)}Z`;
    const parsed = new Date(iso);

    assert.ok(!Number.isNaN(parsed.getTime()), `not a parseable instant: ${iso}`);
    assert.ok(Math.abs(Date.now() - parsed.getTime()) < 60_000, "not the current run");
  });

  test("creates the directory when it is absent", async () => {
    rmSync(absoluteTestDirectory, { recursive: true, force: true });
    assert.equal(existsSync(absoluteTestDirectory), false);

    const runtime = createObservabilityRuntime(
      configuration({
        ...enabled,
        "logging.destination.kind": "file",
        "logging.destination.directory": join(testDirectory, "nested")
      })
    );
    runtime.logger.info("test.record");
    await runtime.close();

    assert.ok(existsSync(join(absoluteTestDirectory, "nested")));
  });
});

describe("a piped destination", () => {
  test("leaves the standard stream open after close", async () => {
    const runtime = createObservabilityRuntime(
      configuration({
        ...enabled,
        "logging.destination.kind": "piped",
        "logging.destination.stream": "stdout"
      })
    );

    await runtime.close();

    // Closing a piped runtime must never end file descriptor 1: the rest of the
    // process — and the test runner reporting this result — writes to it.
    assert.equal(process.stdout.writable, true);
  });

  test("writes no file", async () => {
    rmSync(absoluteTestDirectory, { recursive: true, force: true });

    const runtime = createObservabilityRuntime(
      configuration({
        ...enabled,
        "logging.destination.kind": "piped",
        "logging.destination.stream": "stderr",
        "logging.destination.directory": testDirectory
      })
    );
    await runtime.close();

    assert.deepEqual(filesWritten(), []);
  });
});

describe("a disabled runtime", () => {
  test("opens nothing, so no empty file marks a run that recorded nothing", async () => {
    rmSync(absoluteTestDirectory, { recursive: true, force: true });

    const runtime = createObservabilityRuntime(
      configuration({
        "logging.enabled": false,
        "logging.destination.kind": "file",
        "logging.destination.directory": testDirectory
      })
    );
    runtime.logger.error("never recorded");
    await runtime.close();

    assert.deepEqual(filesWritten(), []);
  });
});

describe("configuration is validated before the logger exists", () => {
  const rejected: Array<[string, Record<string, unknown>, RegExp]> = [
    ["an unknown kind", { ...enabled, "logging.destination.kind": "syslog" }, /destination\.kind/],
    ["a missing kind", { ...enabled }, /destination\.kind/],
    [
      "an unknown stream",
      { ...enabled, "logging.destination.kind": "piped", "logging.destination.stream": "stdio" },
      /destination\.stream/
    ],
    [
      "a missing directory",
      { ...enabled, "logging.destination.kind": "file" },
      /destination\.directory/
    ],
    [
      "an empty directory",
      { ...enabled, "logging.destination.kind": "file", "logging.destination.directory": "" },
      /destination\.directory/
    ]
  ];

  for (const [label, values, message] of rejected) {
    test(`rejects ${label}, naming the key`, () => {
      assert.throws(() => createObservabilityRuntime(configuration(values)), message);
    });
  }
});
