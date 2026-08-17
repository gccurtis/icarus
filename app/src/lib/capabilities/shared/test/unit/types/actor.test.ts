import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { actorValidator } from "$shared/types/actor";

/**
 * Members are looked up by their `kind` literal, never by index: appending a
 * variant is exactly the change that must stay safe.
 */
const variants = (): Map<string, Record<string, { kind: string }>> =>
  new Map(
    actorValidator.members.map((member) => [
      member.fields.kind.value as string,
      member.fields as Record<string, { kind: string }>
    ])
  );

const fieldsOf = (kind: string): Record<string, { kind: string }> => {
  const fields = variants().get(kind);
  if (fields === undefined) throw new Error(`no '${kind}' variant`);
  return fields;
};

describe("actorValidator", () => {
  it("names the four things that can act, and nothing else", () => {
    expect([...variants().keys()].sort()).toEqual(["persona", "system", "task", "user"]);
  });

  it("has no automation or connector kind", () => {
    // Their tables do not exist. A variant holding an unvalidated id nothing can
    // resolve is worse than an honest absence; they return with their tables.
    for (const absent of ["automation", "connector", "agent"]) {
      expect(variants().has(absent)).toBe(false);
    }
  });

  it("spells every identified variant `{ kind, id }`, not `userId` or `taskId`", () => {
    for (const kind of ["user", "task", "persona"]) {
      expect(Object.keys(fieldsOf(kind)).sort()).toEqual(["id", "kind"]);
    }
  });

  it("types every id as a plain string, never against a table", () => {
    // Tables land in stages. `v.id("agentTasks")` here would have to be loosened
    // and re-tightened across dozens of files for a check that only ever held
    // inside one deployment.
    for (const kind of ["user", "task", "persona"]) {
      expect(fieldsOf(kind).id.kind).toBe("string");
    }
  });

  it("gives system no id, because there is nothing to look up", () => {
    expect(Object.keys(fieldsOf("system"))).toEqual(["kind"]);
    expect(validate(actorValidator, { kind: "system", id: "anything" })).toBe(false);
  });

  describe("what it refuses", () => {
    it("refuses an identified actor with no id", () => {
      expect(validate(actorValidator, { kind: "user" })).toBe(false);
      expect(validate(actorValidator, { kind: "task" })).toBe(false);
    });

    it("refuses a kind it does not name", () => {
      expect(validate(actorValidator, { kind: "automation", id: "a1" })).toBe(false);
      expect(validate(actorValidator, { kind: "agent", id: "t1" })).toBe(false);
    });

    it("refuses the old per-variant id spelling", () => {
      expect(validate(actorValidator, { kind: "user", userId: "u1" })).toBe(false);
    });

    it("refuses a non-string id", () => {
      expect(validate(actorValidator, { kind: "user", id: 7 })).toBe(false);
    });
  });

  it("admits each of the four", () => {
    expect(validate(actorValidator, { kind: "user", id: "u1" })).toBe(true);
    expect(validate(actorValidator, { kind: "task", id: "t1" })).toBe(true);
    expect(validate(actorValidator, { kind: "persona", id: "p1" })).toBe(true);
    expect(validate(actorValidator, { kind: "system" })).toBe(true);
  });
});
