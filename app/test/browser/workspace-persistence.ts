import { createRequire } from "node:module";
import { expect, type Page } from "./fixtures";

// Decode the remote command with the same serializer SvelteKit uses. This
// observes the production save boundary without a timer or a test-only API.
const { parse } = createRequire(import.meta.resolve("@sveltejs/kit"))("devalue") as {
  parse: (value: string) => unknown;
};

export const workspaceActivationSaved = async (page: Page, tab: string): Promise<void> => {
  const request = await page.waitForRequest((candidate) => {
    if (candidate.method() !== "POST" ||
      !new URL(candidate.url()).pathname.endsWith("/submitWorkspaceChanges")) return false;
    const envelope = candidate.postDataJSON() as { payload: string };
    const payload = parse(Buffer.from(envelope.payload, "base64url").toString("utf8")) as {
      changeSet: { ops: { op: string; now?: string }[] };
    };
    return payload.changeSet.ops.filter((op) => op.op === "activate").at(-1)?.now === tab;
  });
  const response = await request.response();
  expect(response, "workspace activation received a response").not.toBeNull();
  expect(response!.ok()).toBe(true);
  const envelope = await response!.json() as { type: string; data: string };
  expect(envelope.type).toBe("result");
  const result = parse(envelope.data) as { _: { accepted: boolean } };
  expect(result._.accepted, "workspace activation was durably accepted").toBe(true);
};
