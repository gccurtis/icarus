import { createRequire } from "node:module";
import { expect, type Page } from "./fixtures";

// Decode the remote command with the same serializer SvelteKit uses. This
// observes the production save boundary without a timer or a test-only API.
const { parse } = createRequire(import.meta.resolve("@sveltejs/kit"))("devalue") as {
  parse: (value: string) => unknown;
};

type LandingMatch = {
  readonly tab: string;
  readonly content: string;
  readonly focus?: (value: string | null) => boolean;
};

type WorkspaceChange = {
  readonly op: string;
  readonly tab?: string;
  readonly now?: string | {
    readonly content: string;
    readonly focus: string | null;
  };
};

const changesIn = (payload: string): readonly WorkspaceChange[] => {
  const decoded = parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    changeSet: { ops: readonly WorkspaceChange[] };
  };
  return decoded.changeSet.ops;
};

const expectAccepted = async (
  request: Awaited<ReturnType<Page["waitForRequest"]>>,
  label: string
): Promise<void> => {
  const response = await request.response();
  expect(response, `${label} received a response`).not.toBeNull();
  expect(response!.ok()).toBe(true);
  const envelope = await response!.json() as { type: string; data: string };
  expect(envelope.type).toBe("result");
  const result = parse(envelope.data) as { _: { accepted: boolean } };
  expect(result._.accepted, `${label} was durably accepted`).toBe(true);
};

export const workspaceActivationSaved = async (page: Page, tab: string): Promise<void> => {
  const request = await page.waitForRequest((candidate) => {
    if (candidate.method() !== "POST" ||
      !new URL(candidate.url()).pathname.endsWith("/submitWorkspaceChanges")) return false;
    const envelope = candidate.postDataJSON() as { payload: string };
    return changesIn(envelope.payload).filter((op) => op.op === "activate").at(-1)?.now === tab;
  });
  await expectAccepted(request, "workspace activation");
};

export const workspaceLandingSaved = async (
  page: Page,
  match: LandingMatch
): Promise<void> => {
  const request = await page.waitForRequest((candidate) => {
    if (candidate.method() !== "POST" ||
      !new URL(candidate.url()).pathname.endsWith("/submitWorkspaceChanges")) return false;
    const envelope = candidate.postDataJSON() as { payload: string };
    const landing = changesIn(envelope.payload)
      .filter((op) => op.op === "land" && op.tab === match.tab)
      .at(-1);
    if (typeof landing?.now !== "object" || landing.now.content !== match.content) return false;
    return match.focus === undefined || match.focus(landing.now.focus);
  });
  await expectAccepted(request, "workspace landing");
};
