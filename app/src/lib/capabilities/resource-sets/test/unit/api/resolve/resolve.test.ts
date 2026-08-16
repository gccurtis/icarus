import { describe, expect, it } from "vitest";
import { resolve } from "$resource-sets/api/resolve/resolve";
import {
  aDeck,
  aDocument,
  aFile,
  aFinding,
  aSet,
  asCtx,
  asking,
  refusalFrom,
  setRef,
  someOfEverything
} from "$resource-sets/test/fixture";

describe("resolve", () => {
  it("resolves a saved set lazily — a resource created afterwards is in it", async () => {
    const { ctx, scope } = await asking();
    await aDocument(ctx, scope, "Notes");
    const everything = await aSet(ctx, scope, "Everything", { op: "project" });

    expect(await resolve(asCtx(ctx), scope, setRef(everything))).toHaveLength(1);

    const later = await aDocument(ctx, scope, "Written tomorrow");

    // The whole reason a set is an expression. An id list captured on save would
    // silently mean "the project as it was" and decay from that moment.
    expect(await resolve(asCtx(ctx), scope, setRef(everything))).toContainEqual({
      kind: "document",
      id: later
    });
  });

  it("takes every kind a project holds for { op: \"project\" }", async () => {
    const { ctx, scope } = await asking();
    const rows = await someOfEverything(ctx, scope);

    expect(await resolve(asCtx(ctx), scope, { op: "project" })).toEqual([
      { kind: "document", id: rows.document },
      { kind: "slides", id: rows.slides },
      { kind: "spreadsheet", id: rows.spreadsheet },
      { kind: "externalFile", id: rows.externalFile },
      { kind: "finding", id: rows.finding },
      { kind: "template", id: rows.template }
    ]);
  });

  it("subtracts documents and nothing else", async () => {
    const { ctx, scope } = await asking();
    const rows = await someOfEverything(ctx, scope);
    await aDocument(ctx, scope, "Second");

    // "Everything except the documents" is the natural way to say a real thing,
    // and without difference it can only be written as a decaying enumeration.
    expect(
      await resolve(asCtx(ctx), scope, {
        op: "difference",
        from: { op: "project" },
        remove: { op: "kind", kind: "document" }
      })
    ).toEqual([
      { kind: "slides", id: rows.slides },
      { kind: "spreadsheet", id: rows.spreadsheet },
      { kind: "externalFile", id: rows.externalFile },
      { kind: "finding", id: rows.finding },
      { kind: "template", id: rows.template }
    ]);
  });

  it("combines five kinds in one union node rather than four nested ones", async () => {
    const { ctx, scope } = await asking();
    const rows = await someOfEverything(ctx, scope);

    expect(
      await resolve(asCtx(ctx), scope, {
        op: "union",
        of: [
          { op: "kind", kind: "document" },
          { op: "kind", kind: "slides" },
          { op: "kind", kind: "spreadsheet" },
          { op: "kind", kind: "externalFile" },
          { op: "kind", kind: "finding" }
        ]
      })
    ).toEqual([
      { kind: "document", id: rows.document },
      { kind: "slides", id: rows.slides },
      { kind: "spreadsheet", id: rows.spreadsheet },
      { kind: "externalFile", id: rows.externalFile },
      { kind: "finding", id: rows.finding }
    ]);
  });

  it("returns a set, so a resource selected twice appears once", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");

    expect(
      await resolve(asCtx(ctx), scope, {
        op: "union",
        of: [{ op: "project" }, { op: "kind", kind: "document" }]
      })
    ).toEqual([{ kind: "document", id: notes }]);
  });

  it("expresses intersection as difference(A, difference(A, B))", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const finding = await aFinding(ctx, scope);
    const deck = await aDeck(ctx, scope);

    // A is documents and findings, B is findings and decks, so A ∩ B is the
    // findings. An intersection operator would be a third way to write what
    // these two already cover, so the identity is asserted rather than added to.
    expect(
      await resolve(asCtx(ctx), scope, {
        op: "difference",
        from: {
          op: "union",
          of: [
            { op: "kind", kind: "document" },
            { op: "kind", kind: "finding" }
          ]
        },
        remove: {
          op: "difference",
          from: {
            op: "union",
            of: [
              { op: "kind", kind: "document" },
              { op: "kind", kind: "finding" }
            ]
          },
          remove: {
            op: "union",
            of: [
              { op: "kind", kind: "finding" },
              { op: "kind", kind: "slides" }
            ]
          }
        }
      })
    ).toEqual([{ kind: "finding", id: finding }]);

    expect([notes, deck]).not.toContain(finding);
  });

  it("resolves a reference to another set as that set's expression", async () => {
    const { ctx, scope } = await asking();
    const rows = await someOfEverything(ctx, scope);
    const written = await aSet(ctx, scope, "Written material", {
      op: "union",
      of: [{ op: "kind", kind: "document" }, { op: "kind", kind: "finding" }]
    });

    expect(
      await resolve(asCtx(ctx), scope, {
        op: "difference",
        from: setRef(written),
        remove: { op: "kind", kind: "finding" }
      })
    ).toEqual([{ kind: "document", id: rows.document }]);
  });

  it("fails a two-set cycle naming the sets in it, rather than recursing", async () => {
    const { ctx, scope } = await asking();
    const wide = await aSet(ctx, scope, "Everything we cite", { op: "project" });
    const narrow = await aSet(ctx, scope, "Narrower", setRef(wide));
    await ctx.db.patch(wide, { expression: setRef(narrow) });

    const refusal = await refusalFrom(resolve(asCtx(ctx), scope, setRef(wide)));

    // Two sets referencing each other is a configuration mistake, not an
    // expression — and the fix needs to know which sets are in the loop.
    expect(refusal?.code).toBe("cycle");
    expect(refusal?.cycle?.map((step) => step.name)).toEqual([
      "Everything we cite",
      "Narrower",
      "Everything we cite"
    ]);
    expect(refusal?.cycle?.map((step) => step.id)).toEqual([wide, narrow, wide]);
  });

  it("fails a set that references itself, naming it", async () => {
    const { ctx, scope } = await asking();
    const itself = await aSet(ctx, scope, "Itself", { op: "project" });
    await ctx.db.patch(itself, { expression: setRef(itself) });

    expect(await refusalFrom(resolve(asCtx(ctx), scope, setRef(itself)))).toMatchObject({
      code: "cycle",
      cycle: [
        { id: itself, name: "Itself" },
        { id: itself, name: "Itself" }
      ]
    });
  });

  it("takes the same set twice in one union as a set, not a cycle", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const documents = await aSet(ctx, scope, "Documents", { op: "kind", kind: "document" });

    // A cycle is a set reachable from itself, not one named twice in different
    // branches — which is an ordinary way to build an expression.
    expect(
      await resolve(asCtx(ctx), scope, {
        op: "union",
        of: [setRef(documents), setRef(documents)]
      })
    ).toEqual([{ kind: "document", id: notes }]);
  });

  it("reports not found for a set in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await aSet(ctx, elsewhere, "Theirs", { op: "project" });

    expect(await refusalFrom(resolve(asCtx(ctx), scope, setRef(theirs)))).toMatchObject({
      code: "not-found"
    });
  });

  it("resolves an inline expression, so a scope need not be saved to be used", async () => {
    const { ctx, scope } = await asking();
    const notes = await aDocument(ctx, scope, "Notes");
    const pulled = await aFile(ctx, scope, "roadmap.md", "connectors:notion");
    await aFile(ctx, scope, "uploaded.md");

    expect(
      await resolve(asCtx(ctx), scope, {
        op: "resources",
        refs: [
          { kind: "document", id: notes },
          { kind: "connector", id: "connectors:notion" }
        ]
      })
    ).toEqual([
      { kind: "document", id: notes },
      { kind: "externalFile", id: pulled }
    ]);
  });

  it("stores nothing it resolved, because the answer is a moment", async () => {
    const { ctx, scope } = await asking();
    await aDocument(ctx, scope, "Notes");
    const everything = await aSet(ctx, scope, "Everything", { op: "project" });
    const before = ctx.rows.size;

    await resolve(asCtx(ctx), scope, setRef(everything));

    // A consumer that needs to remember what it saw records the refs and their
    // revisions itself. The set stays lazy; the consumer captures.
    expect(ctx.rows.size).toBe(before);
    expect(ctx.rows.get(everything)).not.toHaveProperty("refs");
    expect(ctx.log).toHaveLength(0);
  });

  it("resolves an empty project to nothing rather than refusing", async () => {
    const { ctx, scope } = await asking();

    expect(await resolve(asCtx(ctx), scope, { op: "project" })).toEqual([]);
  });

  it("reaches no resource outside the caller's project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await someOfEverything(ctx, elsewhere);
    const mine = await aDocument(ctx, scope, "Mine");

    expect(await resolve(asCtx(ctx), scope, { op: "project" })).toEqual([
      { kind: "document", id: mine }
    ]);
  });
});
