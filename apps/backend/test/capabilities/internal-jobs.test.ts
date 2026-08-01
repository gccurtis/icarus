import assert from "node:assert/strict";
import test from "node:test";
import {
  SchedulerInternalJobsRuntime
} from "../../src/0-utils/jobs/internalRuntime.js";
import {
  JobScheduler,
  QueueCapacityError
} from "../../src/0-utils/jobs/scheduler.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 2,
  concurrentQueueMaxSize: 2
};

test("scheduler admission is separate from Job completion", async () => {
  const scheduler = new JobScheduler(schedulerConfig);
  let signalStarted!: () => void;
  let releaseWork!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    releaseWork = resolve;
  });
  let completed = false;

  const admission = scheduler.admit({
    id: "admission-separation",
    name: "test.admission-separation",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      signalStarted();
      await barrier;
      completed = true;
      return { statusCode: 204 };
    }
  });

  assert.equal(admission.receipt.jobId, "admission-separation");
  assert.ok(Number.isFinite(Date.parse(admission.receipt.acceptedAt)));
  await started;
  assert.equal(completed, false);

  releaseWork();
  const result = await admission.completion;
  assert.equal(result.response.statusCode, 204);
  assert.equal(completed, true);
});

test("enqueue retains completion-waiting behavior", async () => {
  const scheduler = new JobScheduler(schedulerConfig);
  let releaseWork!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseWork = resolve;
  });
  let settled = false;

  const completion = scheduler.enqueue({
    id: "enqueue-completion",
    name: "test.enqueue-completion",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      await barrier;
      return { statusCode: 200 };
    }
  });
  void completion.finally(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);

  releaseWork();
  assert.equal((await completion).response.statusCode, 200);
  assert.equal(settled, true);
});

test("capacity failure is reported at admission time", async () => {
  const scheduler = new JobScheduler({
    concurrentWorkers: 1,
    serialQueueMaxSize: 1,
    concurrentQueueMaxSize: 1
  });
  let releaseFirst!: () => void;
  const firstBarrier = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const first = scheduler.admit({
    id: "capacity-active",
    name: "test.capacity-active",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      await firstBarrier;
      return { statusCode: 204 };
    }
  });
  const queued = scheduler.admit({
    id: "capacity-queued",
    name: "test.capacity-queued",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => ({ statusCode: 204 })
  });

  assert.throws(
    () => scheduler.admit({
      id: "capacity-rejected",
      name: "test.capacity-rejected",
      queueType: "concurrent",
      responseMode: "inline",
      work: async () => ({ statusCode: 204 })
    }),
    (error: unknown) =>
      error instanceof QueueCapacityError && error.queueType === "concurrent"
  );

  releaseFirst();
  await Promise.all([first.completion, queued.completion]);
});

type TestIntent =
  | { type: "test.compute"; attemptId: string }
  | { type: "test.settle"; attemptId: string };

test("internal dispatch returns on admission and wiring owns queue choice", async () => {
  const scheduler = new JobScheduler(schedulerConfig);
  const runtime = new SchedulerInternalJobsRuntime<TestIntent>(scheduler);
  let releaseWork!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseWork = resolve;
  });
  let completed = false;

  runtime.register("test.compute", (intent) => ({
    name: `test.compute.${intent.attemptId}`,
    queueType: "concurrent",
    work: async () => {
      await barrier;
      completed = true;
    }
  }));

  const receipt = await runtime.dispatch({
    type: "test.compute",
    attemptId: "attempt-1"
  });
  assert.match(receipt.jobId, /^internal-test-compute-/);
  assert.equal(completed, false);
  assert.deepEqual(scheduler.getState(), {
    serialDepth: 0,
    serialActive: false,
    concurrentDepth: 0,
    concurrentActive: 1,
    concurrentWorkers: 1
  });

  releaseWork();
});

test("internal registration rejects duplicates and unknown intents", async () => {
  const runtime = new SchedulerInternalJobsRuntime<TestIntent>(
    new JobScheduler(schedulerConfig)
  );
  runtime.register("test.compute", () => ({
    name: "test.compute",
    queueType: "concurrent",
    work: async () => undefined
  }));

  assert.throws(
    () => runtime.register("test.compute", () => ({
      name: "test.compute.duplicate",
      queueType: "serial",
      work: async () => undefined
    })),
    /already registered/
  );
  await assert.rejects(
    runtime.dispatch({ type: "test.settle", attemptId: "missing" }),
    /No internal Job registered/
  );
});

test("internal and request Jobs share the serial FIFO", async () => {
  const scheduler = new JobScheduler(schedulerConfig);
  const runtime = new SchedulerInternalJobsRuntime<TestIntent>(scheduler);
  const order: string[] = [];
  let releaseRequest!: () => void;
  const requestBarrier = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let signalInternal!: () => void;
  const internalCompleted = new Promise<void>((resolve) => {
    signalInternal = resolve;
  });

  const requestAdmission = scheduler.admit({
    id: "request-serial-job",
    name: "test.request-serial-job",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      order.push("request-start");
      await requestBarrier;
      order.push("request-end");
      return { statusCode: 204 };
    }
  });
  runtime.register("test.settle", () => ({
    name: "test.internal-serial-job",
    queueType: "serial",
    work: async () => {
      order.push("internal");
      signalInternal();
    }
  }));

  await runtime.dispatch({ type: "test.settle", attemptId: "attempt-2" });
  assert.deepEqual(order, ["request-start"]);
  releaseRequest();
  await requestAdmission.completion;
  await internalCompleted;
  assert.deepEqual(order, ["request-start", "request-end", "internal"]);
});

test("failed internal work is observed and releases its scheduler slot", async () => {
  const logger = new CapturingLogger();
  const scheduler = new JobScheduler(schedulerConfig, logger);
  const runtime = new SchedulerInternalJobsRuntime<TestIntent>(scheduler);
  let signalSecond!: () => void;
  const secondRan = new Promise<void>((resolve) => {
    signalSecond = resolve;
  });

  runtime.register("test.compute", (intent) => ({
    name: `test.compute.${intent.attemptId}`,
    queueType: "concurrent",
    work: async () => {
      if (intent.attemptId === "failure") {
        throw new Error("expected internal failure");
      }
      signalSecond();
    }
  }));

  await runtime.dispatch({ type: "test.compute", attemptId: "failure" });
  await runtime.dispatch({ type: "test.compute", attemptId: "success" });
  await secondRan;

  assert.ok(logger.entries.some((entry) =>
    entry.message === "job.failed" &&
    (entry.data as { errorMessage?: string }).errorMessage ===
      "expected internal failure"
  ));
});
