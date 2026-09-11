import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneOf } from "$app-views/categories/presentation-editor/procedures/scene";
import type { PresentationBody } from "$representation/data/types/presentations/body";

type Template = { name: string; body: PresentationBody & { resource: string } };
const read = (name: string): Template[] => JSON.parse(readFileSync(resolve("seed", name), "utf8"));
const tokens = readFileSync(resolve("src/lib/styles/tokens/color.css"), "utf8");
const declared = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));

describe("seeded presentation template backgrounds", () => {
  for (const name of ["templates.json", "templateVersions.json"]) {
    it(`${name}: every slide resolves to the current paper token`, () => {
      const templates = read(name).filter((row) => row.body.resource === "presentation");
      expect(templates.length).toBeGreaterThanOrEqual(5);
      for (const template of templates) {
        for (const slide of template.body.slides) {
          const scene = sceneOf(template.body, slide, { width: 1280, height: 720 });
          expect(scene.background, template.name).toBe("var(--token-surface-elevated)");
          for (const [, token] of scene.background.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
            expect(declared.has(token), `${template.name}: undefined background ${token}`).toBe(true);
          }
        }
      }
    });
  }
});
