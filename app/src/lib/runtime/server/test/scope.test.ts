import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { resolveScope, resolveSession } from "$runtime/server/scope.server";

/**
 * The authorization boundary.
 *
 * `resolveScope` is the reason no capability procedure carries a membership
 * check: a `Scope` exists only because this function produced one, and it only
 * produces one for a project the asking user holds a handle to. That claim is
 * load-bearing for every procedure in the application and was, until this file,
 * proven nowhere.
 *
 * The rejection paths matter most. They are written now and will first be
 * *taken* the day real authentication lands, so a test is what keeps them honest
 * in between — the alternative is discovering on that day that the 404 was a
 * fallback all along.
 */
const configured = vi.hoisted(() => ({
  values: new Map<string, unknown>()
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => ({
    configuration: { get: (key: string) => configured.values.get(key) }
  })
}));

beforeEach(() => {
  configured.values = new Map<string, unknown>([
    ["development.userId", "dev-user"],
    ["development.username", "Dev User"],
    ["development.projectToken", "dev-token"],
    ["development.projectId", "default"]
  ]);
});

/** The status an `error()` from kit carries, or nothing if it threw otherwise. */
const statusOf = (thrown: unknown): unknown =>
  typeof thrown === "object" && thrown !== null && "status" in thrown
    ? (thrown as { status: unknown }).status
    : undefined;

const rejects = async (run: () => Promise<unknown>, status: number, note: string) => {
  await assert.rejects(run, (thrown: unknown) => {
    assert.equal(statusOf(thrown), status, note);
    return true;
  });
};

// ------------------------------------------------------------- session ----

test("a session is the user the configuration names", async () => {
  const session = await resolveSession({ get: () => undefined });

  assert.deepEqual(session, { userId: "dev-user", username: "Dev User" });
});

test("a missing development user is a startup-shaped failure, not a 401", async () => {
  // Nobody is unauthorized here — the deployment is misconfigured, and saying so
  // in the configuration's own words is what makes it findable.
  configured.values.delete("development.userId");

  await assert.rejects(
    () => resolveSession({ get: () => undefined }),
    /development\.userId.*non-empty string/
  );
});

// --------------------------------------------------------------- scope ----

test("a valid handle resolves to the project it names, for the asking user", async () => {
  const scope = await resolveScope({ userId: "dev-user", username: "Dev User" }, "dev-token");

  assert.deepEqual(scope, { projectId: "default", userId: "dev-user", username: "Dev User" });
});

test("no token is a 400 — the caller left something out", async () => {
  await rejects(() => resolveScope({ userId: "dev-user", username: "Dev User" }, undefined), 400, "absent token");
  await rejects(() => resolveScope({ userId: "dev-user", username: "Dev User" }, ""), 400, "empty token");
});

test("an unknown handle is a 404, never a fallback", async () => {
  // The failure that matters: resolving to *something* would hand the caller a
  // project they never asked for and hold no authority over.
  await rejects(() => resolveScope({ userId: "dev-user", username: "Dev User" }, "not-a-handle"), 404, "unknown token");
});

test("another user's handle is a 404 for this user", async () => {
  // The lookup is the authorization. A handle is only ever resolved within the
  // asking user's own rows, so a valid token belonging to someone else resolves
  // to nothing at all — there is no separate membership check to forget.
  await rejects(() => resolveScope({ userId: "someone-else", username: "Someone Else" }, "dev-token"), 404, "other user");
});

test("an unauthorized caller is not told the project exists", async () => {
  // 404 rather than 403, deliberately: distinguishing "not yours" from "no such
  // project" is itself a disclosure.
  const unknown = await resolveScope({ userId: "dev-user", username: "Dev User" }, "nope").catch(
    (thrown: unknown) => thrown
  );
  const others = await resolveScope({ userId: "someone-else", username: "Someone Else" }, "dev-token").catch(
    (thrown: unknown) => thrown
  );

  assert.equal(statusOf(unknown), statusOf(others));
});

test("a scope never carries authority the caller named", async () => {
  // Every field is derived: the user from the session cookie, the project from a
  // lookup. Nothing a caller sent appears in the result, which is why no input
  // type carries a projectId or a userId.
  const scope = await resolveScope({ userId: "dev-user", username: "Dev User" }, "dev-token");

  assert.notEqual(scope.projectId, "dev-token");
  assert.deepEqual(Object.keys(scope).sort(), ["projectId", "userId", "username"]);
});
