import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResearchScope } from "$representation/data/types/investigation/research-turn";
import {
  enqueueSemanticSyncForModel,
  processSemanticSyncQueueFor
} from "$capabilities/semantic-overlay";

import { researchResources } from "$capabilities/research-chat/api/shared/resource-catalogue";

const refsIn = (model: ServerModel, projectId: Id<"projects">): ResourceRef[] =>
  researchResources(model, projectId).map((resource) => resource.ref);

type OverlayFailure = {
  readonly lane: "text" | "material";
  readonly ref: ResourceRef;
  readonly error: string;
};

const sameResource = (left: ResourceRef, right: ResourceRef): boolean =>
  left.kind === right.kind && left.id === right.id;

const refsFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  scope: ResearchScope
): readonly ResourceRef[] => {
  const available = refsIn(model, projectId);
  return scope.kind === "project"
    ? available
    : available.filter((ref) => sameResource(ref, scope.ref));
};

const reportIncomplete = (
  model: ServerModel,
  projectId: Id<"projects">,
  failures: readonly OverlayFailure[]
): void => {
  model.observability.logger.warn("researchChat.overlayIncomplete", {
    projectId,
    failures
  });
};

/**
 * Bring the project's overlay up to date before a question is asked of it.
 *
 * A chat is a pull boundary in the same sense a derived output is: nothing else
 * guarantees the overlay is current at the moment somebody asks, so the turn
 * pays for it. Resources already indexed at their current revision are skipped,
 * which makes the second question in a conversation cost nothing here.
 *
 * A terminally failed resource is quarantined by the semantic queue and reported
 * here, but cannot make every other resource — and therefore every unrelated
 * question — unavailable. A queue that is still moving after the bounded drain
 * is different: the index has not reached a stable boundary, so the turn fails
 * instead of answering against a moving view.
 */
export const prepareOverlay = async (
  model: ServerModel,
  projectId: Id<"projects">,
  scope: ResearchScope,
  signal?: AbortSignal
): Promise<{ indexed: number }> => {
  signal?.throwIfAborted();
  const refs = refsFor(model, projectId, scope);
  if (scope.kind === "resource" && refs.length === 0) {
    throw new Error("The selected resource does not exist in this project");
  }

  let indexed = 0;
  const requestedTextJobs = new Set<string>();
  const requestedMaterialJobs = new Set<string>();
  for (const ref of refs) {
    signal?.throwIfAborted();
    const queued = await enqueueSemanticSyncForModel(model, projectId, ref, signal);
    if (queued === null) {
      if (scope.kind === "resource") {
        throw new Error("The selected resource cannot be prepared for research");
      }
      continue;
    }
    if (queued.jobId !== undefined) requestedTextJobs.add(queued.jobId);
    if (queued.materialJobId !== undefined) requestedMaterialJobs.add(queued.materialJobId);
    if (queued.jobId !== undefined || queued.materialJobId !== undefined) indexed += 1;
  }

  const selectedRef = scope.kind === "resource" ? scope.ref : undefined;
  for (let batch = 0; batch < 20; batch += 1) {
    signal?.throwIfAborted();
    const processed = await processSemanticSyncQueueFor(
      model,
      projectId,
      25,
      selectedRef,
      signal
    );
    signal?.throwIfAborted();
    if (processed.remaining === 0 && processed.materials.remaining === 0) {
      const incomplete: OverlayFailure[] = [
        ...processed.failed.flatMap((failed) =>
          failed.error === undefined || !requestedTextJobs.has(failed.jobId)
            ? []
            : [{ lane: "text" as const, ref: failed.ref, error: failed.error }]
        ),
        ...processed.materials.failed.flatMap((failed) =>
          failed.error === undefined || !requestedMaterialJobs.has(failed.jobId)
            ? []
            : [{ lane: "material" as const, ref: failed.ref, error: failed.error }]
        )
      ];
      if (incomplete.length > 0) reportIncomplete(model, projectId, incomplete);
      const selected =
        scope.kind === "resource"
          ? incomplete.filter((failure) => sameResource(failure.ref, scope.ref))
          : [];
      if (selected.length > 0) {
        throw new Error(
          `The selected resource could not be prepared for research: ${selected
            .map((failure) => failure.error)
            .join("; ")}`
        );
      }
      return { indexed };
    }
  }
  throw new Error("The project's semantic overlay did not settle before the question ran");
};
