import { afterEach, describe, expect, it, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf, variablesStored } from "$name-manager/test/fixture";

const MARGIN = { name: "Target Margin", declaredType: "number", value: { kind: "number", value: 42 } } as const;

afterEach(() => vi.restoreAllMocks());

describe("define", () => {
  it("scopes what it creates to the caller's project, under both forms of the name", async () => {
    const { ctx, scope } = await asking();

    const id = await define(asCtx(ctx), scope, MARGIN);

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      name: "Target Margin",
      nameKey: "targetmargin",
      declaredType: "number",
      value: { kind: "number", value: 42 }
    });
  });

  it("attributes the definition to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await define(asCtx(ctx), scope, MARGIN);

    expect(ctx.rows.get(id)).toMatchObject({ createdBy: { kind: "user", userId } });
  });

  it("records the definition in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await define(asCtx(ctx), scope, MARGIN);

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "defined",
      target: { type: "variable", id, label: "Target Margin" }
    });
  });

  it("enforces one name per project itself, because no index can", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, MARGIN);

    // A different spelling of the same name. Uniqueness is on the lookup form.
    const refusal = await refusalFrom(
      define(asCtx(ctx), scope, { ...MARGIN, name: "targetmargin" })
    );

    expect(refusal).toMatchObject({ code: "name-conflict" });
    expect(variablesStored(ctx)).toHaveLength(1);
  });

  it("lets two projects each hold the name", async () => {
    const { ctx, scope, userId } = await asking();
    const elsewhere = scopeOf(await projectNamed(ctx, "Another"), userId);

    await define(asCtx(ctx), scope, MARGIN);
    await define(asCtx(ctx), elsewhere, MARGIN);

    expect(variablesStored(ctx)).toHaveLength(2);
  });

  it("decides the name conflict before the type and the value", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, MARGIN);

    // Both wrong at once: the name is taken *and* a function was sent for a
    // number. An author correcting a typo in a value should not be told their
    // value is malformed when the real problem is that the name is taken.
    const refusal = await refusalFrom(
      define(asCtx(ctx), scope, {
        name: "TARGETMARGIN",
        declaredType: "number",
        value: { kind: "function", parameters: [], expression: "SUM(A1:A10)" }
      })
    );

    expect(refusal).toMatchObject({ code: "name-conflict" });
  });

  it("evaluates nothing — a function call declared as a number is not a number", async () => {
    const { ctx, scope } = await asking();

    const refusal = await refusalFrom(
      define(asCtx(ctx), scope, {
        name: "Total",
        declaredType: "number",
        value: { kind: "function", parameters: [], expression: "SUM(A1:A10)" }
      })
    );

    expect(refusal).toMatchObject({ code: "type-mismatch" });
    expect(variablesStored(ctx)).toHaveLength(0);
  });

  it("orders definitions by a counter, not by the clock", async () => {
    const { ctx, scope } = await asking();
    // Every definition in the same millisecond: creation time cannot order
    // these, and a list that reshuffles between reads is worse than an
    // arbitrary but stable order.
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const ids = [];
    for (const name of ["First", "Second", "Third"]) {
      ids.push(await define(asCtx(ctx), scope, { ...MARGIN, name }));
    }

    expect(ids.map((id) => ctx.rows.get(id)?.definitionOrder)).toEqual([1, 2, 3]);
  });

  it("counts definitions per project, so one project's order is not the other's", async () => {
    const { ctx, scope, userId } = await asking();
    const elsewhere = scopeOf(await projectNamed(ctx, "Another"), userId);
    await define(asCtx(ctx), scope, { ...MARGIN, name: "First" });
    await define(asCtx(ctx), scope, { ...MARGIN, name: "Second" });

    const id = await define(asCtx(ctx), elsewhere, { ...MARGIN, name: "First" });

    expect(ctx.rows.get(id)).toMatchObject({ definitionOrder: 1 });
  });

  it("refuses a name that is only whitespace", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(define(asCtx(ctx), scope, { ...MARGIN, name: "  " }))).toMatchObject({
      code: "empty-name"
    });
    expect(ctx.log).toEqual([]);
  });
});
