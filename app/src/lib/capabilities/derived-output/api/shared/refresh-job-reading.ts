import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { rowsOf } from "$capabilities/derived-output/api/shared/rows";

/** Read-only server seam used to project one shared operation to clients. */
export const derivedOutputRefreshJobFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  outputId: Id<"derivedOutputs">
) => rowsOf(model.store, "derivedOutputRefreshJobs").find(
  (job) => job.projectId === projectId && job.derivedOutputId === outputId
);

export const requestedVersionOf = (
  job: NonNullable<ReturnType<typeof derivedOutputRefreshJobFor>>
): number => {
  if (!Number.isSafeInteger(job.requestedVersion) || job.requestedVersion < 1) {
    throw new Error(`Derived output refresh job '${job._id}' has no current requestedVersion`);
  }
  return job.requestedVersion;
};
