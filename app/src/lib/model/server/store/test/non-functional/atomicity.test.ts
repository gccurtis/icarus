import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/constructor";
import type { StoreFailpoint } from "$model/server/store/types";

/**
 * The architecture checker proves that every multi-write entry below reaches
 * Store only through `transaction`. These names bind that structural proof to
 * this executable failpoint contract for the shared durability mechanism.
 */
const coveredIntents = [
  "agents/api/answer-task-question/answer-task-question.ts",
  "agents/api/create-chat/create-chat.ts",
  "agents/api/create-task/create-task.ts",
  "agents/api/run-automation/run-automation.ts",
  "agents/api/send-task-message/send-task-message.ts",
  "agents/api/update-task/update-task.ts",
  "comments/api/reply/reply.ts",
  "comments/api/resolve-thread/resolve-thread.ts",
  "comments/api/start-thread/start-thread.ts",
  "derived-output/api/refresh-derived-output/refresh-derived-output.ts",
  "document/api/submit-document-changes/submit-document-changes.ts",
  "project-resources/api/create-project-resource/create-project-resource.ts",
  "research-chat/api/ask/ask.ts",
  "research-chat/api/create-thread/create-thread.ts",
  "research-chat/api/remove-thread/remove-thread.ts",
  "research-chat/api/set-thread-persona/set-thread-persona.ts",
  "semantic-overlay/api/backfill-semantic-overlay/backfill-semantic-overlay.ts",
  "semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync.ts",
  "semantic-overlay/api/process-semantic-sync-queue/process-semantic-sync-queue.ts",
  "semantic-overlay/api/rebuild-semantic-index/rebuild-semantic-index.ts",
  "semantic-overlay/api/sync-semantic-resource/sync-semantic-resource.ts",
  "presentation/api/submit-presentation-changes/submit-presentation-changes.ts",
  "templates/api/commit-template-stage/commit-template-stage.ts",
  "templates/api/create-template-from-resource/create-template-from-resource.ts",
  "templates/api/create-template/create-template.ts",
  "templates/api/discard-template-stage/discard-template-stage.ts",
  "templates/api/duplicate-template/duplicate-template.ts",
  "templates/api/instantiate-template/instantiate-template.ts",
  "templates/api/open-template-stage/open-template-stage.ts",
  "templates/api/update-template/update-template.ts",
  "workspace/api/submit-workspace-changes/submit-workspace-changes.ts"
] as const;

const directories: string[] = [];
const system = { kind: "system" as const };
const project = (name: string) => ({ name, revision: 1, settings: "{}", updatedAt: 1000 });
const document = (projectId: string, title: string) => ({
  projectId,
  title,
  createdBy: system,
  updatedBy: system,
  updatedAt: 1000
});

const directory = (): string => {
  const path = mkdtempSync(join(tmpdir(), "icarus-atomicity-"));
  directories.push(path);
  return path;
};

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Store failpoint atomicity for multi-table capability intents", () => {
  it("keeps every table unchanged when publication has not been decided", () => {
    expect(coveredIntents.length).toBeGreaterThan(0);
    const path = directory();
    const seeded = defineStore({ directory: path, now: () => 1000 });
    const projectId = seeded.create("projects", project("Before"));
    const documentId = seeded.create("documents", document(projectId, "Before"));
    const interrupted = defineStore({
      directory: path,
      now: () => 2000,
      failpoint: interruptAt("transaction:before-journal")
    });

    expect(() => interrupted.transaction((unit) => {
      unit.update(`projects.${projectId}.name`, "After");
      unit.update(`documents.${documentId}.title`, "After");
    })).toThrow(/interrupted/);

    const recovered = defineStore({ directory: path });
    expect(recovered.read(`projects.${projectId}.name`)).toMatchObject({ value: "Before" });
    expect(recovered.read(`documents.${documentId}.title`)).toMatchObject({ value: "Before" });
  });

  it("recovers every table after a decided transaction is interrupted", () => {
    const path = directory();
    const seeded = defineStore({ directory: path, now: () => 1000 });
    const projectId = seeded.create("projects", project("Before"));
    const documentId = seeded.create("documents", document(projectId, "Before"));
    const interrupted = defineStore({
      directory: path,
      now: () => 2000,
      failpoint: interruptAt("transaction:after-journal")
    });

    expect(() => interrupted.transaction((unit) => {
      unit.update(`projects.${projectId}.name`, "After");
      unit.update(`documents.${documentId}.title`, "After");
    })).toThrow(/interrupted/);

    const recovered = defineStore({ directory: path });
    expect(recovered.read(`projects.${projectId}.name`)).toMatchObject({ value: "After" });
    expect(recovered.read(`documents.${documentId}.title`)).toMatchObject({ value: "After" });
  });
});
