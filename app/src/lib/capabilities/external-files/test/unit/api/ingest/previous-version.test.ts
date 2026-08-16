import { describe, expect, it } from "vitest";
import { ingest } from "$external-files/api/ingest/ingest";
import { previousVersion } from "$external-files/api/ingest/previous-version";
import { arriving, asCtx, asking, projectNamed, scopeOf } from "$external-files/test/fixture";

const pulled = (externalId: string) =>
  ({ kind: "connector", connectorId: "connectors:1", externalId }) as const;

describe("previousVersion", () => {
  /**
   * A re-sync cannot name our row — it holds the provider's id, not ours — so
   * the match is the index. Without it every remote change would land as a
   * duplicate rather than a new version of the file we already have.
   */
  it("matches a re-synced file to the row that connector already created", async () => {
    const { ctx, scope, person } = await asking();
    const input = arriving("Plan.docx", pulled("drive-99"));
    const first = await ingest(asCtx(ctx), scope, person, input);

    const found = await previousVersion(asCtx(ctx), scope, pulled("drive-99"));

    expect(found).toBe(first);
  });

  it("matches the newest version, so a chain grows rather than forks", async () => {
    const { ctx, scope, person } = await asking();
    await ingest(asCtx(ctx), scope, person, arriving("Plan.docx", pulled("drive-99")));
    const second = await ingest(
      asCtx(ctx),
      scope,
      person,
      arriving("Plan v2.docx", pulled("drive-99"))
    );

    expect(await previousVersion(asCtx(ctx), scope, pulled("drive-99"))).toBe(second);
  });

  it("matches nothing when the provider's id is one this connector has not sent", async () => {
    const { ctx, scope, person } = await asking();
    await ingest(asCtx(ctx), scope, person, arriving("Plan.docx", pulled("drive-99")));

    expect(await previousVersion(asCtx(ctx), scope, pulled("drive-100"))).toBeUndefined();
  });

  it("matches nothing in another project", async () => {
    const { ctx, scope, person, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await ingest(asCtx(ctx), theirs, person, arriving("Plan.docx", pulled("drive-99")));

    expect(await previousVersion(asCtx(ctx), scope, pulled("drive-99"))).toBeUndefined();
  });

  /** A person re-uploading says which file they are replacing; nothing is inferred. */
  it("takes the id an uploader gave over anything it could match", async () => {
    const { ctx, scope, person } = await asking();
    const named = await ingest(asCtx(ctx), scope, person, arriving("Plan.docx"));
    await ingest(asCtx(ctx), scope, person, arriving("Plan.docx", pulled("drive-99")));

    expect(await previousVersion(asCtx(ctx), scope, pulled("drive-99"), named)).toBe(named);
  });

  it("replaces nothing when an upload names nothing", async () => {
    const { ctx, scope, person } = await asking();
    await ingest(asCtx(ctx), scope, person, arriving("Plan.docx"));

    expect(await previousVersion(asCtx(ctx), scope, { kind: "upload" })).toBeUndefined();
  });
});
