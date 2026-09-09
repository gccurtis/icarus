import { describe, expect, it } from "vitest";

import { run, type Working } from "$app-views/categories/agents/procedures/run";

const surface = (): Working => ({ mounted: true, busy: undefined, failure: undefined });

const settled = () => {
  let release: (value: { accepted: boolean }) => void = () => {};
  const promise = new Promise<{ accepted: boolean }>((resolve) => (release = resolve));
  return { promise, release };
};

describe("run", () => {
  it("names what is in flight and clears it when the write lands", async () => {
    const state = surface();
    const gate = settled();
    const running = run(state, "save", () => gate.promise);

    expect(state.busy).toBe("save");
    expect(state.failure).toBeUndefined();

    gate.release({ accepted: true });
    await running;

    expect(state.busy).toBeUndefined();
    expect(state.failure).toBeUndefined();
  });

  it("refuses a second press while the first is still in flight", async () => {
    const state = surface();
    const gate = settled();
    let calls = 0;
    const first = run(state, "save", () => {
      calls += 1;
      return gate.promise;
    });
    await run(state, "save", () => {
      calls += 1;
      return Promise.resolve({ accepted: true });
    });

    expect(calls).toBe(1);
    gate.release({ accepted: true });
    await first;
    expect(calls).toBe(1);
  });

  it("shows a refusal's own words rather than a generic failure", async () => {
    const state = surface();
    await run(state, "delete", () =>
      Promise.resolve({ accepted: false, detail: "it has fired tasks that still name it" })
    );

    expect(state.failure).toBe("it has fired tasks that still name it");
    expect(state.busy).toBeUndefined();
  });

  it("says something even when a refusal carries no detail", async () => {
    const state = surface();
    await run(state, "delete", () => Promise.resolve({ accepted: false }));

    expect(state.failure).toBe("That did not go through.");
  });

  it("turns a thrown error into the same failure a refusal produces", async () => {
    const state = surface();
    await run(state, "save", () => Promise.reject(new Error("the network went away")));

    expect(state.failure).toBe("the network went away");
    expect(state.busy).toBeUndefined();
  });

  it("runs the follow-up only when the write was accepted", async () => {
    const state = surface();
    const opened: string[] = [];

    await run(
      state,
      "create",
      () => Promise.resolve({ accepted: true, id: "personas:7" }),
      (made) => opened.push(made.id)
    );
    await run(
      state,
      "create",
      () => Promise.resolve({ accepted: false as const, detail: "no" }),
      () => opened.push("should not happen")
    );

    expect(opened).toEqual(["personas:7"]);
  });

  it("writes nothing back to a surface that has gone", async () => {
    const state = surface();
    const gate = settled();
    const running = run(state, "save", () => gate.promise, () => {
      throw new Error("the follow-up must not run either");
    });

    state.mounted = false;
    gate.release({ accepted: true });
    await running;

    // Left as it was when the surface went, rather than reset behind its back.
    expect(state.busy).toBe("save");
    expect(state.failure).toBeUndefined();
  });

  it("does not report a failure to a surface that has gone", async () => {
    const state = surface();
    const gate = settled();
    const running = run(state, "save", () =>
      gate.promise.then(() => {
        throw new Error("too late");
      })
    );

    state.mounted = false;
    gate.release({ accepted: true });
    await running;

    expect(state.failure).toBeUndefined();
  });

  it("clears the last failure when the next attempt starts", async () => {
    const state = surface();
    await run(state, "save", () => Promise.resolve({ accepted: false, detail: "stale" }));
    expect(state.failure).toBe("stale");

    await run(state, "save", () => Promise.resolve({ accepted: true }));
    expect(state.failure).toBeUndefined();
  });
});
