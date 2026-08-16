import { describe, expect, it } from "vitest";
import { accessTables } from "$access/schema";

/**
 * `access` was built before the data models were written, and the two disagreed
 * six ways. Each side won three, and the field sets are asserted exactly rather
 * than by presence so a field that drifts back in fails here — the settlement is
 * only worth having if it stays settled.
 */
describe("access schema after reconciliation", () => {
  it("names the identity claim authSubject", () => {
    expect(accessTables.users.validator.fields).toHaveProperty("authSubject");
    expect(accessTables.users.validator.fields).not.toHaveProperty("subject");
  });

  it("keeps displayName, because identity is authSubject", () => {
    expect(accessTables.users.validator.fields).toHaveProperty("displayName");
  });

  it("carries contact fields so a member list needs no provider call", () => {
    const fields = Object.keys(accessTables.users.validator.fields).sort();
    expect(fields).toEqual(
      ["authSubject", "displayName", "email", "imageUrl", "lastSeenAt", "updatedAt"].sort()
    );
  });

  it("keeps membership in its own table and off the project", () => {
    expect(accessTables.projects.validator.fields).not.toHaveProperty("members");
    expect(accessTables.projects.validator.fields).not.toHaveProperty("ownerId");
    expect(accessTables.memberships).toBeDefined();
  });

  it("gives projects archival and a revision", () => {
    const fields = Object.keys(accessTables.projects.validator.fields).sort();
    expect(fields).toEqual(
      ["archivedAt", "description", "name", "revision", "updatedAt"].sort()
    );
  });
});
