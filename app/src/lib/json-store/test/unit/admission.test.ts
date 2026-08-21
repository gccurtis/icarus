import { describe, expect, it } from "vitest";
import { asRowId, asTable } from "$json-store/admission";
import { TABLE_NAMES } from "$json-store/tables";

describe("asTable", () => {
  it("admits every table the store has", () => {
    for (const table of TABLE_NAMES) expect(asTable(table)).toBe(table);
  });

  it("refuses a name that would leave the data directory", () => {
    // A table name becomes a path segment, so this is the check that stops a
    // caller reading and writing anywhere on disk.
    for (const traversal of ["../users", "../../etc/passwd", "/etc/passwd", "users/../../x"]) {
      expect(() => asTable(traversal)).toThrow();
    }
  });

  it("refuses a name it does not have, and anything that is not a name", () => {
    for (const value of ["Users", "user", "", null, undefined, 7, {}, ["users"]]) {
      expect(() => asTable(value)).toThrow();
    }
  });
});

describe("asRowId", () => {
  it("takes a string through", () => {
    expect(asRowId("users:1")).toBe("users:1");
  });

  it("refuses anything a map key should not be", () => {
    for (const value of [null, undefined, 7, {}, ["users:1"]]) {
      expect(() => asRowId(value)).toThrow();
    }
  });
});
