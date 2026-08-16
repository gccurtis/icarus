import { describe, expect, it } from "vitest";
import { ingest } from "$external-files/api/ingest/ingest";
import {
  arriving,
  asCtx,
  asking,
  projectNamed,
  refusalFrom,
  scopeOf
} from "$external-files/test/fixture";
import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";

const agent: Actor = { kind: "agent", taskId: "agentTasks:1" };
const agentLabel = { kind: "agent", name: "Research agent" };

describe("ingest", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, person } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("Q3 forecast.xlsx"));

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      name: "Q3 forecast.xlsx"
    });
  });

  it("classifies the file from its extension on the way in", async () => {
    const { ctx, scope, person } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("Q3 forecast.xlsx"));

    // Stored rather than derived on read, so it can be indexed and so a
    // correction is a write.
    expect(ctx.rows.get(id)).toMatchObject({ extension: "xlsx", kind: "ext-data" });
  });

  it("stores a file it cannot classify rather than refusing it", async () => {
    const { ctx, scope, person } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("floorplan.dwg"));

    expect(ctx.rows.get(id)).toMatchObject({ extension: "dwg", kind: "ext-unknown" });
    expect(ctx.rows.get(id)?.extraction).toBeUndefined();
  });

  it("queues extraction for a file there is something to read out of", async () => {
    const { ctx, scope, person } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("contract.pdf"));

    expect(ctx.rows.get(id)).toMatchObject({ extraction: { state: "pending" } });
  });

  it("attributes the file to whoever put it here", async () => {
    const { ctx, scope, person, userId } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("notes.md"));

    expect(ctx.rows.get(id)).toMatchObject({ createdBy: { kind: "user", userId } });
  });

  it("keeps origin beside createdBy, because they answer different questions", async () => {
    const { ctx, scope, person } = await asking();
    const origin = {
      kind: "connector",
      connectorId: "connectors:1",
      externalId: "drive-99",
      externalUrl: "https://drive.example.com/drive-99"
    } as const;

    const id = await ingest(asCtx(ctx), scope, person, arriving("Plan.docx", origin), agentLabel);

    // Who put it here is the person; where the bytes came from is the provider,
    // with the id a re-sync matches on and the URL that opens it at the source.
    expect(ctx.rows.get(id)).toMatchObject({ createdBy: { kind: "user" }, origin });
  });

  it("records the arrival, naming how the file got here", async () => {
    const { ctx, scope, person } = await asking();

    const id = await ingest(asCtx(ctx), scope, person, arriving("notes.md"));

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "uploaded",
      target: { type: "externalFile", id, label: "notes.md" }
    });
  });

  it("says an agent produced a file rather than uploaded one", async () => {
    const { ctx, scope } = await asking();
    const origin = { kind: "generated", agentTaskId: "agentTasks:1" as Id<"agentTasks"> } as const;

    const id = await ingest(asCtx(ctx), scope, agent, arriving("chart.png", origin), agentLabel);

    expect(ctx.rows.get(id)).toMatchObject({ origin, createdBy: agent });
    expect(ctx.log.at(-1)).toMatchObject({ verb: "generated" });
  });

  /**
   * An agent cannot upload from nowhere — there is no source for it to upload
   * from. Producing a file is the `generated` case, and saying so is what keeps
   * the record of where bytes came from worth reading.
   */
  it("refuses an upload that came from no person, and writes nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(ingest(asCtx(ctx), scope, agent, arriving("stolen.pdf"), agentLabel))
    ).toMatchObject({ code: "upload-needs-user" });
    expect(ctx.log).toEqual([]);
  });

  it("refuses a file nobody could pick out of a list", async () => {
    const { ctx, scope, person } = await asking();

    expect(await refusalFrom(ingest(asCtx(ctx), scope, person, arriving("   ")))).toMatchObject({
      code: "empty-name"
    });
    expect(ctx.log).toEqual([]);
  });

  /**
   * Bytes are immutable, so a new version is a new row. The old row still exists
   * in full, which is what keeps every reference already made to it working.
   */
  it("supersedes without rewriting the file it replaces", async () => {
    const { ctx, scope, person } = await asking();
    const first = await ingest(asCtx(ctx), scope, person, arriving("Plan.docx"));
    const before = { ...ctx.rows.get(first) };

    const second = await ingest(asCtx(ctx), scope, person, {
      ...arriving("Plan.docx"),
      storageId: arriving("Plan v2.docx").storageId,
      supersedes: first
    });

    expect(ctx.rows.get(second)).toMatchObject({ supersedes: first });
    expect(ctx.rows.get(first)).toEqual(before);
  });

  it("reports not found when the file it would replace is another project's", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const first = await ingest(asCtx(ctx), theirs, person, arriving("Plan.docx"));

    expect(
      await refusalFrom(
        ingest(asCtx(ctx), scope, person, { ...arriving("Plan.docx"), supersedes: first })
      )
    ).toMatchObject({ code: "not-found" });
  });
});
