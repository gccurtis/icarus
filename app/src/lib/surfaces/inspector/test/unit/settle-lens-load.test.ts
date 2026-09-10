import { describe, expect, it, vi } from "vitest";
import type { Component } from "svelte";

import { lensFailureFor } from "$surfaces/inspector/procedures/lens-failure-for";
import { settleLensLoad } from "$surfaces/inspector/procedures/settle-lens-load";

const component = (() => undefined) as unknown as Component;

describe("inspector lens settlement", () => {
  it("turns a current rejected import into an inspectable failure", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();

    await settleLensLoad(
      async () => {
        throw new Error("lens chunk failed");
      },
      "/inspector/current.svelte",
      { current: () => true, loaded, failed }
    );

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      "Error: lens chunk failed",
      "/inspector/current.svelte"
    );
  });

  it("retires a lens which settles after its route changed", async () => {
    let resolve!: (module: { default: Component }) => void;
    const loader = () => new Promise<{ default: Component }>((done) => (resolve = done));
    const loaded = vi.fn();
    const failed = vi.fn();
    let current = true;
    const settling = settleLensLoad(loader, "/inspector/old.svelte", {
      current: () => current,
      loaded,
      failed
    });

    current = false;
    resolve({ default: component });
    await settling;

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it("retires a rejected lens after its route changed", async () => {
    let reject!: (reason: unknown) => void;
    const loader = () => new Promise<{ default: Component }>((_done, fail) => (reject = fail));
    const loaded = vi.fn();
    const failed = vi.fn();
    let current = true;
    const settling = settleLensLoad(loader, "/inspector/old.svelte", {
      current: () => current,
      loaded,
      failed
    });

    current = false;
    reject(new Error("old failure"));
    await settling;

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it("does not present a retained failure beneath another route", () => {
    const failure = { path: "/inspector/old.svelte", reason: "old failure" };
    expect(lensFailureFor(failure, "/inspector/new.svelte")).toBeUndefined();
    expect(lensFailureFor(failure, failure.path)).toBe(failure);
  });
});
