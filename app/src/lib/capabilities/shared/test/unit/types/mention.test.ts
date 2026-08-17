import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { actorValidator } from "$shared/types/actor";
import { mentionValidator } from "$shared/types/mention";

const kindsOf = (union: { members: readonly { fields: { kind: { value: unknown } } }[] }) =>
  union.members.map((member) => member.fields.kind.value as string);

describe("mentionValidator", () => {
  it("addresses a user, a persona, and a task", () => {
    expect(kindsOf(mentionValidator).sort()).toEqual(["persona", "task", "user"]);
  });

  it("is Actor minus system, and that is the only difference", () => {
    // You do not talk to the system: it is a thing that happens, not a thing you
    // address. Every other acting kind is addressable.
    const actors = new Set(kindsOf(actorValidator));
    const mentions = new Set(kindsOf(mentionValidator));

    expect(mentions.has("system")).toBe(false);
    expect([...actors].filter((kind) => !mentions.has(kind))).toEqual(["system"]);
    expect([...mentions].filter((kind) => !actors.has(kind))).toEqual([]);
  });

  it("spells every variant `{ kind, id }`", () => {
    for (const member of mentionValidator.members) {
      expect(Object.keys(member.fields).sort()).toEqual(["id", "kind"]);
      expect(member.fields.id.kind).toBe("string");
    }
  });

  describe("what it refuses", () => {
    it("refuses to address the system", () => {
      expect(validate(mentionValidator, { kind: "system" })).toBe(false);
      expect(validate(mentionValidator, { kind: "system", id: "s1" })).toBe(false);
    });

    it("refuses a mention with no id", () => {
      expect(validate(mentionValidator, { kind: "persona" })).toBe(false);
    });

    it("refuses the old per-variant id spelling", () => {
      expect(validate(mentionValidator, { kind: "persona", personaId: "p1" })).toBe(false);
    });
  });

  it("admits each of the three", () => {
    expect(validate(mentionValidator, { kind: "user", id: "u1" })).toBe(true);
    expect(validate(mentionValidator, { kind: "persona", id: "p1" })).toBe(true);
    expect(validate(mentionValidator, { kind: "task", id: "t1" })).toBe(true);
  });
});
