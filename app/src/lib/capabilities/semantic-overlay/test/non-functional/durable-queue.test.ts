import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineStore, type StoreFailpoint, type StoreModel } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { processDurableSemanticQueue } from "$capabilities/semantic-overlay/api/shared/durable-queue";
import { enqueueMaterialSyncFor } from "$capabilities/semantic-overlay/api/shared/material-queue";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";

type QueueTable = "semanticSyncJobs" | "semanticMaterialJobs";
type QueueRow = {
  _id: string;
  projectId: string;
  ref: { kind: string; id: string };
  requestedRevision: number;
  state: string;
  attempts: number;
  error?: string;
  force?: boolean;
  claimId?: string;
  leaseExpiresAt?: number;
  queuedAt?: number;
  startedAt?: number;
  updatedAt?: number;
};

const projectId = "projects:queue" as Id<"projects">;
const ref: ResourceRef = { kind: "document", id: "documents:queue" as Id<"documents"> };
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
  ref,
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
  run: Parameters<typeof processDurableSemanticQueue>[0]["run"],
  only?: ResourceRef,
  signal?: AbortSignal
) => processDurableSemanticQueue({
  model: modelOf(store),
  table,
  projectId,
  limit: 10,
  ...(only === undefined ? {} : { ref: only }),
  ...(signal === undefined ? {} : { signal }),
  run
});

const enqueue = (
  store: StoreModel,
  table: QueueTable,
  revision: number,
  force = false
): string => {
  const model = semanticUnitModel(modelOf(store), store);
  return table === "semanticSyncJobs"
    ? enqueueSemanticSyncFor(model, projectId, ref, revision, force)
    : enqueueMaterialSyncFor(model, projectId, ref, revision, force);
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe.each([
  "semanticSyncJobs",
  "semanticMaterialJobs"
] as const)("durable %s processing", (table) => {
  it("claims each queued job only when its work is about to start", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const store = defineStore({ directory: directory() });
    seed(store, table);
    seed(store, table);
    const gate = deferred();
    let runs = 0;
    const active = process(store, table, async (job) => {
      runs += 1;
      if (runs === 1) await gate.promise;
      return { outcome: "published" as const, revision: job.requestedRevision };
    });

    expect(runs).toBe(1);
    expect(rowsIn(store, table).filter((row) => row.state === "running")).toHaveLength(1);
    expect(rowsIn(store, table).filter((row) => row.state === "queued")).toHaveLength(1);

    gate.resolve();
    await expect(active).resolves.toMatchObject({ remaining: 0, failed: [] });
    expect(runs).toBe(2);
    expect(rowsIn(store, table)).toEqual([]);
  });

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

  it("renews a live claim while provider work is still running", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(clock);
    const store = defineStore({ directory: directory() });
    seed(store, table);
    const gate = deferred();
    const first = process(store, table, async (job) => {
      await gate.promise;
      return { outcome: "published" as const, revision: job.requestedRevision };
    });

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
    const second = await process(store, table, async () => {
      throw new Error("a live worker's renewed claim must not be stolen");
    });

    expect(second).toMatchObject({ processed: [], remaining: 1, failed: [] });
    gate.resolve();
    await expect(first).resolves.toMatchObject({ remaining: 0, failed: [] });
    expect(rowsIn(store, table)).toEqual([]);
  });

  it("returns an interrupted provider claim without spending an attempt", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    const store = defineStore({ directory: directory() });
    seed(store, table);
    const controller = new AbortController();
    let entered!: () => void;
    const running = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const active = process(
      store,
      table,
      async () => {
        entered();
        await new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true }
          );
        });
        throw new Error("unreachable");
      },
      undefined,
      controller.signal
    );
    await running;

    controller.abort();
    await expect(active).rejects.toMatchObject({ name: "AbortError" });

    expect(rowsIn(store, table)).toMatchObject([
      {
        state: "queued",
        attempts: 0
      }
    ]);
    expect(rowsIn(store, table)[0].claimId).toBeUndefined();
    expect(rowsIn(store, table)[0].leaseExpiresAt).toBeUndefined();
  });

  it("prevents an expired owner from publishing after another worker takes the claim", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const store = defineStore({ directory: directory() });
    seed(store, table);
    const oldWorker = deferred();
    const newWorker = deferred();
    let oldPublished = false;
    const first = process(store, table, async (job, assertClaim) => {
      await oldWorker.promise;
      store.transaction((unit) => {
        assertClaim(unit);
        oldPublished = true;
      });
      return { outcome: "published" as const, revision: job.requestedRevision };
    });

    clock += 5 * 60_000 + 1;
    const second = process(store, table, async (job) => {
      await newWorker.promise;
      return { outcome: "published" as const, revision: job.requestedRevision };
    });
    oldWorker.resolve();
    const lost = await first;

    expect(oldPublished).toBe(false);
    expect(lost.processed[0].retrying).toMatch(/lost its durable claim/);
    expect(rowsIn(store, table)[0]).toMatchObject({ state: "running", attempts: 2 });

    newWorker.resolve();
    await expect(second).resolves.toMatchObject({ remaining: 0, failed: [] });
    expect(rowsIn(store, table)).toEqual([]);
  });

  it("reclaims an expired lease but leaves a live lease alone", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const store = defineStore({ directory: directory() });
    seed(store, table, {
      state: "running",
      attempts: 1,
      claimId: "old-worker",
      startedAt: clock,
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

  it("claims and accounts for only the requested resource", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    const store = defineStore({ directory: directory() });
    const wanted: ResourceRef = {
      kind: "document",
      id: "documents:wanted" as Id<"documents">
    };
    const unrelated: ResourceRef = {
      kind: "document",
      id: "documents:unrelated" as Id<"documents">
    };
    seed(store, table, { ref: wanted });
    seed(store, table, { ref: unrelated });
    seed(store, table, {
      ref: unrelated,
      state: "failed",
      attempts: 3,
      error: "Unrelated terminal failure"
    });

    const result = await process(
      store,
      table,
      async (job) => ({ outcome: "published" as const, revision: job.requestedRevision }),
      wanted
    );

    expect(result.processed.map((entry) => entry.ref)).toEqual([wanted]);
    expect(result).toMatchObject({ remaining: 0, failed: [] });
    expect(rowsIn(store, table)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: unrelated, state: "queued" }),
        expect.objectContaining({ ref: unrelated, state: "failed" })
      ])
    );
  });

  it("keeps a terminal same-revision failure quarantined until revision or force changes", () => {
    vi.spyOn(Date, "now").mockImplementation(() => clock++);
    const store = defineStore({ directory: directory() });
    seed(store, table, {
      state: "failed",
      attempts: 3,
      error: "projection failed"
    });
    const terminal = structuredClone(rowsIn(store, table));

    enqueue(store, table, 1);

    expect(rowsIn(store, table)).toEqual(terminal);

    enqueue(store, table, 2);

    expect(rowsIn(store, table)[0]).toMatchObject({
      requestedRevision: 2,
      state: "queued",
      attempts: 0
    });
    expect(rowsIn(store, table)[0]).not.toHaveProperty("error");
    expect(rowsIn(store, table)[0]).not.toHaveProperty("claimId");
    expect(rowsIn(store, table)[0]).not.toHaveProperty("leaseExpiresAt");
    expect(rowsIn(store, table)[0]).not.toHaveProperty("startedAt");

    const forced = defineStore({ directory: directory() });
    seed(forced, table, {
      state: "failed",
      attempts: 3,
      error: "projection failed"
    });

    enqueue(forced, table, 1, true);

    expect(rowsIn(forced, table)[0]).toMatchObject({
      requestedRevision: 1,
      state: "queued",
      attempts: 0,
      force: true
    });
    expect(rowsIn(forced, table)[0]).not.toHaveProperty("error");
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
