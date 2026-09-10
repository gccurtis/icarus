import { describe, expect, it, vi } from "vitest";
import type { Component } from "svelte";

import { contextFailureFor } from "$surfaces/context/procedures/context-failure-for";
import { settleContextLoad } from "$surfaces/context/procedures/settle-context-load";

const component = (() => undefined) as unknown as Component;

describe("context module settlement", () => {
  it("turns a current rejected import into an inspectable failure", async () => {
    const loaded = vi.fn();
    const failed = vi.fn();

    await settleContextLoad(
      async () => {
        throw new Error("context chunk failed");
      },
      "/context/current.svelte",
      { current: () => true, loaded, failed }
    );

    expect(loaded).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      "Error: context chunk failed",
      "/context/current.svelte"
    );
  });

  it("retires a module which settles after its route changed", async () => {
    let resolve!: (module: { default: Component }) => void;
    const loader = () => new Promise<{ default: Component }>((done) => (resolve = done));
    const loaded = vi.fn();
    const failed = vi.fn();
    let current = true;
    const settling = settleContextLoad(loader, "/context/old.svelte", {
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

  it("retires a rejected import after its route changed", async () => {
    let reject!: (reason: unknown) => void;
    const loader = () => new Promise<{ default: Component }>((_done, fail) => (reject = fail));
    const loaded = vi.fn();
    const failed = vi.fn();
    let current = true;
    const settling = settleContextLoad(loader, "/context/old.svelte", {
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
    const failure = { path: "/context/old.svelte", reason: "old failure" };
    expect(contextFailureFor(failure, "/context/new.svelte")).toBeUndefined();
    expect(contextFailureFor(failure, failure.path)).toBe(failure);
  });
});
