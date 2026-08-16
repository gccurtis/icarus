import { describe, expect, it } from "vitest";
import { start } from "$revisions/api/shared/start";
import { submit } from "$revisions/api/submit/submit";
import { RESOURCE, asCtx, asking, emptyBody, setsStored } from "$revisions/test/fixture";
import type { Op } from "$revisions/types/change";

const typing = (atom: string, at: number, insert: string): Op => ({
  op: "text",
  target: "atom",
  path: `#b7x2/atoms/#${atom}`,
  at,
  insert,
  remove: ""
});

const authored = (baseRevision: number, ops: Op[]) => ({ ...RESOURCE, baseRevision, ops });

/**
 * Two people submitting against the same revision.
 *
 * Nothing here simulates the isolation, because nothing has to: Convex mutations
 * are serializable, so the loser's read set is invalidated the moment the winner
 * commits and the deployment re-runs the loser's handler. The re-run is this
 * same call against the state that beat it, which makes the property this asserts
 * the whole of the guarantee — the handler reads the maximum every time rather
 * than deriving a revision from its input. No unique index, no version field, and
 * no retry loop appear anywhere.
 */
describe("submitting at a taken revision", () => {
  it("re-runs above the revision the winner took", async () => {
    const { ctx, scope } = await asking();
    await start(asCtx(ctx), scope, RESOURCE, emptyBody());
    const mine = authored(0, [typing("a9x1", 0, "mine ")]);

    const winner = await submit(asCtx(ctx), scope, authored(0, [typing("a9x2", 0, "theirs ")]));
    const loser = await submit(asCtx(ctx), scope, mine);

    expect(winner).toEqual({ revision: 1 });
    expect(loser).toEqual({ revision: 2 });
    expect(setsStored(ctx).map((set) => set.revision)).toEqual([1, 2]);
  });
});
