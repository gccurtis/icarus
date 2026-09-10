import { describe, expect, it } from "vitest";

import {
  isStoredDerivedOutput,
  isStoredDerivedOutputRefreshJob
} from "$representation/data/behavior/semantic/stored-derived-output";

const base = () => ({
  _id: "derivedOutputs:output",
  _creationTime: 1,
  projectId: "projects:project",
  prompt: "Summarize the current evidence",
  definitionRevision: 1,
  valueSource: "none",
  queries: [],
  evidence: [],
  state: "idle",
  createdBy: { kind: "system" },
  updatedAt: 20
});

const response = () => ({
  id: "response",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "response:text", kind: "literal", text: "Current answer" }],
  display: "Current answer",
  marks: []
});

const generated = () => ({
  ...base(),
  valueSource: "generated",
  state: "fresh",
  lastResponse: response(),
  lastRevision: 1,
  lastGeneration: 3,
  refreshedAt: 19
});

const refreshJob = () => ({
  _id: "derivedOutputRefreshJobs:job",
  _creationTime: 1,
  projectId: "projects:project",
  derivedOutputId: "derivedOutputs:output",
  state: "queued",
  requestKey: "definition:1",
  requestedVersion: 1,
  attempts: 0,
  queuedAt: 10,
  updatedAt: 10
});

describe("stored Derived Output state", () => {
  it("admits only coherent current value and lifecycle arms", () => {
    expect(isStoredDerivedOutput(base())).toBe(true);
    expect(isStoredDerivedOutput({
      ...base(),
      valueSource: "authored",
      state: "stale",
      lastResponse: response(),
      lastRevision: 2
    })).toBe(true);
    expect(isStoredDerivedOutput(generated())).toBe(true);
    expect(isStoredDerivedOutput({ ...generated(), state: "stale" })).toBe(true);
    expect(isStoredDerivedOutput({
      ...generated(),
      state: "error",
      error: "Provider unavailable"
    })).toBe(true);
  });

  it("rejects implicit, partial, and mixed value shapes", () => {
    const { valueSource: _valueSource, ...implicitOldShape } = base();
    void _valueSource;
    expect(isStoredDerivedOutput(implicitOldShape)).toBe(false);
    expect(isStoredDerivedOutput({ ...base(), lastResponse: response() })).toBe(false);
    expect(isStoredDerivedOutput({
      ...base(),
      valueSource: "authored",
      state: "stale",
      lastResponse: response()
    })).toBe(false);
    expect(isStoredDerivedOutput({
      ...generated(),
      valueSource: "authored"
    })).toBe(false);
    expect(isStoredDerivedOutput({
      ...generated(),
      state: "fresh",
      valueSource: "none",
      lastResponse: undefined,
      lastRevision: undefined,
      lastGeneration: undefined,
      refreshedAt: undefined
    })).toBe(false);
  });

  it("rejects the retired per-variable origin field", () => {
    const template = {
      variables: [{ name: "answer", prompt: "Find the answer" }],
      output: "{{answer}}"
    };
    expect(isStoredDerivedOutput({ ...base(), template })).toBe(true);
    expect(isStoredDerivedOutput({
      ...base(),
      template: {
        ...template,
        variables: [{
          ...template.variables[0],
          origin: { kind: "document", id: "documents:one" }
        }]
      }
    })).toBe(false);
  });

  it("rejects partial and mixed refresh jobs", () => {
    expect(isStoredDerivedOutputRefreshJob(refreshJob())).toBe(true);
    expect(isStoredDerivedOutputRefreshJob({
      ...refreshJob(),
      state: "running",
      attempts: 1,
      startedAt: 11,
      updatedAt: 11
    })).toBe(true);
    expect(isStoredDerivedOutputRefreshJob({
      ...refreshJob(),
      state: "failed",
      attempts: 1,
      startedAt: 11,
      updatedAt: 11,
      error: "Provider unavailable"
    })).toBe(true);
    expect(isStoredDerivedOutputRefreshJob({ ...refreshJob(), error: "retrying" })).toBe(false);
    expect(isStoredDerivedOutputRefreshJob({
      ...refreshJob(),
      state: "failed",
      attempts: 1,
      error: "Provider unavailable"
    })).toBe(false);
  });
});
