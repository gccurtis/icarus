import { describe, expect, it, vi } from "vitest";
import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import { resolveScope } from "$knowledge/api/shared/retrieve/scope-manifest";
import { aDocument, aFinding, asCtx, asking } from "$knowledge/test/fixture";
import type { ResourceRef, SetExpression } from "$shared/types/set-expression";

const refOf = (source: { kind: string; id: string }): ResourceRef =>
  ({ kind: source.kind, id: source.id }) as ResourceRef;

/** The manifest a scope that restricts anything produces. */
const manifestOf = async (ctx: MutationCtx, scope: Scope, expression: SetExpression) => {
  const manifest = await resolveScope(ctx, scope, expression);
  if (!manifest) throw new Error("this scope restricts something and should have a manifest");
  return manifest;
};

describe("resolveScope", () => {
  it("resolves an expression to the admissible source ids, sorted and deduplicated", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const memo = await aDocument(ctx, scope, "Memo");

    const manifest = await manifestOf(asCtx(ctx), scope, {
      op: "resources",
      refs: [refOf(memo), refOf(notes), refOf(memo)]
    });

    expect(manifest.sourceIds).toEqual([notes.id, memo.id].sort());
    expect(manifest.entries).toHaveLength(2);
  });

  it("produces the same digests for the same scope resolved twice", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    // Written twice rather than reused, so nothing about the answer can come
    // from it being the same object.
    const asked = (): SetExpression => ({ op: "resources", refs: [refOf(notes)] });

    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const first = await manifestOf(asCtx(ctx), scope, asked());
    clock.mockReturnValue(2_000);
    const second = await manifestOf(asCtx(ctx), scope, asked());
    clock.mockRestore();

    // The digests are what make a scoped answer checkable, so they have to be
    // the scope rather than the moment it was resolved.
    expect(second.resolvedAt).not.toBe(first.resolvedAt);
    expect(second.inputDigest).toBe(first.inputDigest);
    expect(second.scopeDigest).toBe(first.scopeDigest);
  });

  it("digests the membership rather than the order it was named in", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const memo = await aDocument(ctx, scope, "Memo");

    const forwards = await manifestOf(asCtx(ctx), scope, {
      op: "resources",
      refs: [refOf(notes), refOf(memo)]
    });
    const backwards = await manifestOf(asCtx(ctx), scope, {
      op: "resources",
      refs: [refOf(memo), refOf(notes)]
    });

    expect(backwards.scopeDigest).toBe(forwards.scopeDigest);
    // The input is what the caller wrote, so the two are not the same request.
    expect(backwards.inputDigest).not.toBe(forwards.inputDigest);
  });

  it("takes an absent scope, and one that names nothing, as no restriction", async () => {
    const { ctx, scope } = await asking();
    await aDocument(ctx, scope, "Notes");

    expect(await resolveScope(asCtx(ctx), scope, undefined)).toBeNull();
    expect(await resolveScope(asCtx(ctx), scope, { op: "resources", refs: [] })).toBeNull();
    expect(await resolveScope(asCtx(ctx), scope, { op: "union", of: [] })).toBeNull();
  });

  it("takes a scope that resolved to nothing as admitting nothing", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await aDocument(ctx, elsewhere, "Not yours");

    const manifest = await manifestOf(asCtx(ctx), scope, {
      op: "resources",
      refs: [refOf(theirs)]
    });

    // A scope naming a resource that is gone — or was never the caller's —
    // admits nothing. Reading it as "no restriction" would answer from the whole
    // project exactly when the caller asked for the least.
    expect(manifest.sourceIds).toEqual([]);
    expect(manifest.entries).toEqual([]);
  });

  it("lets a kind guide resolution and the id decide admission", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const finding = await aFinding(ctx, scope);

    const manifest = await manifestOf(asCtx(ctx), scope, { op: "kind", kind: "document" });

    // The kind chose which table was walked. What comes out is a set of ids, and
    // membership is decided against those alone.
    expect(manifest.sourceIds).toEqual([notes.id]);
    expect(manifest.sourceIds).not.toContain(finding.id);
  });
});
