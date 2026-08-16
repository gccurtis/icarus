import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { ingest } from "$external-files/api/ingest/ingest";
import { requireFile } from "$external-files/api/shared/require-file";
import {
  arriving,
  asCtx,
  asking,
  projectNamed,
  refusalFrom,
  scopeOf
} from "$external-files/test/fixture";

describe("requireFile", () => {
  it("gives back the row an id names in the caller's project", async () => {
    const { ctx, scope, person } = await asking();
    const id = await ingest(asCtx(ctx), scope, person, arriving("Q3 forecast.xlsx"));

    expect(await requireFile(asCtx(ctx), scope, id)).toMatchObject({
      _id: id,
      name: "Q3 forecast.xlsx"
    });
  });

  /**
   * Not found, never forbidden: telling the two apart would confirm the file
   * exists to someone with no right to know that.
   */
  it("answers for another project's file exactly as for one that never existed", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await ingest(asCtx(ctx), theirs, person, arriving("Their plan.docx"));
    const absent = "externalFiles:404" as unknown as Id<"externalFiles">;

    const forTheirs = await refusalFrom(requireFile(asCtx(ctx), scope, id));
    const forAbsent = await refusalFrom(requireFile(asCtx(ctx), scope, absent));

    expect(forTheirs?.code).toBe("not-found");
    expect(forAbsent?.code).toBe("not-found");
  });
});
