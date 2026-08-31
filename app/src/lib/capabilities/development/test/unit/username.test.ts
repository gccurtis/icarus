import assert from "node:assert/strict";
import { it, vi } from "vitest";

const scope = vi.hoisted(() => ({ projectId: "default", userId: "default-user", username: "Ana Duarte" }));

vi.mock("$runtime/server/scope.server", () => ({ requireScope: () => Promise.resolve(scope) }));

const { username } = await import("$capabilities/development/api/username/username");

it("answers the name on the scope the request was gated by", async () => {
  assert.equal(await username(), "Ana Duarte");
});
