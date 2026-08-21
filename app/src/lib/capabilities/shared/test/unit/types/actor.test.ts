import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { actorValidator } from "$shared/types/actor";

/**
 * Members are looked up by their `kind` literal, never by index: appending a
 * variant is exactly the change that must stay safe.
 */
const variants = (): Map<string, Record<string, { kind: string; tableName?: string }>> =>
  new Map(
    actorValidator.members.map((member) => [
      member.fields.kind.value as string,
      member.fields as Record<string, { kind: string; tableName?: string }>
    ])
  );

const fieldsOf = (kind: string): Record<string, { kind: string; tableName?: string }> => {
  const fields = variants().get(kind);
  if (fields === undefined) throw new Error(`no '${kind}' variant`);
  return fields;
};

describe("actorValidator", () => {
  it("names the four things that can act, and nothing else", () => {
    expect([...variants().keys()].sort()).toEqual(["agent", "connection", "system", "user"]);
  });

  it("has no persona kind", () => {
    // A persona replying in its own thread is not an actor: `Message.author` is
    // optional, and absent on a response means the thread's own responder. A
    // mention names a persona, and that is a `MarkLink` arm rather than this.
    expect(variants().has("persona")).toBe(false);
    expect(validate(actorValidator, { kind: "persona", personaId: "p1" })).toBe(false);
  });

  it("has no automation kind", () => {
    // Its table does not exist. Adding a union member later is a widening
    // change, so it costs nothing to wait for one.
    expect(variants().has("automation")).toBe(false);
  });

  it("points an agent at its task rather than its persona", () => {
    // The task already carries `personaId`, so storing both would let them
    // disagree — and the task is the more specific truth about what acted.
    expect(Object.keys(fieldsOf("agent")).sort()).toEqual(["kind", "taskId"]);
    expect(variants().has("task")).toBe(false);
  });

  it("points a connection at the file rather than at its connector", () => {
    // A connection reaches its connector; a connector cannot reach a file.
    expect(Object.keys(fieldsOf("connection")).sort()).toEqual(["connectionId", "kind"]);
    expect(variants().has("connector")).toBe(false);
  });

  it("names each id after its own variant, so each is a real table id", () => {
    // Convex then rejects an id belonging to the wrong table at the door, and
    // `db.get` is typed without a cast.
    const idFields: [string, string, string][] = [
      ["user", "userId", "users"],
      ["agent", "taskId", "agentTasks"],
      ["connection", "connectionId", "connections"]
    ];

    for (const [kind, field, table] of idFields) {
      expect(fieldsOf(kind)[field].kind).toBe("id");
      expect(fieldsOf(kind)[field].tableName).toBe(table);
    }
  });

  it("gives system no id, because there is nothing to look up", () => {
    expect(Object.keys(fieldsOf("system"))).toEqual(["kind"]);
    expect(validate(actorValidator, { kind: "system", id: "anything" })).toBe(false);
  });

  describe("what it refuses", () => {
    it("refuses an identified actor with no id", () => {
      expect(validate(actorValidator, { kind: "user" })).toBe(false);
      expect(validate(actorValidator, { kind: "agent" })).toBe(false);
    });

    it("refuses a kind it does not name", () => {
      expect(validate(actorValidator, { kind: "automation", automationId: "a1" })).toBe(false);
    });

    it("refuses the uniform `{ kind, id }` spelling", () => {
      // Per-variant names are what make each id checkable against one table.
      expect(validate(actorValidator, { kind: "user", id: "u1" })).toBe(false);
    });

    it("refuses a non-string id", () => {
      expect(validate(actorValidator, { kind: "user", userId: 7 })).toBe(false);
    });
  });

  it("admits each of the four", () => {
    expect(validate(actorValidator, { kind: "user", userId: "u1" })).toBe(true);
    expect(validate(actorValidator, { kind: "agent", taskId: "t1" })).toBe(true);
    expect(validate(actorValidator, { kind: "connection", connectionId: "c1" })).toBe(true);
    expect(validate(actorValidator, { kind: "system" })).toBe(true);
  });
});
