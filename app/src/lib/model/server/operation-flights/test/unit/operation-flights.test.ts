import { describe, expect, it, vi } from "vitest";

import {
  AgentTaskCancelledError,
  AgentTaskDeadlineError,
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

  it("shares one Agent task flight and stops it with an explicit reason", async () => {
    const model = createOperationFlights();
    let signal: AbortSignal | undefined;
    const first = model.runAgentTask("agentTasks:1", 60_000, async (held) => {
      signal = held;
      await new Promise<void>((_resolve, reject) => {
        held.addEventListener("abort", () => reject(held.reason), { once: true });
      });
    });
    const joined = model.runAgentTask("agentTasks:1", 60_000, async () => undefined);

    expect(first.started).toBe(true);
    expect(joined.started).toBe(false);
    expect(joined.promise).toBe(first.promise);
    await Promise.resolve();
    expect(model.isAgentTaskActive("agentTasks:1")).toBe(true);
    expect(model.stopAgentTask("agentTasks:1")).toBe(true);
    expect(signal?.reason).toBeInstanceOf(AgentTaskCancelledError);
    await expect(first.promise).rejects.toBeInstanceOf(AgentTaskCancelledError);
    await Promise.resolve();
    expect(model.isAgentTaskActive("agentTasks:1")).toBe(false);
    expect(model.stopAgentTask("agentTasks:1")).toBe(false);
  });

  it("owns an Agent task deadline", async () => {
    vi.useFakeTimers();
    try {
      const model = createOperationFlights();
      const flight = model.runAgentTask("agentTasks:deadline", 250, async (signal) => {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      });

      await vi.advanceTimersByTimeAsync(250);
      await expect(flight.promise).rejects.toBeInstanceOf(AgentTaskDeadlineError);
      await Promise.resolve();
      expect(model.isAgentTaskActive("agentTasks:deadline")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
    let agentSignal: AbortSignal | undefined;
    const agent = model.runAgentTask("agentTasks:shutdown", 60_000, async (signal) => {
      agentSignal = signal;
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
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
    expect(agentSignal?.reason).toBeInstanceOf(OperationFlightsShutdownError);
    expect(closed).toBe(false);
    expect(model.close()).toBe(closing);
    expect(() => model.beginResearch("turn:new")).toThrow(/closed/);
    expect(() => model.shareDerived("output:new", "definition:1", async () => "no"))
      .toThrow(/closed/);
    expect(() => model.runAgentTask("agentTasks:new", 1_000, async () => undefined))
      .toThrow(/closed/);

    never.resolve();
    await derived.promise;
    await Promise.resolve();
    expect(closed).toBe(false);

    model.endResearch("turn:shutdown");
    await expect(agent.promise).rejects.toBeInstanceOf(OperationFlightsShutdownError);
    await closing;
    expect(closed).toBe(true);
  });
});
