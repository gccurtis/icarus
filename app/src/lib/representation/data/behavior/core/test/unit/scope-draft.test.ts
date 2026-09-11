import { describe, expect, it } from "vitest";

import type { ResourceSet } from "$representation/data/types/core/resource-set";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import {
  builderView,
  closesLoop,
  draftOf,
  heldAnywhere,
  isWholeProject,
  needsRow,
  narrowed,
  ruleWords,
  selectedBy,
  templated,
  termFor,
  termKey,
  withTerm,
  withWholeProject,
  withoutTerm,
  type AnyTerm,
  type ScopeDraft
} from "$representation/data/behavior/core/scope-draft";

const resources = [
  { ...admitResourceRef({ id: "documents:1", kind: "document" }), name: "Winter readiness brief", relativePath: null },
  { ...admitResourceRef({ id: "documents:2", kind: "document" }), name: "Decision memo", relativePath: null },
  { ...admitResourceRef({ id: "presentations:1", kind: "presentation" }), name: "Board review", relativePath: null },
  { ...admitResourceRef({ id: "findings:1", kind: "finding" }), name: "Pump housing", relativePath: null }
];

const catalogue = resources.map((entry) => admitResourceRef({ kind: entry.kind, id: entry.id }));

const named = new Map<string, ResourceSet>([
  ["resourceSets:1", { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] }],
  ["resourceSets:2", { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] }]
]);

describe("a draft", () => {
  it("starts at the floor and says so", () => {
    const draft = draftOf(undefined);
    expect(isWholeProject(draft)).toBe(true);
    expect(ruleWords(draft)).toBe("Everything in the project");
    expect(needsRow(draft)).toBe(false);
  });

  it("replaces the include list when the whole project is added", () => {
    const narrow: ScopeDraft = { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] };
    const widened = withTerm(narrow, "include", { select: "project" });
    expect(widened.include).toHaveLength(1);
    expect(isWholeProject(widened)).toBe(true);
  });

  it("drops the whole project when something narrower is added beside it", () => {
    const narrowed = withTerm(withWholeProject(), "include", { select: "kinds", kinds: ["presentation"] });
    expect(narrowed.include).toHaveLength(1);
    expect(ruleWords(narrowed)).toBe("Presentations");
  });

  it("never holds the same term twice, and removes by key", () => {
    const term: AnyTerm = { select: "kinds", kinds: ["document"] };
    const once = withTerm({ include: [], exclude: [] }, "include", term);
    expect(withTerm(once, "include", term).include).toHaveLength(1);
    expect(heldAnywhere(once, term)).toBe("include");
    expect(withoutTerm(once, "include", termKey(term)).include).toHaveLength(0);
  });

  it("reads a difference as one sentence", () => {
    const draft: ScopeDraft = {
      include: [
        { select: "kinds", kinds: ["document"] },
        { select: "set", setId: "resourceSets:1" as never }
      ],
      exclude: [{ select: "resources", refs: [admitResourceRef({ kind: "document", id: "documents:2" })] }]
    };
    expect(
      ruleWords(draft, {
        sets: new Map([["resourceSets:1", "Winter filings"]]),
        resources: new Map([["documents:2", "Decision memo"]])
      })
    ).toBe("Documents and Winter filings, minus Decision memo");
  });

  it("says nothing when nothing is included", () => {
    expect(ruleWords({ include: [], exclude: [] })).toBe("Nothing");
  });
});

describe("whether a rule needs a row", () => {
  it("does not for the project, for kinds, or for named sets", () => {
    expect(needsRow({ include: [{ select: "project" }], exclude: [] })).toBe(false);
    expect(needsRow({ include: [{ select: "kinds", kinds: ["document"] }], exclude: [] })).toBe(false);
    expect(needsRow({ include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] })).toBe(false);
  });

  it("does for anything excluded, because a difference cannot be substituted", () => {
    expect(
      needsRow({
        include: [{ select: "project" }],
        exclude: [{ select: "kinds", kinds: ["presentation"] }]
      })
    ).toBe(true);
  });

  it("does for a particular resource, which a template cannot name", () => {
    expect(
      needsRow({
        include: [{ select: "resources", refs: [admitResourceRef({ kind: "document", id: "documents:1" })] }],
        exclude: []
      })
    ).toBe(true);
  });
});

describe("the two doors out of a draft", () => {
  it("narrows to a concrete set when nothing names a hole", () => {
    const draft: ScopeDraft = {
      include: [{ select: "resources", refs: [admitResourceRef({ kind: "document", id: "documents:1" })] }],
      exclude: []
    };
    expect(narrowed(draft)).not.toBeUndefined();
    expect(templated(draft)).toBeUndefined();
  });

  it("stays templated when nothing names a resource", () => {
    const draft: ScopeDraft = { include: [{ select: "hole", name: "source_material" }], exclude: [] };
    expect(templated(draft)).not.toBeUndefined();
    expect(narrowed(draft)).toBeUndefined();
  });
});

describe("cycles", () => {
  it("refuses a set that is the one being edited", () => {
    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:1", named, "resourceSets:1")).toBe(true);
  });

  it("refuses a set that already reaches the one being edited", () => {
    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:2", named, "resourceSets:1")).toBe(true);
  });

  it("allows one that does not", () => {
    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:1", named, "resourceSets:9")).toBe(false);
  });
});

describe("what a draft selects", () => {
  it("counts the difference against the catalogue", () => {
    const draft: ScopeDraft = {
      include: [{ select: "project" }],
      exclude: [{ select: "kinds", kinds: ["presentation"] }]
    };
    expect(selectedBy(draft, catalogue, named).map((ref) => ref.id)).toEqual([
      "documents:1",
      "documents:2",
      "findings:1"
    ]);
  });

  it("counts a hole term as nothing, because what fills it is not known here", () => {
    const draft: ScopeDraft = { include: [{ select: "hole", name: "source" }], exclude: [] };
    expect(selectedBy(draft, catalogue, named)).toHaveLength(0);
  });
});

describe("the builder's view", () => {
  it("hands over rows, a sentence, a count and three sources", () => {
    const draft: ScopeDraft = {
      include: [{ select: "kinds", kinds: ["document"] }],
      exclude: [{ select: "resources", refs: [admitResourceRef({ kind: "document", id: "documents:2" })] }]
    };
    const view = builderView(draft, { resources, sets: [] });
    expect(view.whole).toBe(false);
    expect(view.include).toHaveLength(1);
    expect(view.exclude[0].words).toBe("Decision memo");
    expect(view.sentence).toBe("Documents, minus Decision memo");
    expect(view.count).toBe(1);
    expect(view.sources.map((source) => source.key)).toEqual(["kinds", "sets", "resources"]);
  });

  it("marks what the draft already holds, so nothing is offered twice", () => {
    const draft: ScopeDraft = { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] };
    const kinds = builderView(draft, { resources }).sources[0];
    expect(kinds.offers.find((offer) => offer.key === "document")?.held).toBe("include");
    expect(kinds.offers.find((offer) => offer.key === "presentation")?.held).toBeUndefined();
  });

  it("keeps duplicate External names distinct with their exact relative paths", () => {
    const north = {
      ...admitResourceRef({ kind: "externalFile::text", id: "externalFiles:north" }),
      name: "inspection.md",
      relativePath: "yard/north/inspection.md"
    };
    const south = {
      ...admitResourceRef({ kind: "externalFile::text", id: "externalFiles:south" }),
      name: "inspection.md",
      relativePath: "yard/south/inspection.md"
    };
    const draft: ScopeDraft = {
      include: [{
        select: "resources",
        refs: [admitResourceRef({ kind: north.kind, id: north.id })]
      }],
      exclude: []
    };
    const view = builderView(draft, { resources: [north, south] });
    const offers = view.sources.find((source) => source.key === "resources")?.offers ?? [];

    expect(offers.map(({ key, label, note }) => ({ key, label, note }))).toEqual([
      {
        key: "externalFile::text/externalFiles:north",
        label: "inspection.md",
        note: "yard/north/inspection.md"
      },
      {
        key: "externalFile::text/externalFiles:south",
        label: "inspection.md",
        note: "yard/south/inspection.md"
      }
    ]);
    expect(view.include[0].note).toBe("yard/north/inspection.md");
    expect(view.preview[0].note).toBe("yard/north/inspection.md");
  });

  it("turns an offer key back into the term it stands for", () => {
    expect(termFor("kinds", "document")).toEqual({ select: "kinds", kinds: ["document"] });
    expect(termFor("sets", "resourceSets:1")).toEqual({ select: "set", setId: "resourceSets:1" });
    expect(termFor("resources", "document/documents:1")).toEqual({
      select: "resources",
      refs: [{ kind: "document", id: "documents:1" }]
    });
  });
});
