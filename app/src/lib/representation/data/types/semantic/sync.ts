export type SemanticSyncJobState = "queued" | "running" | "failed";

export type SemanticJobClaim = {
  claimId?: string;
  leaseExpiresAt?: number;
};
