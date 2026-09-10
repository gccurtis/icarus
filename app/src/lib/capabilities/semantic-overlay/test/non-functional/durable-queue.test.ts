import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineStore, type StoreFailpoint, type StoreModel } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { processDurableSemanticQueue } from "$capabilities/semantic-overlay/api/shared/durable-queue";

type QueueTable = "semanticSyncJobs" | "semanticMaterialJobs";
type QueueRow = {
  _id: string;
  requestedRevision: number;
  state: string;
  attempts: number;
  claimId?: string;
  leaseExpiresAt?: number;
};

const projectId = "projects:queue" as Id<"projects">;
const directories: string[] = [];
let clock = 1_000;

const directory = (): string => {
  const made = mkdtempSync(join(tmpdir(), "icarus-semantic-queue-"));
  directories.push(made);
  return made;
};

const modelOf = (store: StoreModel): ServerModel => ({ store } as ServerModel);

const rowsIn = (store: StoreModel, table: QueueTable): readonly QueueRow[] => {
  const found = store.read(table);
  return found?.kind === "table" ? found.rows as unknown as readonly QueueRow[] : [];
};

const seed = (
  store: StoreModel,
  table: QueueTable,
  fields: Partial<QueueRow> = {}
): string => store.create(table, {
  projectId,
  ref: { kind: "document", id: "documents:queue" },
  requestedRevision: 1,
  state: "queued",
  attempts: 0,
  queuedAt: clock,
  updatedAt: clock,
  ...fields
});

const process = (
  store: StoreModel,
  table: QueueTable,
  run: Parameters<typeof processDurableSemanticQueue>[0]["run"]
) => processDurableSemanticQueue({
  model: modelOf(store),
  table,
  projectId,
  limit: 10,
  run
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe.each([
  "semanticSyncJobs",
  "semanticMaterialJobs"
] as const)("durable %s processing", (table) => {
  it("lets only one concurrent worker own an unexpired claim", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const store = defineStore({ directory: directory() });
    seed(store, table);
    const gate = deferred();
    let runs = 0;
    const first = process(store, table, async (job) => {
      runs += 1;
      await gate.promise;
      return { outcome: "published" as const, revision: job.requestedRevision };
    });

    const second = await process(store, table, async () => {
      throw new Error("a second worker must not run");
    });

    expect(runs).toBe(1);
    expect(second.processed).toEqual([]);
    expect(second.remaining).toBe(1);
    gate.resolve();
    await expect(first).resolves.toMatchObject({ remaining: 0, failed: [] });
    expect(rowsIn(store, table)).toEqual([]);
  });

  it("reclaims an expired lease but leaves a live lease alone", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const store = defineStore({ directory: directory() });
    seed(store, table, {
      state: "running",
      attempts: 1,
      claimId: "old-worker",
      leaseExpiresAt: clock + 100
    });

    const live = await process(store, table, async () => {
      throw new Error("the live lease must not be stolen");
    });
    expect(live).toMatchObject({ processed: [], remaining: 1, failed: [] });

    clock += 101;
    const reclaimed = await process(store, table, async (job) => ({
      outcome: "published" as const,
      revision: job.requestedRevision
    }));
    expect(reclaimed.processed).toHaveLength(1);
    expect(reclaimed.remaining).toBe(0);
    expect(rowsIn(store, table)).toEqual([]);
  });

  it("bounds retries and leaves a terminal failure visible", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    const store = defineStore({ directory: directory() });
    seed(store, table);

    const one = await process(store, table, async () => { throw new Error("provider unavailable"); });
    const two = await process(store, table, async () => { throw new Error("provider unavailable"); });
    const three = await process(store, table, async () => { throw new Error("provider unavailable"); });

    expect(one.processed[0].retrying).toMatch(/provider unavailable/);
    expect(two.processed[0].retrying).toMatch(/provider unavailable/);
    expect(three.processed[0].error).toMatch(/provider unavailable/);
    expect(three).toMatchObject({ remaining: 0 });
    expect(three.failed).toHaveLength(1);
    expect(rowsIn(store, table)[0]).toMatchObject({ state: "failed", attempts: 3 });
  });

  it("requeues a newer revision without spending its retry budget", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    const store = defineStore({ directory: directory() });
    const jobId = seed(store, table);
    const gate = deferred();
    const first = process(store, table, async () => {
      await gate.promise;
      return { outcome: "published" as const, revision: 1 };
    });
    store.update(`${table}.${jobId}.requestedRevision`, 2);
    gate.resolve();
    await first;

    expect(rowsIn(store, table)[0]).toMatchObject({
      requestedRevision: 2,
      state: "queued",
      attempts: 0
    });
    const second = await process(store, table, async (job) => ({
      outcome: "published" as const,
      revision: job.requestedRevision
    }));
    expect(second.remaining).toBe(0);
    expect(rowsIn(store, table)).toEqual([]);
  });
});

it("recovers an interrupted durable claim after restart and lease expiry", async () => {
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const path = directory();
  const seeded = defineStore({ directory: path });
  seed(seeded, "semanticSyncJobs");
  const interrupt = (point: StoreFailpoint): void => {
    if (point === "transaction:after-journal") throw new Error("worker process stopped");
  };
  const interrupted = defineStore({ directory: path, failpoint: interrupt });

  await expect(process(interrupted, "semanticSyncJobs", async () => ({
    outcome: "published" as const,
    revision: 1
  }))).rejects.toThrow(/worker process stopped/);

  const restarted = defineStore({ directory: path });
  const claimed = rowsIn(restarted, "semanticSyncJobs")[0];
  expect(claimed).toMatchObject({ state: "running", attempts: 1 });
  expect(claimed.claimId).toBeTruthy();
  clock = (claimed.leaseExpiresAt ?? clock) + 1;
  const recovered = await process(restarted, "semanticSyncJobs", async (job) => ({
    outcome: "published" as const,
    revision: job.requestedRevision
  }));
  expect(recovered.remaining).toBe(0);
  expect(rowsIn(restarted, "semanticSyncJobs")).toEqual([]);
});
