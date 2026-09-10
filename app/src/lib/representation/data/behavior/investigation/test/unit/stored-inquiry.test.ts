import { describe, expect, it } from "vitest";
import {
  isStoredHypothesis,
  isStoredQuestion
} from "$representation/data/behavior/investigation/stored-inquiry";

const actor = { kind: "user", userId: "users:1" };
const base = (table: string) => ({
  _id: `${table}:1`,
  _creationTime: 1,
  projectId: "default"
});

const question = () => ({
  ...base("questions"),
  text: "What changed?",
  notes: [],
  status: "investigating",
  relatedTo: [{ kind: "hypothesis", id: "hypotheses:1" }],
  researchThreadIds: ["researchThreads:1"],
  parentId: "questions:parent",
  createdBy: actor,
  updatedBy: actor,
  revision: 2,
  updatedAt: 2
});

const hypothesis = () => ({
  ...base("hypotheses"),
  statement: "The relay opened first.",
  notes: [],
  assessment: "testing",
  confidence: 0.6,
  evidence: [{
    findingId: "findings:1",
    bearing: "supports",
    note: "The event clock is earlier.",
    createdBy: actor,
    updatedBy: actor,
    revision: 1,
    updatedAt: 2
  }],
  relatedTo: ["questions:1"],
  researchThreadIds: ["researchThreads:1"],
  createdBy: actor,
  updatedBy: actor,
  revision: 1,
  updatedAt: 2
});

describe("current inquiry storage", () => {
  it("admits nonempty current relationships in both inquiry rows", () => {
    expect(isStoredQuestion(question())).toBe(true);
    expect(isStoredHypothesis(hypothesis())).toBe(true);
  });

  it("rejects unknown, missing, duplicated, and wrong nested relationship shapes", () => {
    expect(isStoredQuestion({ ...question(), oldStatus: "open" })).toBe(false);
    const missing = question() as Record<string, unknown>;
    delete missing.notes;
    expect(isStoredQuestion(missing)).toBe(false);
    expect(isStoredQuestion({
      ...question(),
      relatedTo: [question().relatedTo[0], question().relatedTo[0]]
    })).toBe(false);
    expect(isStoredHypothesis({ ...hypothesis(), relatedTo: [{ kind: "question", id: "questions:1" }] })).toBe(false);
  });

  it("does not coerce discriminator objects into current literals", () => {
    const assessment = { toString: () => "testing" };
    expect(isStoredHypothesis({ ...hypothesis(), assessment })).toBe(false);
  });
});
