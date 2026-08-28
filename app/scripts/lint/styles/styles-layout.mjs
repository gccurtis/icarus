import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { STAGES, TOKEN_FILES, TOKEN_STAGE, stylesRoot } from "../shared/styles.mjs";

export default check({
  name: "styles-layout",
  says: "Only app.css and the three stage directories at the root; token domains stay files rather than becoming directories.",
  run(tree) {
    const root = stylesRoot(tree);
    const found = [];
    if (!tree.exists(root)) return [{ path: root, message: "there is no styles tree" }];

    for (const name of tree.filesIn(root)) {
      if (name === "app.css") continue;
      found.push({ path: join(root, name), message: "the root holds app.css and nothing else" });
    }
    if (!tree.isFile(join(root, "app.css"))) {
      found.push({ path: join(root, "app.css"), message: "there is no door" });
    }
    for (const name of tree.dirsIn(root)) {
      if (STAGES.includes(name)) continue;
      found.push({ path: join(root, name), message: `not one of ${STAGES.join(", ")}` });
    }
    for (const stage of STAGES) {
      if (tree.exists(join(root, stage))) continue;
      found.push({ path: join(root, stage), message: "a stage is missing" });
    }

    // A theme is a directory holding its own stylesheet, and slot resolution is
    // shared by all of them — so it is the one file the stage root owns.
    const themesRoot = join(root, "chromatic-themes");
    const themeRootFiles = ["slots.css", "chromatic-themes.md"];
    for (const name of tree.filesIn(themesRoot)) {
      if (themeRootFiles.includes(name)) continue;
      found.push({ path: join(themesRoot, name), message: "a chromatic value belongs to a theme directory" });
    }
    if (!tree.isFile(join(themesRoot, "slots.css"))) {
      found.push({ path: join(themesRoot, "slots.css"), message: "slot resolution is missing" });
    }
    for (const name of tree.dirsIn(themesRoot)) {
      const theme = join(themesRoot, name);
      if (!tree.isFile(join(theme, `${name}.css`))) {
        found.push({ path: join(theme, `${name}.css`), message: "a theme's stylesheet is named for it" });
      }
      for (const child of tree.filesIn(theme)) {
        if (child === `${name}.css` || child === `${name}.md`) continue;
        found.push({ path: join(theme, child), message: "a theme directory holds its stylesheet and its document" });
      }
      for (const child of tree.dirsIn(theme)) {
        found.push({ path: join(theme, child), message: "a theme has no substructure" });
      }
    }

    const tokensRoot = join(root, TOKEN_STAGE);
    for (const name of TOKEN_FILES) {
      if (tree.isFile(join(tokensRoot, name))) continue;
      found.push({ path: join(tokensRoot, name), message: "a token domain is missing" });
    }
    for (const name of tree.filesIn(tokensRoot)) {
      if (TOKEN_FILES.includes(name) || name === `${TOKEN_STAGE}.md`) continue;
      found.push({ path: join(tokensRoot, name), message: `not one of ${TOKEN_FILES.join(", ")}` });
    }
    for (const name of tree.dirsIn(tokensRoot)) {
      found.push({ path: join(tokensRoot, name), message: "token domains stay flat files" });
    }
    return found;
  }
});
