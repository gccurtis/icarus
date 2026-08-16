import { describe, expect, it } from "vitest";
import {
  findingSourceValidator,
  findingSources,
  findingTitle,
  type FindingSource
} from "$findings/types/finding";
import { resourceTypeValidator } from "$revisions/types/change";
import { resourceKindValidator } from "$shared/types/resource";

/** `fields` differs per member, so read it as a bag rather than narrowing five ways. */
const source = (kind: string) => {
  const member = findingSourceValidator.members.find((m) => m.fields.kind.value === kind);
  return member!.fields as Record<string, { isOptional: string }>;
};

const refusal = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return (error as { data?: unknown }).data;
  }
};

describe("findingSourceValidator", () => {
  it("admits every way a finding can point at what it read", () => {
    const kinds = findingSourceValidator.members.map((m) => m.fields.kind.value).sort();

    expect(kinds).toEqual(["file", "manual", "message", "resource", "url"]);
  });

  it("names both the resource type and its id, because the pair is the key", () => {
    // Two resources of different kinds may carry the same id.
    expect(Object.keys(source("resource")).sort()).toEqual(
      ["kind", "resourceType", "resourceId", "locator"].sort()
    );
    expect(source("resource").resourceType).toBe(resourceTypeValidator);
  });

  it("requires a url source to say when it was read", () => {
    // The excerpt beside it is a copy, and a copy with no date is a copy of
    // nothing in particular.
    expect(source("url").capturedAt.isOptional).toBe("required");
    expect(source("url").excerpt.isOptional).toBe("optional");
  });

  it("names both tables a promoted message came from", () => {
    // A thread and a turn within it. Both tables exist now, so the ids are ids:
    // a citation cannot be built out of a string from somewhere else.
    const message = source("message") as unknown as Record<string, { tableName: string }>;

    expect(message.threadId.tableName).toBe("researchThreads");
    expect(message.messageId.tableName).toBe("messages");
  });

  it("gives a manual source a note and nothing to point at", () => {
    // A conversation, a phone call, prior knowledge — cited without a fake URL.
    expect(Object.keys(source("manual")).sort()).toEqual(["kind", "note"]);
  });

  it("lets a file source carry the passage and where in the file it sat", () => {
    expect(Object.keys(source("file")).sort()).toEqual(
      ["kind", "fileId", "locator", "excerpt"].sort()
    );
  });
});

describe("a finding is a resource kind", () => {
  it("can be scoped to and indexed, unlike a question or a hypothesis", () => {
    expect(resourceKindValidator.members.map((m) => m.value)).toContain("finding");
  });

  it("is no general resource, so it has no change sets to replay", () => {
    expect(resourceTypeValidator.members.map((m) => m.value)).not.toContain("finding");
  });
});

describe("findingTitle", () => {
  it("trims, because a title is what every list and link renders", () => {
    expect(findingTitle("  Margin fell on input costs  ")).toBe("Margin fell on input costs");
  });

  it("refuses a finding that establishes nothing anyone can read", () => {
    expect(refusal(() => findingTitle("   "))).toMatchObject({ code: "empty-title" });
  });
});

describe("findingSources", () => {
  const captured: FindingSource = {
    kind: "url",
    url: "https://example.test/report",
    title: "  Q3 report  ",
    excerpt: "  Margin fell 4 points  ",
    capturedAt: 1_700_000_000_000
  };

  it("keeps the excerpt and the capture time exactly as they were read", () => {
    // The excerpt is a copy, deliberately, not a live reference — normalizing it
    // would make it a copy of something nobody saw.
    expect(findingSources([captured])[0]).toEqual(captured);
  });

  it("trims what the author typed, which is not what the source said", () => {
    const [stored] = findingSources([{ kind: "manual", note: "  Call with the supplier  " }]);

    expect(stored).toEqual({ kind: "manual", note: "Call with the supplier" });
  });

  it("refuses a manual source that cites nothing", () => {
    expect(refusal(() => findingSources([{ kind: "manual", note: "  " }]))).toMatchObject({
      code: "empty-source"
    });
  });

  it("refuses a url source with no address to go back to", () => {
    expect(
      refusal(() => findingSources([{ ...captured, url: "  " }]))
    ).toMatchObject({ code: "empty-source" });
  });

  it("refuses a capture time that is not a moment", () => {
    // A zero would read as 1970 and quietly date every excerpt taken with it.
    expect(refusal(() => findingSources([{ ...captured, capturedAt: 0 }]))).toMatchObject({
      code: "source-captured-at"
    });
  });

  it("accepts a finding with no sources at all", () => {
    // A finding may rest on the writeup in front of you; what it may not do is
    // claim a source that points nowhere.
    expect(findingSources([])).toEqual([]);
  });
});
