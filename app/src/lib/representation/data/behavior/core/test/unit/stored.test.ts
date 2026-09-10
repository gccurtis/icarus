import { describe, expect, test } from "vitest";
import {
  hasExactFields,
  storedFields
} from "$representation/data/behavior/core/stored";

describe("current represented-object admission", () => {
  test("admits only plain JSON records", () => {
    expect(storedFields({ kind: "current" })).toEqual({ kind: "current" });
    expect(storedFields(Object.assign(Object.create(null), { kind: "current" }))).toBeDefined();
    expect(storedFields([])).toBeUndefined();
    expect(storedFields(new (class RecordValue { kind = "current"; })())).toBeUndefined();
  });

  test("rejects state that cannot survive the durable JSON boundary", () => {
    const hidden = { kind: "current" };
    Object.defineProperty(hidden, "retired", { value: true });
    expect(storedFields(hidden)).toBeUndefined();

    const accessor = {};
    Object.defineProperty(accessor, "kind", { enumerable: true, get: () => "current" });
    expect(storedFields(accessor)).toBeUndefined();

    expect(storedFields({ kind: "current", optional: undefined })).toBeUndefined();
    expect(storedFields({ kind: "current", [Symbol("retired")]: true })).toBeUndefined();
  });

  test("requires exact enumerable data fields with no explicit undefined", () => {
    expect(hasExactFields({ kind: "current" }, ["kind"])).toBe(true);
    expect(hasExactFields({ kind: "current", note: "kept" }, ["kind"], ["note"])).toBe(true);
    expect(hasExactFields({ kind: "current", note: undefined }, ["kind"], ["note"])).toBe(false);

    const hidden = { kind: "current" };
    Object.defineProperty(hidden, "note", { value: "hidden" });
    expect(hasExactFields(hidden, ["kind"], ["note"])).toBe(false);

    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "kind", { enumerable: true, get: () => "current" });
    expect(hasExactFields(accessor, ["kind"])).toBe(false);
  });
});
