import { describe, expect, it } from "vitest";
import { create } from "$documents/api/create/create";
import { remove } from "$documents/api/remove/remove";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$documents/test/fixture";
import { read } from "$revisions/api/read/read";
import { submit } from "$revisions/api/submit/submit";
import {
  refusalFrom as revisionsRefusalFrom,
  setsStored,
  snapshotsStored
} from "$revisions/test/fixture";
import type { Op } from "$revisions/types/change";

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

  it("takes the body with it, so nothing can read or write the document after", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");
    const resource = { resourceType: "document", resourceId: id } as const;
    const adding: Op = { op: "insert", target: "row", path: "rows", after: null, values: [{ id: "r1" }] };
    await submit(asCtx(ctx), scope, { ...resource, baseRevision: 0, ops: [adding] });

    await remove(asCtx(ctx), scope, id);

    // Revisions scopes off the leader and the head set, never the document row,
    // so a body left behind is a document that is gone and still editable.
    expect(await revisionsRefusalFrom(read(asCtx(ctx), scope, resource))).toMatchObject({
      code: "not-found"
    });
    expect(
      await revisionsRefusalFrom(
        submit(asCtx(ctx), scope, { ...resource, baseRevision: 1, ops: [adding] })
      )
    ).toMatchObject({ code: "not-found" });
    expect([...setsStored(ctx), ...snapshotsStored(ctx)]).toEqual([]);
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their plan");

    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(ctx.rows.has(id)).toBe(true);
  });
});
