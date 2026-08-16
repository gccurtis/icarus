import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import {
  refusalFrom as revisionsRefusalFrom,
  setsStored,
  snapshotsStored
} from "$revisions/test/fixture";
import { create } from "$slide-decks/api/create/create";
import { remove } from "$slide-decks/api/remove/remove";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$slide-decks/test/fixture";

describe("remove", () => {
  it("copies the title into the log before the row it names is gone", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    await remove(asCtx(ctx), scope, id);

    expect(ctx.rows.has(id)).toBe(false);
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "slideDeck", id, label: "Q3 review" }
    });
  });

  it("takes the body with it, so nothing can read the deck after", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");
    const resource = { resourceType: "slides", resourceId: id } as const;

    await remove(asCtx(ctx), scope, id);

    expect(await revisionsRefusalFrom(read(asCtx(ctx), scope, resource))).toMatchObject({
      code: "not-found"
    });
    expect([...setsStored(ctx), ...snapshotsStored(ctx)]).toEqual([]);
  });

  it("reports not found for a deck in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their review", "16:9");

    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(ctx.rows.has(id)).toBe(true);
  });
});
