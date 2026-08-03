import type { Logger } from "#platform/observability/logger.js";
import type { ResourceRetentionTarget } from "#utils/persistence/resourceRetentionScheduler.js";

/**
 * A capability that owns Derived Outputs on behalf of its own blocks.
 *
 * Document is the only one today; Slides has a byte-identical ownership table
 * and will be a second the moment it is wired in. That is why this is a list of
 * claimants rather than a single hard-wired store — a sweep whose claim set is
 * "Document says so" would start deleting Slides' outputs on the day Slides
 * ships, silently and with no test to catch it.
 */
export interface DerivedOutputClaimant {
  /** Names the owner in logs, so a reaped output can be traced to whose it was. */
  readonly kind: string;
  /**
   * Outputs this claimant once owned and no longer attaches to any block,
   * released before `cutoff`.
   */
  listDetachedOutputs(
    cutoff: string
  ): Promise<Array<{ outputId: string; detachedAt: string }>>;
  /** Forget the ownership row. Called only after the output itself is gone. */
  releaseDetachedOutput(outputId: string): Promise<void>;
}

/** The half of Derived Outputs the reaper needs. */
export interface DerivedOutputRemover {
  delete(outputId: string): Promise<void>;
}

export interface DerivedOutputReaperDependencies {
  readonly claimants: readonly DerivedOutputClaimant[];
  readonly derivedOutputs: DerivedOutputRemover;
  readonly logger: Logger;
}

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && error.name === "DerivedOutputNotFoundError";

/**
 * Reaps Derived Outputs whose owning block is gone — general-updates item 16b.
 *
 * The leak it closes: `prompt_outputs` already records a `detached` state, and
 * has a partial index built for exactly this query, but nothing ever acted on
 * it. Every Prompt Block removed or repointed left its Derived Output alive and
 * unreachable — reachable by ID, but named by nothing.
 *
 * **It only reaps what an owner positively released.** The tempting
 * implementation is a diff — every output, minus everything claimed — and it is
 * wrong: `POST /derived-outputs` creates outputs that legitimately have no
 * owner, and a diff would delete all of them. Asking each claimant what it has
 * released cannot make that mistake.
 *
 * **The grace period is load-bearing, not caution.** Undo re-attaches a
 * detached output by ID, so a row detached recently may still come back.
 * Only rows older than the cutoff are past the reach of compensation.
 *
 * The output is *logically* deleted, not purged: purge refuses anything still
 * live, and deleting leaves a history record that the ordinary derived-outputs
 * retention port clears on the same schedule as everything else. One mechanism,
 * not two.
 */
export const createDerivedOutputReaper = (
  dependencies: DerivedOutputReaperDependencies
): ResourceRetentionTarget => ({
  // Nothing of its own to prune: the reaper owns no history. The Derived
  // Outputs retention port prunes what its deletions leave behind.
  pruneHistory: () => 0,

  purgeExpired: async (cutoff: string): Promise<number> => {
    const { claimants, derivedOutputs, logger } = dependencies;
    let reaped = 0;

    for (const claimant of claimants) {
      let detached: Array<{ outputId: string; detachedAt: string }>;
      try {
        detached = await claimant.listDetachedOutputs(cutoff);
      } catch (error) {
        // One claimant failing must not stop the others.
        logger.error("derived-outputs.reap.list-failed", {
          claimant: claimant.kind,
          cutoff,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
      if (detached.length === 0) continue;

      logger.warn("derived-outputs.reap.found", {
        claimant: claimant.kind,
        cutoff,
        count: detached.length,
        outputIds: detached.map((entry) => entry.outputId)
      });

      for (const entry of detached) {
        try {
          await derivedOutputs.delete(entry.outputId);
        } catch (error) {
          if (!isNotFound(error)) {
            // Leave the ownership row in place. It is the only record that this
            // output needs reaping, so dropping it here would lose the leak
            // rather than close it, and the next sweep retries.
            logger.error("derived-outputs.reap.delete-failed", {
              claimant: claimant.kind,
              outputId: entry.outputId,
              errorName: error instanceof Error ? error.name : "UnknownError",
              errorMessage: error instanceof Error ? error.message : String(error)
            });
            continue;
          }
          // Already gone — the expected outcome on a retry after a partial run.
          // Fall through and release the row it left behind.
        }

        try {
          await claimant.releaseDetachedOutput(entry.outputId);
        } catch (error) {
          logger.error("derived-outputs.reap.release-failed", {
            claimant: claimant.kind,
            outputId: entry.outputId,
            errorName: error instanceof Error ? error.name : "UnknownError",
            errorMessage: error instanceof Error ? error.message : String(error)
          });
          continue;
        }

        reaped += 1;
        logger.info("derived-outputs.reap.deleted", {
          claimant: claimant.kind,
          outputId: entry.outputId,
          detachedAt: entry.detachedAt
        });
      }
    }

    return reaped;
  }
});
