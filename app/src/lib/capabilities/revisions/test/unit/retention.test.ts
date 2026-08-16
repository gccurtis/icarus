import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CONSOLIDATE_AFTER } from "$revisions/api/consolidate/consolidate";
import { REBASE_WINDOW } from "$revisions/api/submit/check";

/**
 * The retention numbers live in a YAML file a Convex isolate cannot read, so the
 * two that decide behaviour are mirrored in the code that uses them. This is what
 * makes the file still authoritative: edit it and this fails.
 */
const retention = parse(readFileSync("configuration/revisions.yaml", "utf8")) as {
  revisions: { resources: { rebaseWindow: number; consolidateAfter: number } };
};

describe("revision retention", () => {
  it("keeps consolidation inside the rebase window", () => {
    const { consolidateAfter, rebaseWindow } = retention.revisions.resources;

    // Above it, consolidation would fold sets the ladder still has to rebase
    // against, and pruning would then evict them.
    expect(consolidateAfter).toBeLessThan(rebaseWindow);
    expect(CONSOLIDATE_AFTER).toBeLessThan(REBASE_WINDOW);
  });

  it("mirrors the file the isolate cannot read", () => {
    expect(CONSOLIDATE_AFTER).toBe(retention.revisions.resources.consolidateAfter);
    expect(REBASE_WINDOW).toBe(retention.revisions.resources.rebaseWindow);
  });
});
