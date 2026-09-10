import { describe, expect, it } from "vitest";

import {
  readCurrentRows,
  type StoreUnitOfWork
} from "$model/server/store/index.server";

const currentUser = {
  _id: "users:u",
  _creationTime: 1,
  authSubject: "auth:u",
  displayName: "Uma",
  settings: "{}",
  updatedAt: 1
};

const storeReturning = (value: unknown): StoreUnitOfWork => ({
  read: () => value
}) as unknown as StoreUnitOfWork;

describe("current Store table reads", () => {
  it("returns a completely admitted current table image", () => {
    expect(readCurrentRows(storeReturning({
      kind: "table",
      table: "users",
      rows: [currentUser]
    }), "users")).toEqual([currentUser]);
  });

  it("rejects a missing Store result", () => {
    expect(() => readCurrentRows(storeReturning(undefined), "users"))
      .toThrow("the Store did not return the 'users' table");
  });

  it("rejects a result for a different table", () => {
    expect(() => readCurrentRows(storeReturning({
      kind: "table",
      table: "documents",
      rows: []
    }), "users")).toThrow("the Store did not return the 'users' table");
  });

  it("rejects a structurally non-current row", () => {
    expect(() => readCurrentRows(storeReturning({
      kind: "table",
      table: "users",
      rows: [{ _id: "users:u", _creationTime: 1, displayName: "Partial" }]
    }), "users")).toThrow(/missing required fields/);
  });
});
