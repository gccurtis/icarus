import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { validateReadDocumentBody } from "$capabilities/document/api/read-document-body/validate-read-document-body";
import { validateSubmitDocumentChanges } from "$capabilities/document/api/submit-document-changes/validate-submit-document-changes";

const setOp = () => ({
  op: "set",
  target: "document",
  path: "title",
  value: "Current",
  was: "Previous"
});

const command = () => ({
  changeSet: {
    resourceId: "documents:current",
    baseRevision: 0,
    ops: [setOp()],
    touched: ["title"]
  }
});

const withHidden = <T extends object>(value: T): T => {
  Object.defineProperty(value, "hidden", { value: true, enumerable: false });
  return value;
};

const withSymbol = <T extends object>(value: T): T => {
  Object.defineProperty(value, Symbol("hidden"), { value: true, enumerable: true });
  return value;
};

describe("document command admission", () => {
  it("admits only the nominal current read command", () => {
    assert.deepEqual(validateReadDocumentBody({ resourceId: "documents:current" }), {
      resourceId: "documents:current"
    });
    for (const refused of [
      { resourceId: "presentations:current" },
      { resourceId: "documents:current", extra: true },
      { resourceId: undefined },
      withHidden({ resourceId: "documents:current" }),
      withSymbol({ resourceId: "documents:current" }),
      Object.assign(Object.create({}), { resourceId: "documents:current" })
    ]) assert.throws(() => validateReadDocumentBody(refused));
  });

  it("does not execute an accessor while refusing it", () => {
    let reads = 0;
    const input = {};
    Object.defineProperty(input, "resourceId", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "documents:current";
      }
    });
    assert.throws(() => validateReadDocumentBody(input));
    assert.equal(reads, 0);
  });

  it("admits one exact envelope, change set, and operation union arm", () => {
    assert.deepEqual(validateSubmitDocumentChanges(command()), command().changeSet);
    for (const refused of [
      { ...command(), extra: true },
      { changeSet: command().changeSet, extra: undefined },
      withHidden(command()),
      withSymbol(command()),
      Object.assign(Object.create({}), command()),
      { changeSet: { ...command().changeSet, retired: true } },
      { changeSet: { ...command().changeSet, resourceId: "presentations:current" } },
      { changeSet: { ...command().changeSet, baseRevision: -1 } },
      { changeSet: { ...command().changeSet, ops: [{ ...setOp(), ids: ["#old"] }] } },
      { changeSet: { ...command().changeSet, ops: [{ ...setOp(), value: undefined }] } },
      { changeSet: { ...command().changeSet, ops: [withHidden(setOp())] } },
      { changeSet: { ...command().changeSet, ops: [withSymbol(setOp())] } },
      {
        changeSet: {
          ...command().changeSet,
          ops: [Object.assign(Object.create({}), setOp())]
        }
      }
    ]) assert.throws(() => validateSubmitDocumentChanges(refused));
  });

  it("requires list payload cardinality and exact touched first-use order", () => {
    const list = {
      op: "insert",
      target: "row",
      path: "rows",
      ids: ["#one", "#two"],
      after: null,
      values: [{ id: "#one" }, { id: "#two" }]
    };
    assert.doesNotThrow(() => validateSubmitDocumentChanges({
      changeSet: { ...command().changeSet, ops: [list], touched: ["rows"] }
    }));
    for (const ops of [
      [{ ...list, ids: [] }],
      [{ ...list, values: [{ id: "#one" }] }]
    ]) assert.throws(() => validateSubmitDocumentChanges({
      changeSet: { ...command().changeSet, ops, touched: ["rows"] }
    }));

    const ops = [setOp(), { ...setOp(), path: "subtitle" }, setOp()];
    for (const touched of [
      ["subtitle", "title"],
      ["title", "title", "subtitle"],
      ["title"],
      withHidden(["title", "subtitle"])
    ]) assert.throws(() => validateSubmitDocumentChanges({
      changeSet: { ...command().changeSet, ops, touched }
    }));
  });
});
