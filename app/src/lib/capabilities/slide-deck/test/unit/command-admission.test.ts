import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { validateReadSlideDeckBody } from "$capabilities/slide-deck/api/read-slide-deck-body/validate-read-slide-deck-body";
import { validateSubmitSlideDeckChanges } from "$capabilities/slide-deck/api/submit-slide-deck-changes/validate-submit-slide-deck-changes";

const setOp = () => ({
  op: "set",
  target: "deck",
  path: "theme/colors/accent",
  value: "violet",
  was: "blue"
});

const command = () => ({
  changeSet: {
    resourceId: "slideDecks:current",
    baseRevision: 0,
    ops: [setOp()],
    touched: ["theme/colors/accent"]
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

describe("slide-deck command admission", () => {
  it("admits only the nominal current read command", () => {
    assert.deepEqual(validateReadSlideDeckBody({ resourceId: "slideDecks:current" }), {
      resourceId: "slideDecks:current"
    });
    for (const refused of [
      { resourceId: "documents:current" },
      { resourceId: "slideDecks:current", extra: true },
      { resourceId: undefined },
      withHidden({ resourceId: "slideDecks:current" }),
      withSymbol({ resourceId: "slideDecks:current" }),
      Object.assign(Object.create({}), { resourceId: "slideDecks:current" })
    ]) assert.throws(() => validateReadSlideDeckBody(refused));
  });

  it("does not execute an accessor while refusing it", () => {
    let reads = 0;
    const input = {};
    Object.defineProperty(input, "changeSet", {
      enumerable: true,
      get: () => {
        reads += 1;
        return command().changeSet;
      }
    });
    assert.throws(() => validateSubmitSlideDeckChanges(input));
    assert.equal(reads, 0);
  });

  it("admits one exact envelope, change set, and operation union arm", () => {
    assert.deepEqual(validateSubmitSlideDeckChanges(command()), command());
    for (const refused of [
      { ...command(), extra: true },
      { changeSet: command().changeSet, extra: undefined },
      withHidden(command()),
      withSymbol(command()),
      Object.assign(Object.create({}), command()),
      { changeSet: { ...command().changeSet, retired: true } },
      { changeSet: { ...command().changeSet, resourceId: "documents:current" } },
      { changeSet: { ...command().changeSet, baseRevision: -1 } },
      { changeSet: { ...command().changeSet, ops: [{ ...setOp(), setTargetOptional: true }] } },
      { changeSet: { ...command().changeSet, ops: [{ ...setOp(), target: undefined }] } },
      { changeSet: { ...command().changeSet, ops: [{ ...setOp(), value: undefined }] } },
      { changeSet: { ...command().changeSet, ops: [withHidden(setOp())] } },
      { changeSet: { ...command().changeSet, ops: [withSymbol(setOp())] } },
      {
        changeSet: {
          ...command().changeSet,
          ops: [Object.assign(Object.create({}), setOp())]
        }
      }
    ]) assert.throws(() => validateSubmitSlideDeckChanges(refused));
  });

  it("requires list payload cardinality and exact touched first-use order", () => {
    const list = {
      op: "remove",
      target: "slide",
      path: "slides",
      ids: ["#one", "#two"],
      after: null,
      values: [{ id: "#one" }, { id: "#two" }]
    };
    assert.doesNotThrow(() => validateSubmitSlideDeckChanges({
      changeSet: { ...command().changeSet, ops: [list], touched: ["slides"] }
    }));
    for (const ops of [
      [{ ...list, ids: [] }],
      [{ ...list, values: [{ id: "#one" }] }]
    ]) assert.throws(() => validateSubmitSlideDeckChanges({
      changeSet: { ...command().changeSet, ops, touched: ["slides"] }
    }));

    const ops = [setOp(), { ...setOp(), path: "theme/fonts/body" }, setOp()];
    for (const touched of [
      ["theme/fonts/body", "theme/colors/accent"],
      ["theme/colors/accent", "theme/colors/accent", "theme/fonts/body"],
      ["theme/colors/accent"],
      withHidden(["theme/colors/accent", "theme/fonts/body"])
    ]) assert.throws(() => validateSubmitSlideDeckChanges({
      changeSet: { ...command().changeSet, ops, touched }
    }));
  });
});
