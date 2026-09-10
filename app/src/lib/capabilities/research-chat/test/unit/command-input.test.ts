import { describe, expect, it } from "vitest";

import { validateCreateThread } from "$capabilities/research-chat/api/create-thread/validate-create-thread";
import { validateReadThread } from "$capabilities/research-chat/api/read-thread/validate-read-thread";
import { validateRemoveThread } from "$capabilities/research-chat/api/remove-thread/validate-remove-thread";
import { validateSetThreadPersona } from "$capabilities/research-chat/api/set-thread-persona/validate-set-thread-persona";
import { validateStopTurn } from "$capabilities/research-chat/api/stop-turn/validate-stop-turn";

const threadId = "researchThreads:current";

describe("Research command input", () => {
  it("admits only the two exact current create-thread forms", () => {
    expect(validateCreateThread({})).toEqual({});
    expect(validateCreateThread({ title: "  Current title  " })).toEqual({
      title: "Current title"
    });
    for (const input of [undefined, null, [], { title: undefined }, { retiredTitle: "old" }]) {
      expect(() => validateCreateThread(input)).toThrow();
    }
  });

  it.each([
    ["readThread", validateReadThread],
    ["removeThread", validateRemoveThread],
    ["stopTurn", validateStopTurn]
  ] as const)("requires an exact nominal id for %s", (_name, validate) => {
    expect(validate({ threadId })).toEqual({ threadId });
    for (const input of [
      {},
      { threadId: undefined },
      { threadId: "current" },
      { threadId: "threads:current" },
      { threadId, retired: true }
    ]) {
      expect(() => validate(input)).toThrow();
    }
  });

  it("requires both exact fields and a nominal persona id", () => {
    expect(validateSetThreadPersona({ threadId, personaId: null })).toEqual({
      threadId,
      personaId: null
    });
    expect(validateSetThreadPersona({
      threadId,
      personaId: "personas:current"
    })).toEqual({ threadId, personaId: "personas:current" });
    for (const input of [
      { threadId },
      { threadId, personaId: undefined },
      { threadId, personaId: "current" },
      { threadId, personaId: "users:current" },
      { threadId, personaId: null, retired: true }
    ]) {
      expect(() => validateSetThreadPersona(input)).toThrow();
    }
  });

  it("rejects hidden and symbolic compatibility fields", () => {
    const hidden = { threadId };
    Object.defineProperty(hidden, "retired", { value: true });
    const symbolic = { threadId };
    Object.defineProperty(symbolic, Symbol("retired"), { value: true });
    expect(() => validateReadThread(hidden)).toThrow(/unknown field/);
    expect(() => validateReadThread(symbolic)).toThrow(/unknown field/);
    const inherited = Object.assign(Object.create({ retired: true }), { threadId });
    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "threadId", { enumerable: true, get: () => threadId });
    expect(() => validateReadThread(inherited)).toThrow(/plain data object/);
    expect(() => validateReadThread(accessor)).toThrow(/non-data/);
  });
});
