import type { Component } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { centreFailureFor } from "$surfaces/content/procedures/centre-failure-for";
import { settleCentreLoad } from "$surfaces/content/procedures/settle-centre-load";

const component = (() => undefined) as unknown as Component;

describe("content centre settlement", () => {
  it("reports a current rejection under the path which produced it", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();
    await settleCentreLoad(
      async () => {
        throw new Error("centre chunk failed");
      },
      "/content/current.svelte",
      { current: () => true, loaded, failed }
    );

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      "Error: centre chunk failed",
      "/content/current.svelte"
    );
  });

  it("retires both resolution and rejection after the route changes", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();
    let current = true;
    let resolve!: (module: { default: Component }) => void;
    const resolving = settleCentreLoad(
      () => new Promise<{ default: Component }>((done) => (resolve = done)),
      "/content/old.svelte",
      { current: () => current, loaded, failed }
    );

    current = false;
    resolve({ default: component });
    await resolving;

    current = true;
    let reject!: (reason: unknown) => void;
    const rejecting = settleCentreLoad(
      () => new Promise<{ default: Component }>((_done, fail) => (reject = fail)),
      "/content/old.svelte",
      { current: () => current, loaded, failed }
    );
    current = false;
    reject(new Error("old failure"));
    await rejecting;

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it("does not present a retained failure beneath another route", () => {
    const failure = { path: "/content/old.svelte", reason: "old failure" };
    expect(centreFailureFor(failure, "/content/new.svelte")).toBeUndefined();
    expect(centreFailureFor(failure, failure.path)).toBe(failure);
  });
});
