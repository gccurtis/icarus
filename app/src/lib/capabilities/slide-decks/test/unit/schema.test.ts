import { describe, expect, it } from "vitest";
import { slideDecksTables } from "$slide-decks/schema";

/**
 * The absences are the assertions, as they are for documents — plus one presence:
 * `aspectRatio` is the single piece of a deck's appearance that belongs on the
 * row rather than in the body.
 */
describe("slideDecks schema", () => {
  it("leads every index with projectId", () => {
    const indexes = slideDecksTables.slideDecks[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the metadata a list renders, and the shape a thumbnail needs", () => {
    const fields = Object.keys(slideDecksTables.slideDecks.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "title",
        "aspectRatio",
        "templateId",
        "createdBy",
        "updatedBy",
        "updatedAt"
      ].sort()
    );
  });

  it("admits the two shapes a deck is drawn at and nothing else", () => {
    const aspectRatio = slideDecksTables.slideDecks.validator.fields.aspectRatio;

    expect(aspectRatio.members.map((member) => member.value).sort()).toEqual(["16:9", "4:3"]);
  });

  it("keeps the body and the revision off the row", () => {
    const fields = slideDecksTables.slideDecks.validator.fields;

    expect(fields).not.toHaveProperty("slides");
    expect(fields).not.toHaveProperty("theme");
    expect(fields).not.toHaveProperty("revision");
  });
});
