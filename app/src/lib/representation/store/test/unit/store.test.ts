import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStore, pathFor } from "$representation/store/store.server";
import { asId } from "$representation/data/behavior/core/id";
import type { Row } from "$representation/data/types/core/id";

type Fields = { name: string; count: number };

const create = (initial?: readonly (Row<"things"> & Fields)[]) =>
  createStore<"things", Fields>({ table: "things", initial, now: () => 1000 });

const directories: string[] = [];

/** A store that actually writes. Its directory is removed after the test. */
const onDisk = () => {
  const directory = mkdtempSync(join(tmpdir(), "json-store-"));
  directories.push(directory);
  const path = pathFor(directory, "things");

  return {
    path,
    open: () => createStore<"things", Fields>({ table: "things", path, now: () => 1000 })
  };
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("createStore", () => {
  it("stamps an id and a creation time on insert", () => {
    const store = create();
    const id = store.insert({ name: "a", count: 1 });

    expect(store.get(id)).toEqual({ _id: id, _creationTime: 1000, name: "a", count: 1 });
  });

  it("prefixes ids with the table, so a stray id from another store is obvious", () => {
    expect(create().insert({ name: "a", count: 1 })).toBe("things:1");
  });

  it("patches without mutating the row a caller already read", () => {
    const store = create();
    const id = store.insert({ name: "a", count: 1 });
    const before = store.get(id);

    store.patch(id, { count: 2 });

    expect(before?.count).toBe(1);
    expect(store.get(id)?.count).toBe(2);
  });

  it("refuses to patch a row it does not hold", () => {
    expect(() => create().patch(asId("things:9"), { count: 1 })).toThrow();
  });

  it("does not reissue an id it already holds", () => {
    const store = create([{ _id: asId("things:4"), _creationTime: 0, name: "a", count: 1 }]);
    expect(store.insert({ name: "b", count: 2 })).toBe("things:5");
  });

  it("drops a removed row from every read", () => {
    const store = create();
    const id = store.insert({ name: "a", count: 1 });
    store.remove(id);

    expect(store.get(id)).toBeUndefined();
    expect(store.list()).toEqual([]);
  });

  it("writes nothing when it was given no path", () => {
    const { path, open } = onDisk();
    createStore<"things", Fields>({ table: "things" }).insert({ name: "a", count: 1 });

    expect(open().list()).toEqual([]);
    expect(() => readFileSync(path, "utf8")).toThrow();
  });
});

describe("a store with a path", () => {
  it("writes the whole table on insert", () => {
    const { path, open } = onDisk();
    open().insert({ name: "a", count: 1 });

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([
      { _id: "things:1", _creationTime: 1000, name: "a", count: 1 }
    ]);
  });

  it("reads what the last store wrote", () => {
    const { open } = onDisk();
    const id = open().insert({ name: "a", count: 1 });

    expect(open().get(id)).toEqual({ _id: id, _creationTime: 1000, name: "a", count: 1 });
  });

  it("does not reissue an id the file already holds", () => {
    const { open } = onDisk();
    open().insert({ name: "a", count: 1 });

    expect(open().insert({ name: "b", count: 2 })).toBe("things:2");
  });

  it("writes on patch and on remove", () => {
    const { path, open } = onDisk();
    const id = open().insert({ name: "a", count: 1 });

    open().patch(id, { count: 2 });
    expect(open().get(id)?.count).toBe(2);

    open().remove(id);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([]);
  });

  it("ignores its seed rows once a file exists", () => {
    // The file is the truth. A seed is what a table starts from, not what it
    // reverts to.
    const { path, open } = onDisk();
    open().insert({ name: "a", count: 1 });

    const seeded = createStore<"things", Fields>({
      table: "things",
      path,
      initial: [{ _id: asId("things:9"), _creationTime: 0, name: "seed", count: 0 }]
    });

    expect(seeded.list().map((row) => row.name)).toEqual(["a"]);
  });
});
