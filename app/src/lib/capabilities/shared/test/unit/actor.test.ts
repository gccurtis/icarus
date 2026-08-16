import { describe, expect, it } from "vitest";
import { actorValidator } from "$shared/types/actor";

/**
 * The union is the model, so what is asserted here is the model: which things
 * can act, and what each one points at. A kind added without a reason, or an
 * `Actor` that carries a label, fails here rather than in a review.
 */

/** `fields` differs per member, so read it as a bag rather than narrowing five ways. */
const fieldsOf = (kind: string) => {
  const member = actorValidator.members.find((m) => m.fields.kind.value === kind);
  return member!.fields as Record<string, { kind: string; tableName?: string }>;
};

describe("actorValidator", () => {
  it("admits every actor kind the model defines", () => {
    const kinds = actorValidator.members.map((m) => m.fields.kind.value).sort();
    expect(kinds).toEqual(["agent", "automation", "connector", "system", "user"]);
  });

  it("gives the system actor no id field", () => {
    const system = actorValidator.members.find((m) => m.fields.kind.value === "system");
    expect(Object.keys(system!.fields)).toEqual(["kind"]);
  });

  it("discriminates on kind, so an unlabelled actor is rejected at the door", () => {
    expect(actorValidator.members.every((m) => m.fields.kind.kind === "literal")).toBe(true);
  });

  it("points an agent actor at its task, never its persona", () => {
    expect(Object.keys(fieldsOf("agent"))).toEqual(["kind", "taskId"]);
  });

  it("references a real users row, which is what undo compares", () => {
    expect(fieldsOf("user").userId).toMatchObject({ kind: "id", tableName: "users" });
  });

  it("carries one reference and nothing else — a label is a separate type", () => {
    for (const kind of ["user", "agent", "automation", "connector"]) {
      expect(Object.keys(fieldsOf(kind))).toHaveLength(2);
    }
  });
});
