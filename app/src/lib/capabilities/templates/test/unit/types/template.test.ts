import { describe, expect, it } from "vitest";
import { templatesRefusal } from "$templates/errors";
import { templateName } from "$templates/types/template";

describe("templateName", () => {
  it("stores a name as it will be read, not as it was typed", () => {
    expect(templateName("  Client report  ")).toBe("Client report");
  });

  it("refuses a template nobody could pick out of a list", () => {
    try {
      templateName("   ");
      expect.unreachable("an empty name is refused");
    } catch (error) {
      expect(templatesRefusal(error)).toMatchObject({ code: "empty-name" });
    }
  });
});
