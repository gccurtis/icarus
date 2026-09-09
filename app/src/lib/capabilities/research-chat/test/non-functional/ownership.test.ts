import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  ask: "../../api/ask/ask.ts",
  createThread: "../../api/create-thread/create-thread.ts",
  removeThread: "../../api/remove-thread/remove-thread.ts",
  setThreadPersona: "../../api/set-thread-persona/set-thread-persona.ts",
  stopTurn: "../../api/stop-turn/stop-turn.ts"
} as const;

describe("cross-project Research Chat ownership", () => {
  test("ask, createThread, removeThread, setThreadPersona and stopTurn resolve subjects through the request scope", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toMatch(/scope\.projectId/);
    }
  });

  test("no command takes a project from its own input", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).not.toMatch(/asked\.projectId/);
    }
  });
});
