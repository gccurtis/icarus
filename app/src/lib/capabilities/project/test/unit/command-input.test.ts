import { describe, expect, it } from "vitest";

import { validateReadProjectActivity } from "$capabilities/project/api/read-project-activity/validate-read-project-activity";
import { validateReadProjectComment } from "$capabilities/project/api/read-project-comment/validate-read-project-comment";
import { validateReadProjectHistory } from "$capabilities/project/api/read-project-history/validate-read-project-history";
import { validateReadProjectPerson } from "$capabilities/project/api/read-project-person/validate-read-project-person";
import { validateReadProjectResource } from "$capabilities/project/api/read-project-resource/validate-read-project-resource";
import { validateUpdateProjectResourceSummary } from "$capabilities/project/api/update-project-resource-summary/validate-update-project-resource-summary";

const history = () => ({ search: "", since: null, before: null, limit: 10 });

describe("Project command admission", () => {
  it("accepts the exact current inputs", () => {
    expect(validateReadProjectActivity({ activityId: "activity:1" })).toEqual({ activityId: "activity:1" });
    expect(validateReadProjectComment({ threadId: "commentThreads:1" })).toEqual({ threadId: "commentThreads:1" });
    expect(validateReadProjectPerson({ userId: "users:1" })).toEqual({ userId: "users:1" });
    expect(validateReadProjectResource({ resourceId: "documents:1" })).toEqual({ resourceId: "documents:1" });
    expect(validateReadProjectHistory(history())).toEqual(history());
    expect(validateUpdateProjectResourceSummary({ resourceId: "findings:1", summary: "  Context  " })).toEqual({
      resourceId: "findings:1",
      summary: "Context"
    });
  });

  it("requires nominal current identities rather than canonical-looking strings", () => {
    expect(() => validateReadProjectActivity({ activityId: "comments:1" })).toThrow(/activityId/);
    expect(() => validateReadProjectComment({ threadId: "threads:1" })).toThrow(/commentThreads/);
    expect(() => validateReadProjectPerson({ userId: "personas:1" })).toThrow(/users id/);
    expect(() => validateReadProjectResource({ resourceId: "externalFiles:1" })).toThrow(/resource id/);
    expect(() => validateUpdateProjectResourceSummary({ resourceId: "templates:1", summary: "x" })).toThrow(/resourceId/);
  });

  it("rejects compatibility projections and does not invoke accessors", () => {
    const inherited = Object.assign(Object.create({ retired: true }), history());
    expect(() => validateReadProjectHistory(inherited)).toThrow(/exact current data/);

    const hidden = history();
    Object.defineProperty(hidden, "retired", { enumerable: false, value: true });
    expect(() => validateReadProjectHistory(hidden)).toThrow(/exact current data/);

    const symbolic = history() as Record<PropertyKey, unknown>;
    symbolic[Symbol("retired")] = true;
    expect(() => validateReadProjectHistory(symbolic)).toThrow(/exact current data/);

    let reads = 0;
    const accessor = { since: null, before: null, limit: 10 } as Record<string, unknown>;
    Object.defineProperty(accessor, "search", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "";
      }
    });
    expect(() => validateReadProjectHistory(accessor)).toThrow(/exact current data/);
    expect(reads).toBe(0);

    expect(() => validateReadProjectActivity({ activityId: "activity:1", retired: undefined })).toThrow(
      /exact current/
    );
  });
});
