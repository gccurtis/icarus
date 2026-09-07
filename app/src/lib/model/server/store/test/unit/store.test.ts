import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import { defineStore } from "$model/server/store/constructor";
import type { StoreUnitOfWork } from "$model/server/store/types";

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

    expect(id).toMatch(/^projects:[0-9a-f-]{36}$/);
    const found = store.read(`projects.${id}`);
    expect(found?.kind).toBe("row");
    expect(found?.kind === "row" && found.row._creationTime).toBe(1000);
  });

  it("does not reuse an id a reloaded table already holds or a deletion freed", () => {
    const { store, directory } = onDisk();
    const first = store.create("projects", { name: "one" });
    store.remove(`projects.${first}`);

    const reopened = defineStore({ directory, now: () => 2000 });
    const second = reopened.create("projects", { name: "two" });
    expect(second).not.toBe(first);
    expect(second).toMatch(/^projects:[0-9a-f-]{36}$/);
  });

  it("refuses what a JSON file cannot hold", () => {
    const store = inMemory();
    expect(() => store.create("projects", { name: () => "no" })).toThrow(/not storable/);
    expect(() => store.create("projects", ["not", "an", "object"])).toThrow(/is an object/);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => store.create("projects", { name: "cyclic", cycle })).toThrow(/cycle/);
  });

  it("accepts shared references because JSON can duplicate an acyclic value", () => {
    const store = inMemory();
    const shared = { value: "same source snapshot" };

    expect(() =>
      store.create("projects", { name: "shared", first: shared, second: shared })
    ).not.toThrow();
  });

  it("creates a collection as one admitted table change", () => {
    const store = inMemory();

    const ids = store.createMany("projects", [{ name: "one" }, { name: "two" }]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toHaveLength(2);
    expect(ids.every((id) => /^projects:[0-9a-f-]{36}$/.test(id))).toBe(true);
    const created = store.read("projects");
    expect(created?.kind === "table" && created.rows).toHaveLength(2);

    expect(() =>
      store.createMany("projects", [{ name: "three" }, { name: () => "not storable" }])
    ).toThrow(/not storable/);
    const refused = store.read("projects");
    expect(refused?.kind === "table" && refused.rows).toHaveLength(2);
  });
});

describe("read", () => {
  it("returns the table, the row, or the field the path names", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "Q3" });

    expect(store.read("projects")).toMatchObject({ kind: "table" });
    expect(store.read(`projects.${id}`)).toMatchObject({ kind: "row" });
    expect(store.read(`projects.${id}.name`)).toMatchObject({ kind: "field", value: "Q3" });
  });

  it("names the table it found, so a caller can narrow", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "Q3" });

    const found = store.read(`projects.${id}`);
    expect(found?.table).toBe("projects");
  });

  it("is undefined for a row or field that is not there", () => {
    const store = inMemory();
    expect(store.read("projects.projects:9")).toBeUndefined();

    const id = store.create("projects", { name: "Q3" });
    expect(store.read(`projects.${id}.missing`)).toBeUndefined();
  });

  it("refuses a table it does not have", () => {
    expect(() => inMemory().read("nowhere.x")).toThrow(/No such table/);
  });
});

describe("update", () => {
  it("replaces a field without touching the rest of the row", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "Q3", archived: false });
    store.update(`projects.${id}.name`, "Q4");

    const found = store.read(`projects.${id}`);
    expect(found?.kind === "row" && found.row).toMatchObject({ name: "Q4", archived: false });
  });

  it("keeps _id and _creationTime when the whole row is written", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "Q3" });
    store.update(`projects.${id}`, { name: "Q4", _id: "projects:9", _creationTime: 0 });

    const found = store.read(`projects.${id}`);
    expect(found?.kind === "row" && found.row).toMatchObject({
      _id: id,
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
    const id = store.create("projects", { name: "Q3", archived: false });

    store.remove(`projects.${id}.archived`);
    const found = store.read(`projects.${id}`);
    expect(found?.kind === "row" && "archived" in found.row).toBe(false);

    store.remove(`projects.${id}`);
    expect(store.read(`projects.${id}`)).toBeUndefined();
  });

  it("batches row and top-level-field removals without accepting a partial request", () => {
    const store = inMemory();
    const ids = store.createMany("projects", [
      { name: "one", archived: false },
      { name: "two", archived: false },
      { name: "three", archived: false }
    ]);

    store.removeFieldFromRows("projects", [ids[0], ids[2]], "archived");
    expect(store.read(`projects.${ids[0]}.archived`)).toBeUndefined();
    expect(store.read(`projects.${ids[1]}.archived`)).toMatchObject({ value: false });

    expect(() =>
      store.removeRows("projects", [ids[1], asId<"projects">("projects:99")])
    ).toThrow(/no 'projects' row projects:99/);
    const afterRefusal = store.read("projects");
    expect(afterRefusal?.kind === "table" && afterRefusal.rows).toHaveLength(3);

    store.removeRows("projects", [ids[0], ids[2]]);
    const remaining = store.read("projects");
    expect(remaining?.kind === "table" && remaining.rows.map((row) => row._id)).toEqual([ids[1]]);
  });
});

describe("transaction", () => {
  it("publishes several table changes together after every operation is admitted", () => {
    const store = inMemory();
    const result = store.transaction((unit) => {
      const projectId = unit.create("projects", { name: "Q3" });
      const documentId = unit.create("documents", { projectId, title: "Plan" });
      expect(unit.read(`projects.${projectId}`)).toMatchObject({ kind: "row" });
      return { projectId, documentId };
    });

    expect(store.read(`projects.${result.projectId}`)).toMatchObject({ kind: "row" });
    expect(store.read(`documents.${result.documentId}`)).toMatchObject({ kind: "row" });
  });

  it("rolls back staged operations when a later operation is invalid", () => {
    const store = inMemory();

    expect(() =>
      store.transaction((unit) => {
        unit.create("projects", { name: "never committed" });
        unit.update("documents.documents:missing.title", "invalid");
      })
    ).toThrow(/no 'documents' row/);

    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
  });

  it("isolates rows read by work that later rolls back", () => {
    const store = inMemory();
    const id = store.create("projects", { name: "before" });

    expect(() =>
      store.transaction((unit) => {
        const found = unit.read(`projects.${id}`);
        if (found?.kind === "row") {
          (found.row as unknown as { name: string }).name = "staged only";
        }
        throw new Error("rollback");
      })
    ).toThrow(/rollback/);

    expect(store.read(`projects.${id}.name`)).toMatchObject({ value: "before" });
  });

  it("does not let a returned working row mutate committed state", () => {
    const store = inMemory();
    const staged = store.transaction((unit) => {
      const id = unit.create("projects", { name: "committed" });
      const found = unit.read(`projects.${id}`);
      if (found?.kind !== "row") throw new Error("created row is missing");
      return { id, row: found.row as unknown as { name: string } };
    });

    staged.row.name = "outside";
    expect(store.read(`projects.${staged.id}.name`)).toMatchObject({ value: "committed" });
  });

  it("closes the scoped unit and refuses root access or async work inside it", () => {
    const store = inMemory();
    let retained: StoreUnitOfWork | undefined;

    store.transaction((unit) => {
      retained = unit;
      expect(() => store.read("projects")).toThrow(/supplied Store unit/);
    });
    expect(() => retained?.read("projects")).toThrow(/unit of work is closed/);
    expect(() => retained?.createMany("projects", [])).toThrow(/unit of work is closed/);

    let ran = false;
    expect(() =>
      store.transaction(async () => {
        ran = true;
      })
    ).toThrow(/must be synchronous/);
    expect(ran).toBe(false);

    expect(() =>
      store.transaction((unit) => {
        unit.create("projects", { name: "staged" });
        return Promise.resolve();
      })
    ).toThrow(/must be synchronous/);
    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });

    expect(() =>
      store.transaction(() => store.transaction(() => undefined))
    ).toThrow(/cannot be nested/);
  });
});

describe("on disk", () => {
  it("writes the whole table on every mutation, and reads it back", () => {
    const { store, directory } = onDisk();
    const id = store.create("projects", { name: "Q3" });

    const written = JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ _id: id, name: "Q3" });

    store.remove(`projects.${id}`);
    expect(JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"))).toHaveLength(0);
  });

  it("persists a multi-table transaction for a later Store instance", () => {
    const { store, directory } = onDisk();
    const ids = store.transaction((unit) => {
      const projectId = unit.create("projects", { name: "Q3" });
      const documentId = unit.create("documents", { projectId, title: "Plan" });
      return { projectId, documentId };
    });

    const reopened = defineStore({ directory });
    expect(reopened.read(`projects.${ids.projectId}`)).toMatchObject({ kind: "row" });
    expect(reopened.read(`documents.${ids.documentId}`)).toMatchObject({ kind: "row" });
  });
});
