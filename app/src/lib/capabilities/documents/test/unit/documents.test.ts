import { describe, expect, it } from "vitest";
import type { Scope } from "$access/types/access";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { create } from "$documents/api/create/create";
import { list } from "$documents/api/list/list";
import { remove } from "$documents/api/remove/remove";
import { rename } from "$documents/api/rename/rename";
import { documentsTables } from "$documents/schema";
import { fakeCtx } from "$shared/test/fake-ctx";

/**
 * The absences are the assertions. A body or a revision on this row would be
 * rewritten in full by every keystroke batch, so the field set is asserted
 * exactly — a field that drifts in fails here rather than in a write bill.
 */
describe("documents schema", () => {
  it("leads every index with projectId", () => {
    const indexes = documentsTables.documents[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the metadata a list renders and nothing a patch would rewrite", () => {
    const fields = Object.keys(documentsTables.documents.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "title", "templateId", "createdBy", "updatedBy", "updatedAt"].sort()
    );
  });

  it("keeps the body and the revision off the row", () => {
    const fields = documentsTables.documents.validator.fields;

    expect(fields).not.toHaveProperty("blocks");
    expect(fields).not.toHaveProperty("rows");
    expect(fields).not.toHaveProperty("revision");
  });
});

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
const scopeOf = (projectId: string, userId: string) => ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

const projectNamed = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  await ctx.db.insert("projects", { name, revision: 1, updatedAt: NOW });

/** The caller: one user, one project, and the scope the gate would have produced. */
const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  return { ctx, scope: scopeOf(await projectNamed(ctx, "Development"), userId), userId };
};

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, title: "Q3 plan" });
  });

  it("attributes the row to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.rows.get(id)).toMatchObject({
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
  });

  it("records the creation in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "created",
      target: { type: "document", id, label: "Q3 plan" }
    });
  });

  it("keeps the template it was made from as provenance", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan", "templates:1");

    expect(ctx.rows.get(id)).toMatchObject({ templateId: "templates:1" });
  });

  it("refuses a document with no name", async () => {
    const { ctx, scope } = await asking();

    await expect(create(asCtx(ctx), scope, "   ")).rejects.toThrow(/title/i);
    expect(ctx.log).toEqual([]);
  });
});

describe("rename", () => {
  it("writes the new title, who wrote it, and an entry naming it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    await rename(asCtx(ctx), scope, id, "Q4 plan");

    expect(ctx.rows.get(id)).toMatchObject({
      title: "Q4 plan",
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "renamed",
      target: { type: "document", id, label: "Q4 plan" }
    });
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their plan");

    // Not "forbidden": distinguishing the two confirms the document exists to
    // someone with no right to know that.
    await expect(rename(asCtx(ctx), scope, id, "Mine now")).rejects.toThrow(/not found/i);
    expect(ctx.rows.get(id)).toMatchObject({ title: "Their plan" });
  });
});

describe("remove", () => {
  it("copies the title into the log before the row it names is gone", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    await remove(asCtx(ctx), scope, id);

    expect(ctx.rows.has(id)).toBe(false);
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "document", id, label: "Q3 plan" }
    });
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their plan");

    await expect(remove(asCtx(ctx), scope, id)).rejects.toThrow(/not found/i);
    expect(ctx.rows.has(id)).toBe(true);
  });
});

describe("list", () => {
  it("returns the caller's project's documents and no other's", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await create(asCtx(ctx), scope, "Mine");
    await create(asCtx(ctx), theirs, "Theirs");

    expect((await list(asCtx(ctx), scope)).map((document) => document.title)).toEqual(["Mine"]);
  });

  it("carries what a list renders and nothing of the row it read", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    const [document] = await list(asCtx(ctx), scope);

    expect(document).toEqual({
      id,
      title: "Q3 plan",
      templateId: undefined,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: expect.any(Number) as number
    });
  });
});
