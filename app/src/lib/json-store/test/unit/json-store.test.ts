import { describe, expect, it } from "vitest";
import { createJsonStore } from "$json-store/tables";
import { asId } from "$json-store/types/core/id";

const TABLES = 35;

describe("createJsonStore", () => {
  it("holds every table", () => {
    expect(Object.keys(createJsonStore())).toHaveLength(TABLES);
  });

  it("returns a fresh set each call, so two graphs share nothing", () => {
    const first = createJsonStore();
    const second = createJsonStore();

    first.projects.insert({ name: "One", revision: 1, settings: "{}", updatedAt: 0 });

    expect(first.projects.list()).toHaveLength(1);
    expect(second.projects.list()).toHaveLength(0);
  });

  it("seeds each table from its own rows", () => {
    const store = createJsonStore({
      users: [
        {
          _id: asId("users:1"),
          _creationTime: 0,
          authSubject: "sub",
          displayName: "Dev",
          settings: "{}",
          updatedAt: 0
        }
      ],
      now: () => 1000
    });

    expect(store.users.list()).toHaveLength(1);
    expect(store.projects.list()).toEqual([]);
  });

  it("keeps ids inside their own table", () => {
    const store = createJsonStore();
    store.projects.insert({ name: "One", revision: 1, settings: "{}", updatedAt: 0 });

    // A project id is not a document id, and the compiler is what says so.
    expect(store.documents.get(asId("projects:1"))).toBeUndefined();
  });
});
