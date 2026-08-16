import { describe, expect, it } from "vitest";
import { commentsTables } from "$comments/schema";

describe("commentThreads schema", () => {
  it("leads every index with projectId", () => {
    const indexes = commentsTables.commentThreads[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  /** "Every remark on this document" is one indexed range, not a scan of the project. */
  it("finds a target's threads by the pair that names it", () => {
    const indexes = commentsTables.commentThreads[" indexes"]();
    const target = indexes.find((index) => index.indexDescriptor === "by_target");

    expect(target?.fields).toEqual(["projectId", "anchor.targetType", "anchor.targetId"]);
  });

  it("holds the anchor and the resolved state, which are the thread's own", () => {
    const fields = Object.keys(commentsTables.commentThreads.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "anchor",
        "status",
        "resolvedBy",
        "resolvedAt",
        "createdBy",
        "updatedAt"
      ].sort()
    );
  });

  /**
   * Anything can raise a remark; closing one is a judgement a person makes. So
   * `createdBy` is an actor and `resolvedBy` is a user, and this is the assertion
   * that keeps them from converging on whichever was written second.
   */
  it("resolves as a user and is created by an actor", () => {
    const fields = commentsTables.commentThreads.validator.fields;

    expect(fields.resolvedBy).toMatchObject({ kind: "id", tableName: "users" });
    expect(fields.createdBy.kind).toBe("union");
  });

  /** Resolved hides a thread; it never deletes one, so there is no deletion column. */
  it("admits exactly open and resolved", () => {
    const status = commentsTables.commentThreads.validator.fields.status;

    expect(status.members.map((member) => member.value).sort()).toEqual(["open", "resolved"]);
  });
});

describe("comments schema", () => {
  it("leads every index with projectId", () => {
    const indexes = commentsTables.comments[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("reads one thread's comments and no other's", () => {
    const indexes = commentsTables.comments[" indexes"]();
    const thread = indexes.find((index) => index.indexDescriptor === "by_thread");

    expect(thread?.fields).toEqual(["projectId", "threadId"]);
  });

  /**
   * `projectId` is here even though a comment is reached through an already-scoped
   * thread. A query that has to join upward to check access is a query that will
   * eventually forget to.
   */
  it("carries its own projectId rather than inheriting the thread's", () => {
    const fields = Object.keys(commentsTables.comments.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "threadId", "blocks", "author", "mentions", "editedAt"].sort()
    );
  });

  /** The prior text is not kept: a remark is a conversation turn, not a document. */
  it("marks an edit without versioning it", () => {
    const fields = commentsTables.comments.validator.fields;

    expect(fields.editedAt.isOptional).toBe("optional");
    expect(fields).not.toHaveProperty("revision");
    expect(fields).not.toHaveProperty("history");
  });
});
