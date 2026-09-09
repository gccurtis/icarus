import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type {
  DerivedOutput,
  DerivedOutputRefreshJobFields,
  DerivedOutputSelection
} from "$representation/data/types/semantic/derived-output";
import type { RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
import { outputOf, rowsOf } from "$capabilities/derived-output/api/shared/rows";

type RefreshRun = (
  selection: DerivedOutputSelection | undefined
) => Promise<RefreshDerivedOutputResult>;

type RefreshFlight = {
  promise: Promise<RefreshDerivedOutputResult>;
  /** The newest explicit request this flight has accepted. */
  requestKey: string;
};

const globalState = globalThis as typeof globalThis & {
  __icarusDerivedOutputRefreshFlightsV2?: Map<string, RefreshFlight>;
};

// Keep live server flights through development module replacement. The lazy
// accessor also preserves the capability rule that importing a module creates
// no runtime object or hidden lifetime.
const refreshFlights = (): Map<string, RefreshFlight> => {
  const held = globalState.__icarusDerivedOutputRefreshFlightsV2;
  if (held !== undefined) return held;
  const created = new Map<string, RefreshFlight>();
  globalState.__icarusDerivedOutputRefreshFlightsV2 = created;
  return created;
};

const keyFor = (projectId: Id<"projects">, outputId: Id<"derivedOutputs">): string =>
  `${projectId}\u0000${outputId}`;

const requestKeyFor = (
  output: DerivedOutput,
  selection: DerivedOutputSelection | undefined
): string => JSON.stringify({
  definitionRevision: output.definitionRevision ?? 0,
  selection: selection === undefined
    ? null
    : {
        kind: selection.ref.kind,
        id: selection.ref.id,
        from: selection.from,
        to: selection.to
      }
});

const jobFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">
) =>
  rowsOf(model.store, "derivedOutputRefreshJobs").find(
    (job) => job.projectId === projectId && job.derivedOutputId === outputId
  );

/** Read-only server seam used to project shared operation state to clients. */
export const derivedOutputRefreshJobFor = jobFor;

const fieldsOf = (
  job: NonNullable<ReturnType<typeof jobFor>>
): DerivedOutputRefreshJobFields => {
  const { _id, _creationTime, ...fields } = job;
  void _id;
  void _creationTime;
  return fields;
};

const writeJob = (
  model: ServerModel,
  job: NonNullable<ReturnType<typeof jobFor>>,
  patch: Partial<DerivedOutputRefreshJobFields>
) => {
  const fields = Object.fromEntries(
    Object.entries({ ...fieldsOf(job), ...patch }).filter(([, value]) => value !== undefined)
  );
  return model.store.transaction((unit) => {
    unit.update(`derivedOutputRefreshJobs.${job._id}`, fields);
    const written = rowsOf(unit, "derivedOutputRefreshJobs").find(
      (candidate) =>
        candidate.projectId === job.projectId &&
        candidate.derivedOutputId === job.derivedOutputId
    );
    if (written === undefined) throw new Error("derived output refresh job disappeared");
    return written;
  });
};

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
  const flight = refreshFlights().get(flightKey);
  const existing = jobFor(model, projectId, outputId);
  if (existing === undefined) {
    // The worker removes its durable row immediately before its promise
    // settles. An identical signal in that tiny window still joins the flight
    // and must not recreate work which has already completed.
    if (flight?.requestKey === requestKey) return undefined;
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

  const sameRequest = existing.requestKey === requestKey;
  if (sameRequest && existing.state !== "failed") return existing._id;

  const requestedVersion = (existing.requestedVersion ?? 1) + 1;
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
  if (flight !== undefined) flight.requestKey = requestKey;
  return existing._id;
};

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Derived output refresh failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const workQueuedRefresh = async (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">,
  run: RefreshRun
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

    const claimedVersion = job.requestedVersion ?? 1;
    job = writeJob(model, job, {
      state: "running",
      attempts: job.attempts + 1,
      error: undefined,
      startedAt: Date.now(),
      updatedAt: Date.now()
    });

    try {
      last = await run(job.selection);
    } catch (error) {
      const current = jobFor(model, projectId, outputId);
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
    if (current.requestedVersion > claimedVersion) {
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
  const flights = refreshFlights();
  const current = flights.get(key);
  if (current !== undefined) {
    return current.promise.then(async (result) => {
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

  const started = Promise.resolve().then(
    async () => await workQueuedRefresh(model, projectId, outputId, run)
  );
  const queued = jobFor(model, projectId, outputId);
  const flight: RefreshFlight = {
    promise: started,
    requestKey: queued?.requestKey ?? ""
  };
  flights.set(key, flight);
  const release = () => {
    if (flights.get(key) === flight) flights.delete(key);
  };
  void started.then(release, release);
  return started;
};
