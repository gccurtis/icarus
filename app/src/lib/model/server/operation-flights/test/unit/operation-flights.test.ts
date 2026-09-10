import { describe, expect, it, vi } from "vitest";

import {
  createOperationFlights,
  OperationFlightsShutdownError
} from "$model/server/operation-flights/index.server";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("OperationFlights", () => {
  it("shares one derived promise and tracks the newest request key", async () => {
    const model = createOperationFlights();
    const gate = deferred<string>();
    let runs = 0;
    const first = model.shareDerived("output:1", "definition:1", async () => {
      runs += 1;
      return gate.promise;
    });
    const joined = model.shareDerived("output:1", "definition:1", async () => "wrong");

    expect(first.started).toBe(true);
    expect(joined.started).toBe(false);
    expect(first.promise).toBe(joined.promise);
    model.updateDerivedRequestKey("output:1", "definition:2");
    expect(model.derivedRequestKey("output:1")).toBe("definition:2");

    gate.resolve("done");
    await expect(joined.promise).resolves.toBe("done");
    expect(runs).toBe(1);
    await Promise.resolve();
    expect(model.derivedRequestKey("output:1")).toBeUndefined();
  });

  it("gives research stop requests their two distinct meanings", () => {
    const model = createOperationFlights();
    const flight = model.beginResearch("turn:1");

    expect(flight.stopping()).toBe(false);
    expect(model.requestResearchStop("turn:1")).toBe("answering");
    expect(flight.stopping()).toBe(true);
    expect(flight.signal.aborted).toBe(false);
    expect(model.requestResearchStop("turn:1")).toBe("cancelled");
    expect(flight.signal.aborted).toBe(true);
    expect(flight.reason()).toBe("cancelled");
  });

  it("owns and clears a research deadline", () => {
    vi.useFakeTimers();
    try {
      const model = createOperationFlights();
      const flight = model.beginResearch("turn:deadline");
      model.armResearchDeadline("turn:deadline", 250);

      vi.advanceTimersByTime(250);

      expect(flight.signal.aborted).toBe(true);
      expect(flight.reason()).toBe("deadline");
      model.endResearch("turn:deadline");
      expect(model.isResearchActive("turn:deadline")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to replace an active research flight", () => {
    const model = createOperationFlights();
    const first = model.beginResearch("turn:duplicate");

    expect(() => model.beginResearch("turn:duplicate")).toThrow(/already active/);
    expect(model.research("turn:duplicate")?.signal).toBe(first.signal);

    model.endResearch("turn:duplicate");
  });

  it("aborts every owned controller and rejects new work at shutdown", async () => {
    const model = createOperationFlights();
    let derivedSignal: AbortSignal | undefined;
    const never = deferred<void>();
    const derived = model.shareDerived("output:shutdown", "definition:1", async (signal) => {
      derivedSignal = signal;
      await never.promise;
      return "late";
    });
    const research = model.beginResearch("turn:shutdown");
    await Promise.resolve();

    const closing = model.close();
    let closed = false;
    void closing.then(() => {
      closed = true;
    });

    expect(derivedSignal?.aborted).toBe(true);
    expect(derivedSignal?.reason).toBeInstanceOf(OperationFlightsShutdownError);
    expect(research.signal.aborted).toBe(true);
    expect(research.reason()).toBe("shutdown");
    expect(closed).toBe(false);
    expect(model.close()).toBe(closing);
    expect(() => model.beginResearch("turn:new")).toThrow(/closed/);
    expect(() => model.shareDerived("output:new", "definition:1", async () => "no"))
      .toThrow(/closed/);

    never.resolve();
    await derived.promise;
    await Promise.resolve();
    expect(closed).toBe(false);

    model.endResearch("turn:shutdown");
    await closing;
    expect(closed).toBe(true);
  });
});
