import { describe, expect, it } from "vitest";
import { mentionValidator } from "$shared/types/mention";

/**
 * The asymmetry with `Actor` is the model, so it is what is asserted: you mention
 * a persona, but the thing that acts is a task, and nothing is served by
 * addressing an automation, a connector, or the system.
 */
const fieldsOf = (kind: string) => {
  const member = mentionValidator.members.find((m) => m.fields.kind.value === kind);
  return member!.fields as Record<string, { kind: string; tableName?: string }>;
};

describe("mentionValidator", () => {
  it("addresses the three things you can talk to", () => {
    const kinds = mentionValidator.members.map((m) => m.fields.kind.value).sort();

    expect(kinds).toEqual(["persona", "task", "user"]);
  });

  it("admits a persona, which no actor kind names", () => {
    expect(Object.keys(fieldsOf("persona"))).toEqual(["kind", "personaId"]);
  });

  it("references real rows, so a mention resolves to who it addresses", () => {
    expect(fieldsOf("user").userId).toMatchObject({ kind: "id", tableName: "users" });
    expect(fieldsOf("persona").personaId).toMatchObject({ kind: "id", tableName: "personas" });
    expect(fieldsOf("task").taskId).toMatchObject({ kind: "id", tableName: "agentTasks" });
  });

  it("carries one reference and nothing else", () => {
    for (const kind of ["user", "persona", "task"]) {
      expect(Object.keys(fieldsOf(kind))).toHaveLength(2);
    }
  });
});
