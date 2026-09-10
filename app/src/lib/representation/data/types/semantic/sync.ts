import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type SemanticSyncJobState = "queued" | "running" | "failed";

export type SemanticJobLifecycle =
  | {
      state: "queued";
      error?: never;
      startedAt?: never;
      claimId?: never;
      leaseExpiresAt?: never;
    }
  | {
      state: "running";
      error?: never;
      startedAt: number;
      claimId: string;
      leaseExpiresAt: number;
    }
  | {
      state: "failed";
      error: string;
      startedAt?: never;
      claimId?: never;
      leaseExpiresAt?: never;
    };

export type SemanticSyncJobFields = {
  projectId: Id<"projects">;
  ref: ResourceRef;
  requestedRevision: number;
  force?: true;
  attempts: number;
  queuedAt: number;
  updatedAt: number;
} & SemanticJobLifecycle;
