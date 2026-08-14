import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { registerBuiltInEndpoints } from "#built-in";
import { createRegistry } from "#registry";
import type { Logger } from "#observability";
import { createWebServer, type WebServerRuntime } from "#web-server";

/** The message a throwing job must never leak into a response. */
const SECRET = "select * from rich_content where id = $1 -- password=hunter2";

interface Record_ {
  event: string;
  level: string;
  data: Record<string, unknown>;
}

const records: Record_[] = [];
const record = (level: string) => (event: string, data?: unknown): void => {
  records.push({ event, level, data: (data ?? {}) as Record<string, unknown> });
};
const logger: Logger = {
  debug: record("debug"),
  info: record("info"),
  warn: record("warn"),
  error: record("error")
};

let webServer: WebServerRuntime;
let base: string;

const request = async (
  path: string,
  init?: RequestInit
): Promise<{ status: number; text: string; records: Record_[] }> => {
  const before_ = records.length;
  const response = await fetch(base + path, init);
  const text = await response.text();
  // The response resolves before onResponse is guaranteed to have run.
  await new Promise((resolve) => setImmediate(resolve));
  return { status: response.status, text, records: records.slice(before_) };
};

const json = (text: string): { error?: { code?: string; message?: string; requestId?: string } } =>
  JSON.parse(text) as { error?: { code?: string; message?: string; requestId?: string } };

before(async () => {
  const registry = createRegistry();
  registerBuiltInEndpoints(registry);

  registry.register({ method: "GET", path: "/faulty" }, async () => {
    throw new Error(SECRET);
  });
  registry.register({ method: "GET", path: "/envelope" }, async (envelope) => ({
    statusCode: 200,
    body: { keys: Object.keys(envelope).sort(), query: envelope.query }
  }));
  registry.register({ method: "GET", path: "/headers" }, async () => ({
    statusCode: 200,
    headers: { "x-chosen-by-the-job": "yes" },
    body: {}
  }));
  registry.register({ method: "GET", path: "/absent-thing" }, async () => ({
    statusCode: 404,
    body: { error: { code: "thing-not-found", message: "No such thing." } }
  }));

  webServer = createWebServer({ bodyLimitBytes: 1024, requestTimeoutMs: 5_000 }, logger);
  webServer.registerTransport(registry);
  base = (await webServer.listen({ host: "127.0.0.1", port: 0 })).replace("0.0.0.0", "127.0.0.1");
});

after(async () => {
  await webServer.close();
});

describe("a fault never reaches the caller", () => {
  test("a throwing job answers 500 without any part of the thrown message", async () => {
    const { status, text } = await request("/faulty");

    assert.equal(status, 500);
    assert.equal(json(text).error?.code, "internal");
    assert.ok(!text.includes("password"), `leaked the thrown message: ${text}`);
    assert.ok(!text.includes("rich_content"), `leaked the thrown message: ${text}`);
    assert.ok(!text.includes(SECRET), `leaked the thrown message: ${text}`);
  });

  test("the 500 carries the request id that joins it to the log record", async () => {
    const { text, records: emitted } = await request("/faulty");

    const requestId = json(text).error?.requestId;
    assert.equal(typeof requestId, "string");
    assert.equal(emitted.at(-1)?.data["requestId"], requestId);
  });

  test("the log record keeps the detail the response dropped", async () => {
    const { records: emitted } = await request("/faulty");

    const fault = emitted.at(-1);
    assert.equal(fault?.event, "http.request.failed");
    assert.equal(fault?.level, "error");
    assert.equal(fault?.data["errorMessage"], SECRET);
  });
});

describe("a body the framework refuses is answered and recorded", () => {
  test("malformed JSON answers the shaped 400 rather than Fastify's", async () => {
    const { status, text } = await request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{oops"
    });

    assert.equal(status, 400);
    assert.equal(json(text).error?.code, "malformed-body");
    assert.ok(!text.includes("FST_ERR"), `forwarded a framework code: ${text}`);
  });

  test("malformed JSON is logged — it used to produce no record at all", async () => {
    const { records: emitted } = await request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{oops"
    });

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.event, "http.request.rejected");
    assert.equal(emitted[0]?.data["statusCode"], 400);
  });

  test("a non-JSON media type is refused with 415", async () => {
    const { status, text, records: emitted } = await request("/echo", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hi"
    });

    assert.equal(status, 415);
    assert.equal(json(text).error?.code, "unsupported-media-type");
    assert.equal(emitted.at(-1)?.event, "http.request.rejected");
  });

  test("a body over the limit is refused with 413", async () => {
    const { status, text } = await request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(4096) })
    });

    assert.equal(status, 413);
    assert.equal(json(text).error?.code, "body-too-large");
  });
});

describe("endpoint lookup", () => {
  test("HEAD is answered by the endpoint's GET job", async () => {
    const { status } = await request("/health", { method: "HEAD" });

    assert.equal(status, 200);
  });

  test("an unregistered endpoint answers the shaped 404 and lists nothing", async () => {
    const { status, text } = await request("/nope");

    assert.equal(status, 404);
    assert.equal(json(text).error?.code, "endpoint-not-found");
    assert.ok(!text.includes("/health"), `disclosed the endpoint surface: ${text}`);
    assert.ok(!text.includes("registeredRoutes"), `disclosed the endpoint surface: ${text}`);
  });

  test("a missing endpoint and a missing thing are different events", async () => {
    const missingEndpoint = await request("/nope");
    const missingThing = await request("/absent-thing");

    assert.equal(missingEndpoint.records.at(-1)?.event, "http.route.not-found");
    assert.equal(missingThing.status, 404);
    assert.equal(missingThing.records.at(-1)?.event, "http.request.rejected");
  });
});

describe("the envelope hides the framework", () => {
  test("it carries no params, so no routing artifact reaches a job", async () => {
    const { text } = await request("/envelope?a=1");

    const body = JSON.parse(text) as { keys: string[]; query: Record<string, unknown> };
    assert.ok(!body.keys.includes("params"), `envelope kept params: ${body.keys.join(", ")}`);
    assert.deepEqual(body.query, { a: "1" });
  });
});

describe("a successful response", () => {
  test("is logged exactly once", async () => {
    const { status, records: emitted } = await request("/health");

    assert.equal(status, 200);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.event, "http.request.completed");
    assert.equal(emitted[0]?.level, "info");
    assert.equal(typeof emitted[0]?.data["durationMs"], "number");
  });

  test("applies the headers its job chose", async () => {
    const response = await fetch(`${base}/headers`);

    assert.equal(response.headers.get("x-chosen-by-the-job"), "yes");
  });
});
