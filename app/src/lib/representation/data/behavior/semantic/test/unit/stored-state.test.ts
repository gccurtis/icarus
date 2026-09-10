import { describe, expect, it } from "vitest";

import {
  isStoredSemanticMaterialJob,
  isStoredSemanticSyncJob
} from "$representation/data/behavior/semantic/stored-state";

const queued = () => ({
  _id: "semanticSyncJobs:job",
  _creationTime: 1,
  projectId: "projects:project",
  ref: { kind: "document", id: "documents:source" },
  requestedRevision: 2,
  state: "queued",
  attempts: 0,
  queuedAt: 10,
  updatedAt: 10
});

describe("stored semantic job lifecycle", () => {
  it("admits each complete exact current arm", () => {
    expect(isStoredSemanticSyncJob(queued())).toBe(true);
    expect(isStoredSemanticSyncJob({
      ...queued(),
      state: "running",
      attempts: 1,
      startedAt: 12,
      claimId: "worker",
      leaseExpiresAt: 300,
      updatedAt: 12
    })).toBe(true);
    expect(isStoredSemanticSyncJob({
      ...queued(),
      state: "failed",
      attempts: 3,
      error: "provider unavailable",
      updatedAt: 20
    })).toBe(true);

    expect(isStoredSemanticMaterialJob({
      ...queued(),
      _id: "semanticMaterialJobs:job"
    })).toBe(true);
  });

  it("rejects partial and mixed lifecycle arms", () => {
    expect(isStoredSemanticSyncJob({ ...queued(), state: "running", attempts: 1 })).toBe(false);
    expect(isStoredSemanticSyncJob({
      ...queued(),
      state: "running",
      attempts: 1,
      startedAt: 12,
      claimId: "worker",
      updatedAt: 12
    })).toBe(false);
    expect(isStoredSemanticSyncJob({ ...queued(), error: "retrying" })).toBe(false);
    expect(isStoredSemanticSyncJob({ ...queued(), state: "failed", attempts: 3 })).toBe(false);
    expect(isStoredSemanticSyncJob({
      ...queued(),
      state: "failed",
      attempts: 3,
      error: "failed",
      claimId: "former-worker"
    })).toBe(false);
  });

  it("rejects values no current writer persists", () => {
    expect(isStoredSemanticSyncJob({ ...queued(), force: false })).toBe(false);
    expect(isStoredSemanticSyncJob({ ...queued(), error: undefined })).toBe(false);
    expect(isStoredSemanticSyncJob({ ...queued(), queuedAt: 11, updatedAt: 10 })).toBe(false);
    expect(isStoredSemanticSyncJob({
      ...queued(),
      state: "running",
      attempts: 1,
      startedAt: 12,
      claimId: "worker",
      leaseExpiresAt: 12,
      updatedAt: 12
    })).toBe(false);
  });
});
