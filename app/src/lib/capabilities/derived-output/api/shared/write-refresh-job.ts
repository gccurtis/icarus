import type { ServerModel } from "$runtime/server/start.server";
import { isStoredDerivedOutputRefreshJob } from "$representation/data/behavior/semantic/stored-derived-output";
import type { DerivedOutputRefreshJobFields } from "$representation/data/types/semantic/derived-output";
import {
  derivedOutputRefreshJobFor
} from "$capabilities/derived-output/api/shared/refresh-job-reading";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";

type RefreshJob = NonNullable<ReturnType<typeof derivedOutputRefreshJobFor>>;

const chosen = <K extends keyof DerivedOutputRefreshJobFields>(
  job: RefreshJob,
  patch: Partial<DerivedOutputRefreshJobFields>,
  field: K
): DerivedOutputRefreshJobFields[K] | undefined =>
  Object.hasOwn(patch, field) ? patch[field] : job[field];

const fieldsFor = (
  job: RefreshJob,
  patch: Partial<DerivedOutputRefreshJobFields>
): DerivedOutputRefreshJobFields => {
  const candidate = Object.fromEntries(Object.entries({
    _id: job._id,
    _creationTime: job._creationTime,
    projectId: chosen(job, patch, "projectId"),
    derivedOutputId: chosen(job, patch, "derivedOutputId"),
    selection: chosen(job, patch, "selection"),
    state: chosen(job, patch, "state"),
    requestKey: chosen(job, patch, "requestKey"),
    requestedVersion: chosen(job, patch, "requestedVersion"),
    attempts: chosen(job, patch, "attempts"),
    error: chosen(job, patch, "error"),
    queuedAt: chosen(job, patch, "queuedAt"),
    startedAt: chosen(job, patch, "startedAt"),
    updatedAt: chosen(job, patch, "updatedAt")
  }).filter(([, value]) => value !== undefined));
  if (!isStoredDerivedOutputRefreshJob(candidate)) {
    throw new Error("the refresh-job update is not a complete current row");
  }
  return {
    projectId: candidate.projectId,
    derivedOutputId: candidate.derivedOutputId,
    ...(candidate.selection === undefined ? {} : { selection: candidate.selection }),
    state: candidate.state,
    requestKey: candidate.requestKey,
    requestedVersion: candidate.requestedVersion,
    attempts: candidate.attempts,
    ...(candidate.error === undefined ? {} : { error: candidate.error }),
    queuedAt: candidate.queuedAt,
    ...(candidate.startedAt === undefined ? {} : { startedAt: candidate.startedAt }),
    updatedAt: candidate.updatedAt
  };
};

/** Atomically replaces one exact current refresh job and removes omitted optional values. */
export const writeRefreshJob = (
  model: ServerModel,
  job: RefreshJob,
  patch: Partial<DerivedOutputRefreshJobFields>
): RefreshJob => {
  if (!isStoredDerivedOutputRefreshJob(job)) {
    throw new Error("the refresh job to update is not a complete current row");
  }
  const fields = fieldsFor(job, patch);
  return model.store.transaction((unit) => {
    unit.update(`derivedOutputRefreshJobs.${job._id}`, fields);
    const written = rowsOf(unit, "derivedOutputRefreshJobs").find(
      (candidate) => candidate.projectId === job.projectId &&
        candidate.derivedOutputId === job.derivedOutputId
    );
    if (written === undefined) throw new Error("derived output refresh job disappeared");
    return written;
  });
};
