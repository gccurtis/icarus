import { describe, expect, it } from "vitest";
import { personaThreadsRefusal } from "$persona-threads/errors";
import { personaThreadTitle } from "$persona-threads/types/persona-thread";

describe("personaThreadTitle", () => {
  it("trims, because the title is what every list renders", () => {
    expect(personaThreadTitle("  Q3 margin  ")).toBe("Q3 margin");
  });

  it("refuses a thread nobody can pick out of a list", () => {
    // No message is loaded to render a chat in a list, so a title of spaces is a
    // row with nothing to show for it.
    try {
      personaThreadTitle("   ");
      expect.unreachable();
    } catch (error: unknown) {
      expect(personaThreadsRefusal(error)).toMatchObject({ code: "empty-title" });
    }
  });
});
