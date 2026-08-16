import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import { start } from "$revisions/api/shared/start";
import { RESOURCE, asCtx, asking, emptyBody, snapshotsStored } from "$revisions/test/fixture";

describe("start", () => {
  it("makes a resource readable before anyone has edited it", async () => {
    const { ctx, scope } = await asking();

    await start(asCtx(ctx), scope, RESOURCE, emptyBody());

    expect(await read(asCtx(ctx), scope, RESOURCE)).toEqual({ revision: 0, body: emptyBody() });
  });

  it("anchors history as well as the present", async () => {
    const { ctx, scope } = await asking();

    await start(asCtx(ctx), scope, RESOURCE, emptyBody());

    // Consolidation moves the leader forward, so the base is the only anchor
    // left below it — and creation is the one moment its body exists to store.
    expect(snapshotsStored(ctx).map((snapshot) => snapshot.role).sort()).toEqual([
      "base",
      "leader"
    ]);
    expect(snapshotsStored(ctx).every((snapshot) => snapshot.revision === 0)).toBe(true);
  });

  it("scopes the anchors to the caller's project", async () => {
    const { ctx, scope, projectId } = await asking();

    await start(asCtx(ctx), scope, RESOURCE, emptyBody());

    expect(snapshotsStored(ctx).every((snapshot) => snapshot.projectId === projectId)).toBe(true);
  });
});
