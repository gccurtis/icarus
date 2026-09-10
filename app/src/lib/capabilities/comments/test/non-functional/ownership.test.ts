import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const commandSources = {
  startThread: "../../api/start-thread/start-thread.ts",
  reply: "../../api/reply/reply.ts",
  resolveThread: "../../api/resolve-thread/resolve-thread.ts"
} as const;

const filesBelow = (root: string): string[] =>
  readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });

describe("cross-project Comments ownership and browser boundary", () => {
  test("every comment command resolves ownership from scope and writes transactionally", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toContain("scope.projectId");
      expect(source).toContain("store.transaction(");
      expect(source).not.toContain("asked.projectId");
    }
  });

  test("browser production code cannot reach the removed generic Store door", () => {
    const sourceRoot = new URL("../../../../../", import.meta.url).pathname;
    const browserRoots = [
      "lib/app-views",
      "lib/surfaces",
      "lib/runtime/client",
      "lib/model/client"
    ].map((path) => join(sourceRoot, path));
    const forbiddenImport = ["$capabilities", "store", "index.remote"].join("/");
    const offenders = browserRoots.flatMap(filesBelow).filter((path) => {
      if (!/\.(?:ts|svelte)$/.test(path)) return false;
      const source = readFileSync(path, "utf8");
      return source.includes(forbiddenImport) || /\breadStore\s*\(/.test(source);
    });
    expect(offenders).toEqual([]);
    const removed = join(sourceRoot, "lib/capabilities/store");
    expect(existsSync(removed) ? filesBelow(removed) : []).toEqual([]);
  });
});
