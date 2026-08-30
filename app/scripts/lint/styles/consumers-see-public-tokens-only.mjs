import { check } from "../shared/check.mjs";
import { declarationsIn, literalColoursIn } from "../shared/css.mjs";
import { PRIVATE, stylesRoot, tailwindCss } from "../shared/styles.mjs";

/**
 * The palette page exists to show the palette, so it is the one surface that
 * reaches behind the boundary on purpose.
 */
const DIAGNOSTIC = ["views", "development", "demo", "components", "palette.svelte"];

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

export default check({
  name: "consumers-see-public-tokens-only",
  says: "A component naming anything to the left of the public boundary has reached behind it, and the value it found changes when a theme does.",
  subjects: {
    "authored-consumer": "no private stage variable, no internal stylesheet import, no literal colour",
    "registry-consumer": "a vendored component uses shadcn's bridge vocabulary, so a first-party alias never reaches it"
  },
  run(tree) {
    const found = [];
    const styles = stylesRoot(tree);
    const vendor = tree.path("components", "vendored");
    const diagnostic = tree.path(...DIAGNOSTIC);

    for (const path of tree.files) {
      if (!/\.(svelte|ts|js|css)$/.test(path)) continue;
      if (tree.within(styles, path) || tree.within(vendor, path)) continue;
      const text = tree.read(path);

      for (const match of text.matchAll(PRIVATE)) {
        if (path === diagnostic && match[0].startsWith("--palette-")) continue;
        found.push({
          subject: "authored-consumer",
          path,
          line: lineAt(text, match.index),
          message: `names the private ${match[0]}`
        });
      }
      const internal = text.match(/\$(?:lib\/)?styles\/(?!app\.css)[^"']+\.css/);
      if (internal) {
        found.push({
          subject: "authored-consumer",
          path,
          line: lineAt(text, internal.index),
          message: `imports ${internal[0]} rather than app.css`
        });
      }
      const colour = text.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i);
      if (colour && literalColoursIn(colour[0]).length + (colour[0].endsWith("(") ? 1 : 0) > 0) {
        found.push({
          subject: "authored-consumer",
          path,
          line: lineAt(text, colour.index),
          message: `writes the colour ${colour[0]} out`
        });
      }
    }

    // The forbidden roots are read off the Tailwind adapter rather than listed
    // here, so this cannot drift when a role is added or renamed. Exact-root
    // matching is what keeps bridge names legal: `text-primary-foreground` comes
    // from the bridge and matches no first-party root, while `bg-primary-fill`
    // does.
    const tailwind = tailwindCss(tree);
    if (!tree.isFile(tailwind) || !tree.exists(vendor)) return found;

    const roots = declarationsIn(tree.read(tailwind), tailwind)
      .map(({ name }) => name.match(/^--color-(.+)$/)?.[1])
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
    if (roots.length === 0) return found;

    const escaped = roots.map((root) => root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const pattern = new RegExp(`(?<![\\w-])[a-z-]+-(${escaped})(?![\\w-])`, "g");

    for (const path of tree.under(vendor)) {
      if (!/\.(svelte|ts|js)$/.test(path)) continue;
      const text = tree.read(path);
      for (const match of text.matchAll(pattern)) {
        found.push({
          subject: "registry-consumer",
          path,
          line: lineAt(text, match.index),
          message: `uses the first-party ${match[0]}; change bridge.css instead`
        });
      }
    }
    return found;
  }
});
