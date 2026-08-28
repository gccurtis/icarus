import assert from "node:assert/strict";
import { describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  calls: [] as string[],
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table} ${JSON.stringify(fields)}`);
      return `${table}:1`;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      return { table: "projects", kind: "table", rows: [] };
    },
    update: (path: string, value: unknown) => model.calls.push(`update ${path} ${JSON.stringify(value)}`),
    remove: (path: string) => model.calls.push(`remove ${path}`)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));

const { create } = await import("$capabilities/store/api/create/create");
const { read } = await import("$capabilities/store/api/read/read");
const { update } = await import("$capabilities/store/api/update/update");
const { remove } = await import("$capabilities/store/api/remove/remove");

describe("what a procedure refuses before it acts", () => {
  it("refuses an input that is not an object", () => {
    for (const procedure of [create, read, update, remove]) {
      expect(() => procedure("documents.x")).toThrow(/an input is an object/);
    }
  });

  it("refuses a path that is not a non-empty string", () => {
    for (const procedure of [read, update, remove]) {
      expect(() => procedure({ path: "", value: 1 })).toThrow(/non-empty string/);
      expect(() => procedure({ path: 7, value: 1 })).toThrow(/non-empty string/);
    }
  });

  it("refuses fields that are not an object", () => {
    expect(() => create({ table: "projects", fields: [] })).toThrow(/fields is an object/);
    expect(() => create({ table: "", fields: {} })).toThrow(/non-empty string/);
  });

  it("refuses an update with no value", () => {
    expect(() => update({ path: "projects.projects:1.name" })).toThrow(/value is required/);
  });

  it("does not reach the store when it refuses", () => {
    model.calls.length = 0;
    expect(() => read({ path: "" })).toThrow();
    assert.deepEqual(model.calls, []);
  });
});

describe("what it passes through", () => {
  it("hands each call to the store and answers with what came back", () => {
    model.calls.length = 0;

    assert.deepEqual(create({ table: "projects", fields: { name: "Q3" } }), { id: "projects:1" });
    assert.deepEqual(read({ path: "projects" }), { table: "projects", kind: "table", rows: [] });
    assert.deepEqual(update({ path: "projects.projects:1.name", value: "Q4" }), {
      path: "projects.projects:1.name"
    });
    assert.deepEqual(remove({ path: "projects.projects:1" }), { path: "projects.projects:1" });

    assert.deepEqual(model.calls, [
      'create projects {"name":"Q3"}',
      "read projects",
      'update projects.projects:1.name "Q4"',
      "remove projects.projects:1"
    ]);
  });

  it("answers null rather than undefined when a read finds nothing", () => {
    model.store.read = () => undefined as never;
    expect(read({ path: "projects.projects:9" })).toBeNull();
  });
});
