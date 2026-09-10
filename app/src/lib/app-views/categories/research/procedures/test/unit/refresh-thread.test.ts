import { describe, expect, it, vi } from "vitest";

import { refreshThread } from "$app-views/categories/research/procedures/refresh-thread";

describe("research thread lifecycle refresh", () => {
  it("waits for the durable detail to be read again", async () => {
    const refresh = vi.fn(async () => ({ thread: { id: "researchThreads:1" } }));

    const outcome = await refreshThread({
      detail: { refresh },
      current: () => true,
      hasRunningTurn: () => false,
      pendingFlight: () => undefined
    });

    expect(outcome).toEqual({ state: "refreshed" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("retries an immediate remount until the pending Send is durably visible", async () => {
    let running = false;
    let finishFlight!: () => void;
    const flight = new Promise<void>((resolve) => {
      finishFlight = resolve;
    });
    const refresh = vi.fn(async () => undefined);

    const outcome = await refreshThread({
      detail: { refresh },
      current: () => true,
      hasRunningTurn: () => running,
      pendingFlight: () => flight,
      waitForRetry: async () => {
        running = true;
      }
    });

    expect(outcome).toEqual({ state: "refreshed" });
    expect(refresh).toHaveBeenCalledTimes(2);
    finishFlight();
  });

  it("classifies a rejected read by the thread identity still on screen", async () => {
    const failure = new Error("detail unavailable");
    let current = true;
    let rejectRefresh!: (error: Error) => void;
    const refresh = new Promise<never>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    const pending = refreshThread({
      detail: { refresh: () => refresh },
      current: () => current,
      hasRunningTurn: () => false,
      pendingFlight: () => undefined
    });

    current = false;
    rejectRefresh(failure);

    await expect(pending).resolves.toEqual({ state: "stale" });
  });

  it("does not apply a successful read after an immediate thread switch", async () => {
    let current = true;
    let finishRefresh!: () => void;
    const refresh = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const pending = refreshThread({
      detail: { refresh: () => refresh },
      current: () => current,
      hasRunningTurn: () => false,
      pendingFlight: () => undefined
    });

    current = false;
    finishRefresh();

    await expect(pending).resolves.toEqual({ state: "stale" });
  });

  it("returns a current lifecycle failure so a later remount can retry", async () => {
    const failure = new Error("detail unavailable");
    const failed = await refreshThread({
      detail: {
        refresh: async () => {
          throw failure;
        }
      },
      current: () => true,
      hasRunningTurn: () => false,
      pendingFlight: () => undefined
    });
    const retried = await refreshThread({
      detail: { refresh: async () => undefined },
      current: () => true,
      hasRunningTurn: () => false,
      pendingFlight: () => undefined
    });

    expect(failed).toEqual({ state: "failed", error: failure });
    expect(retried).toEqual({ state: "refreshed" });
  });
});
