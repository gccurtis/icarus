import { check } from "../shared/check.mjs";

export default check({
  name: "runes-match-the-extension",
  says: "Checked both ways, because either direction is a file that will not behave as written.",
  subjects: {
    "runes-need-svelte-ts": "a file declaring a rune is .svelte.ts, or the rune is never compiled",
    "svelte-ts-needs-runes": "a .svelte.ts file declares one, or it is paying for a transform it does not use"
  },
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("model"))) {
      if (!path.endsWith(".ts") || path.endsWith(".d.ts")) continue;
      const compiled = path.endsWith(".svelte.ts");
      const declares = tree.declaresRunes(path);

      if (declares && !compiled) {
        found.push({ subject: "runes-need-svelte-ts", path, message: "declares a rune but is not .svelte.ts" });
      }
      if (!declares && compiled) {
        found.push({ subject: "svelte-ts-needs-runes", path, message: "is .svelte.ts but declares no rune" });
      }
    }
    return found;
  }
});
