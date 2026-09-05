/**
 * Assembles the screen deck into one self-contained page.
 *
 * Run from this directory, with `app/node_modules` installed so the IBM Plex
 * files are on disk:
 *
 *   node mkfonts.mjs      # writes fonts.html — base64 @font-face, git-ignored
 *   node build.mjs        # writes ../icarus-screen-deck.html
 *
 * The published artifact is the file this writes. It is wrapped in a
 * doctype/head/body skeleton at publish time, so the file itself opens with a
 * <title> and carries no <html> of its own; `--preview` adds that wrapper so
 * the same output can be opened straight from disk.
 */
import fs from "node:fs";

const PARTS = ["a.html", "fonts.html", "b.html", "c.js", "d.js", "e.js", "f.js"];
const preview = process.argv.includes("--preview");

for (const p of PARTS) {
  if (!fs.existsSync(p)) {
    console.error(`missing ${p}${p === "fonts.html" ? " — run `node mkfonts.mjs` first" : ""}`);
    process.exit(1);
  }
}

const body = PARTS.map((p) => fs.readFileSync(p, "utf8")).join("\n") + "\n</script>\n";

if (preview) {
  const title = fs.readFileSync("a.html", "utf8");
  fs.writeFileSync(
    "_preview.html",
    `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}</style>\n${title}</head><body>\n${
      PARTS.slice(1).map((p) => fs.readFileSync(p, "utf8")).join("\n")
    }\n</script></body></html>\n`
  );
  console.log("_preview.html");
} else {
  fs.writeFileSync("../icarus-screen-deck.html", body);
  console.log("../icarus-screen-deck.html");
}
