import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";

const realPackage = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

export const buildFixture = () => {
  const packageRoot = mkdtempSync(join(tmpdir(), "icarus-style-lint-"));
  const stylesRoot = join(packageRoot, "src", "lib", "styles");
  mkdirSync(join(packageRoot, "src", "routes"), { recursive: true });
  mkdirSync(join(packageRoot, "src", "lib", "demo"), { recursive: true });
  cpSync(join(realPackage, "src", "lib", "styles"), stylesRoot, { recursive: true });
  writeFileSync(join(packageRoot, "src", "routes", "+layout.svelte"), '<script>\n  import "$lib/styles/app.css";\n</script>\n');
  writeFileSync(join(packageRoot, "src", "app.html"), '<html data-theme="celestial"></html>\n');
  writeFileSync(join(packageRoot, "components.json"), JSON.stringify({ tailwind: { css: "src/lib/styles/x-integrations/shadcn/generated.css" } }, null, 2));
  writeFileSync(join(packageRoot, "src", "lib", "demo", "palette.svelte"), '<div style="color: var(--palette-blue-normal)"></div>\n');
  return { packageRoot, stylesRoot };
};

export const replace = (path, before, after) => {
  const text = readFileSync(path, "utf8");
  const found = before instanceof RegExp ? before.test(text) : text.includes(before);
  if (!found) throw new Error(`fixture text not found: ${before}`);
  if (before instanceof RegExp) before.lastIndex = 0;
  writeFileSync(path, text.replace(before, after));
};
