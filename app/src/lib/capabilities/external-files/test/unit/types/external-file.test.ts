import { describe, expect, it } from "vitest";
import { externalFilesRefusal } from "$external-files/errors";
import {
  fileName,
  originFrom,
  pendingExtraction,
  type FileOrigin
} from "$external-files/types/external-file";
import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";

const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return externalFilesRefusal(error);
  }
};

const person: Actor = { kind: "user", userId: "users:1" as unknown as Id<"users"> };
const agent: Actor = { kind: "agent", taskId: "agentTasks:1" as Id<"agentTasks"> };

describe("fileName", () => {
  it("stores the name as it will be read", () => {
    expect(fileName("  Q3 forecast.xlsx  ")).toBe("Q3 forecast.xlsx");
  });

  it("refuses a file nobody can pick out of a list", () => {
    expect(refusalOf(() => fileName("   "))).toMatchObject({ code: "empty-name" });
  });
});

describe("originFrom", () => {
  /**
   * An agent cannot upload from nowhere — there is no source for it to upload
   * from. What it can do is produce a file, which is the `generated` case.
   */
  it("refuses an upload that came from no person", () => {
    expect(refusalOf(() => originFrom(agent, { kind: "upload" }))).toMatchObject({
      code: "upload-needs-user"
    });
  });

  it("keeps the four origins apart, each carrying what its answer needs", () => {
    const origins: FileOrigin[] = [
      { kind: "upload" },
      { kind: "connector", connectorId: "connectors:1", externalId: "drive-99" },
      { kind: "generated", agentTaskId: "agentTasks:1" as Id<"agentTasks"> },
      { kind: "capture", url: "https://example.com/report", capturedAt: 1_700_000_000_000 }
    ];

    expect(origins.map((origin) => originFrom(person, origin))).toEqual(origins);
  });

  it("lets an agent record the file it produced", () => {
    const task = "agentTasks:1" as Id<"agentTasks">;

    expect(originFrom(agent, { kind: "generated", agentTaskId: task })).toEqual({
      kind: "generated",
      agentTaskId: task
    });
  });
});

describe("pendingExtraction", () => {
  it("queues the kinds there is something to read out of", () => {
    for (const kind of ["ext-text", "ext-data", "ext-document", "ext-image"] as const) {
      expect(pendingExtraction(kind)).toEqual({ state: "pending" });
    }
  });

  it("queues nothing for a file we would only ever hand back", () => {
    for (const kind of ["ext-audio", "ext-video", "ext-archive", "ext-unknown"] as const) {
      expect(pendingExtraction(kind)).toBeUndefined();
    }
  });
});
