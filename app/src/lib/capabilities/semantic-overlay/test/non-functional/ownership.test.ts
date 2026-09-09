import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  backfillSemanticOverlay: "../../api/backfill-semantic-overlay/backfill-semantic-overlay.ts",
  enqueueSemanticSync: "../../api/enqueue-semantic-sync/enqueue-semantic-sync.ts",
  processSemanticSyncQueue:
    "../../api/process-semantic-sync-queue/process-semantic-sync-queue.ts",
  rebuildSemanticIndex: "../../api/rebuild-semantic-index/rebuild-semantic-index.ts",
  syncSemanticResource: "../../api/sync-semantic-resource/sync-semantic-resource.ts"
} as const;

describe("cross-project Semantic Overlay ownership", () => {
  test("backfillSemanticOverlay, enqueueSemanticSync, processSemanticSyncQueue, rebuildSemanticIndex, and syncSemanticResource publish only inside the request project", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toContain("scope.projectId");
    }
  });
});
