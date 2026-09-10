import type { ServerModel } from "$runtime/server/start.server";
import { OperationFlightsShutdownError } from "$model/server/operation-flights/index.server";
import type { Id } from "$representation/data/types/core/id";
import type {
  DerivedOutput,
  DerivedOutputSelection
} from "$representation/data/types/semantic/derived-output";
import type { RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
import {
  derivedOutputRefreshJobFor as jobFor,
  requestedVersionOf
} from "$capabilities/derived-output/api/shared/refresh-job-reading";
import { outputOf } from "$capabilities/derived-output/api/shared/rows";
import { writeRefreshJob as writeJob } from "$capabilities/derived-output/api/shared/write-refresh-job";

type RefreshRun = (
  selection: DerivedOutputSelection | undefined,
  signal: AbortSignal
) => Promise<RefreshDerivedOutputResult>;

const keyFor = (projectId: Id<"projects">, outputId: Id<"derivedOutputs">): string =>
  `${projectId}\u0000${outputId}`;

const requestKeyFor = (
  output: DerivedOutput,
  selection: DerivedOutputSelection | undefined
): string => JSON.stringify({
  definitionRevision: output.definitionRevision,
  selection: selection === undefined
    ? null
    : {
        kind: selection.ref.kind,
        id: selection.ref.id,
        from: selection.from,
        to: selection.to
      }
});

/** Coalesce every browser's refresh signal onto one durable row per output. */
export const enqueueDerivedOutputRefreshFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">,
  selection?: DerivedOutputSelection
): Id<"derivedOutputRefreshJobs"> | undefined => {
  const at = Date.now();
  const output = outputOf(model.store, projectId, outputId);
  if (output === undefined) return undefined;
  const requestKey = requestKeyFor(output, selection);
  const flightKey = keyFor(projectId, outputId);
  const activeRequestKey = model.operationFlights.derivedRequestKey(flightKey);
  const existing = jobFor(model, projectId, outputId);
  if (existing === undefined) {
    // The worker removes its durable row immediately before its promise
    // settles. An identical signal in that tiny window still joins the flight
    // and must not recreate work which has already completed.
    if (activeRequestKey === requestKey) return undefined;
    return model.store.transaction((unit) =>
      unit.create("derivedOutputRefreshJobs", {
        projectId,
        derivedOutputId: outputId,
        ...(selection === undefined ? {} : { selection }),
        state: "queued",
        requestKey,
        requestedVersion: 1,
        attempts: 0,
        queuedAt: at,
        updatedAt: at
      })
    );
  }

  const currentVersion = requestedVersionOf(existing);
  const sameRequest = existing.requestKey === requestKey;
  if (sameRequest && existing.state !== "failed") return existing._id;

  const requestedVersion = currentVersion + 1;
  writeJob(model, existing, {
    projectId,
    derivedOutputId: outputId,
    selection,
    state: existing.state === "failed" ? "queued" : existing.state,
    requestKey,
    requestedVersion,
    attempts: existing.attempts,
    error: undefined,
    queuedAt: existing.state === "failed" ? at : existing.queuedAt,
    startedAt: existing.state === "failed" ? undefined : existing.startedAt,
    updatedAt: at
  });
  model.operationFlights.updateDerivedRequestKey(flightKey, requestKey);
  return existing._id;
};

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Derived output refresh failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const serverShutdownReason = (
  signal: AbortSignal
): OperationFlightsShutdownError | undefined =>
  signal.aborted && signal.reason instanceof OperationFlightsShutdownError
    ? signal.reason
    : undefined;

const requeueInterruptedRefresh = (
  model: ServerModel,
  job: NonNullable<ReturnType<typeof jobFor>>
): void => {
  const now = Date.now();
  writeJob(model, job, {
    state: "queued",
    attempts: Math.max(0, job.attempts - 1),
    error: undefined,
    queuedAt: now,
    startedAt: undefined,
    updatedAt: now
  });
};

const workQueuedRefresh = async (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">,
  run: RefreshRun,
  signal: AbortSignal
): Promise<RefreshDerivedOutputResult> => {
  let last: RefreshDerivedOutputResult = null;

  // Only a changed request key advances requestedVersion. One next pass
  // consumes that changed-input wave; duplicate browser signals are pure joins.
  for (let pass = 0; pass < 10; pass += 1) {
    let job = jobFor(model, projectId, outputId);
    if (job === undefined) return last;

    // A live worker is represented by `flights`. Reaching this branch without
    // one means the process restarted after persisting `running`; reclaim it.
    if (job.state === "running") {
      job = writeJob(model, job, {
        state: "queued",
        error: undefined,
        startedAt: undefined,
        updatedAt: Date.now()
      });
    }
    if (job.state === "failed") return last;

    const claimedVersion = requestedVersionOf(job);
    job = writeJob(model, job, {
      state: "running",
      attempts: job.attempts + 1,
      error: undefined,
      startedAt: Date.now(),
      updatedAt: Date.now()
    });

    try {
      last = await run(job.selection, signal);
      const shutdown = serverShutdownReason(signal);
      if (shutdown !== undefined) throw shutdown;
    } catch (error) {
      const current = jobFor(model, projectId, outputId);
      const shutdown = serverShutdownReason(signal);
      if (shutdown !== undefined) {
        if (current !== undefined) requeueInterruptedRefresh(model, current);
        throw shutdown;
      }
      if (current !== undefined) {
        writeJob(model, current, {
          state: "failed",
          error: safeFailure(error),
          updatedAt: Date.now()
        });
      }
      throw error;
    }

    const current = jobFor(model, projectId, outputId);
    if (current === undefined) return last;
    if (requestedVersionOf(current) > claimedVersion) {
      writeJob(model, current, {
        state: "queued",
        error: undefined,
        queuedAt: Date.now(),
        startedAt: undefined,
        updatedAt: Date.now()
      });
      continue;
    }
    if (last?.outcome === "failed") {
      writeJob(model, current, {
        state: "failed",
        error: last.output.error,
        updatedAt: Date.now()
      });
      return last;
    }

    model.store.transaction((unit) => {
      unit.removeRows("derivedOutputRefreshJobs", [current._id]);
    });
    return last;
  }

  const current = jobFor(model, projectId, outputId);
  if (current !== undefined) {
    writeJob(model, current, {
      state: "failed",
      error: "Refresh signals kept changing while the worker was running",
      updatedAt: Date.now()
    });
  }
  throw new Error("Refresh signals kept changing while the worker was running");
};

/**
 * Join the one server flight for this Derived Output. The durable row provides
 * crash visibility and coalescing; the in-process promise lets every concurrent
 * caller receive the same final canonical result instead of a lock error.
 */
export const processDerivedOutputRefreshFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">,
  run: RefreshRun
): Promise<RefreshDerivedOutputResult> => {
  const key = keyFor(projectId, outputId);
  const queued = jobFor(model, projectId, outputId);
  const shared = model.operationFlights.shareDerived(
    key,
    queued?.requestKey ?? "",
    async (signal) => await workQueuedRefresh(model, projectId, outputId, run, signal)
  );
  if (!shared.started) {
    return shared.promise.then(async (result) => {
      // Usually the active worker observes the advanced requestedVersion before
      // it publishes. This post-flight check closes the much smaller race in
      // which a signal lands after the worker removed its job but before all
      // promise continuations have resumed.
      const pending = jobFor(model, projectId, outputId);
      return pending?.state === "queued"
        ? await processDerivedOutputRefreshFor(model, projectId, outputId, run)
        : result;
    });
  }
  return shared.promise;
};
