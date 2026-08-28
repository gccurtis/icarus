import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/definition";

const directories: string[] = [];

const inMemory = () => defineStore({ now: () => 1000 });

const onDisk = () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-store-"));
  directories.push(directory);
  return { store: defineStore({ directory, now: () => 1000 }), directory };
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("create", () => {
  it("mints an id and stamps the row", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "Q3" });

    expect(id).toBe("projects:1");
    const found = store.read("projects.projects:1");
    expect(found?.kind).toBe("row");
    expect(found?.kind === "row" && found.row._creationTime).toBe(1000);
  });

  it("does not reuse an id a reloaded table already holds", () => {
    const { store, directory } = onDisk();
    store.create("projects", { name: "one" });

    const reopened = defineStore({ directory, now: () => 2000 });
    expect(reopened.create("projects", { name: "two" })).toBe("projects:2");
  });

  it("refuses what a JSON file cannot hold", () => {
    const store = inMemory();
    expect(() => store.create("projects", { name: () => "no" })).toThrow(/not storable/);
    expect(() => store.create("projects", ["not", "an", "object"])).toThrow(/is an object/);
  });
});

describe("read", () => {
  it("returns the table, the row, or the field the path names", () => {
    const store = inMemory();
    store.create("projects", { name: "Q3" });

    expect(store.read("projects")).toMatchObject({ kind: "table" });
    expect(store.read("projects.projects:1")).toMatchObject({ kind: "row" });
    expect(store.read("projects.projects:1.name")).toMatchObject({ kind: "field", value: "Q3" });
  });

  it("names the table it found, so a caller can narrow", () => {
    const store = inMemory();
    store.create("projects", { name: "Q3" });

    const found = store.read("projects.projects:1");
    expect(found?.table).toBe("projects");
  });

  it("is undefined for a row or field that is not there", () => {
    const store = inMemory();
    expect(store.read("projects.projects:9")).toBeUndefined();

    store.create("projects", { name: "Q3" });
    expect(store.read("projects.projects:1.missing")).toBeUndefined();
  });

  it("refuses a table it does not have", () => {
    expect(() => inMemory().read("nowhere.x")).toThrow(/No such table/);
  });
});

describe("update", () => {
  it("replaces a field without touching the rest of the row", () => {
    const store = inMemory();
    store.create("projects", { name: "Q3", archived: false });
    store.update("projects.projects:1.name", "Q4");

    const found = store.read("projects.projects:1");
    expect(found?.kind === "row" && found.row).toMatchObject({ name: "Q4", archived: false });
  });

  it("keeps _id and _creationTime when the whole row is written", () => {
    const store = inMemory();
    store.create("projects", { name: "Q3" });
    store.update("projects.projects:1", { name: "Q4", _id: "projects:9", _creationTime: 0 });

    const found = store.read("projects.projects:1");
    expect(found?.kind === "row" && found.row).toMatchObject({
      _id: "projects:1",
      _creationTime: 1000,
      name: "Q4"
    });
  });

  it("refuses a row that is not there, and a table with no row named", () => {
    const store = inMemory();
    expect(() => store.update("projects.projects:9", { name: "x" })).toThrow(/no 'projects' row/);
    expect(() => store.update("projects", { name: "x" })).toThrow(/is a table, not a row/);
  });
});

describe("remove", () => {
  it("drops the row, or the field", () => {
    const store = inMemory();
    store.create("projects", { name: "Q3", archived: false });

    store.remove("projects.projects:1.archived");
    const found = store.read("projects.projects:1");
    expect(found?.kind === "row" && "archived" in found.row).toBe(false);

    store.remove("projects.projects:1");
    expect(store.read("projects.projects:1")).toBeUndefined();
  });
});

describe("on disk", () => {
  it("writes the whole table on every mutation, and reads it back", () => {
    const { store, directory } = onDisk();
    store.create("projects", { name: "Q3" });

    const written = JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ _id: "projects:1", name: "Q3" });

    store.remove("projects.projects:1");
    expect(JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"))).toHaveLength(0);
  });
});
