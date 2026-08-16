import { describe, expect, it } from "vitest";
import { activityTables } from "$activity/schema";

/**
 * The log is evidence, so the assertions are about what a writer cannot do to
 * it: no index that reads another project's rows, and no label or timestamp that
 * arrives from whoever is writing.
 */
describe("activity schema", () => {
  it("leads every index with projectId", () => {
    const indexes = activityTables.activity[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("stores the resolved label beside the actor", () => {
    const fields = activityTables.activity.validator.fields;

    expect(fields).toHaveProperty("actor");
    expect(Object.keys(fields.actorLabel.fields).sort()).toEqual(
      ["detail", "kind", "name", "onBehalfOf"].sort()
    );
  });

  it("gives a target an id and a label that outlives it", () => {
    const target = activityTables.activity.validator.fields.target;

    expect(Object.keys(target.fields).sort()).toEqual(["id", "label", "type"].sort());
  });

  it("holds what happened and nothing a reader has to join for", () => {
    const fields = Object.keys(activityTables.activity.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "actor", "actorLabel", "verb", "target", "context", "detail", "at"].sort()
    );
  });
});
