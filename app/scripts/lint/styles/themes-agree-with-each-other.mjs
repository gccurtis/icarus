import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { declarationsIn, valuesOfProperty } from "../shared/css.mjs";
import {
  MEANING_ROLES,
  ROLES,
  SLOTS,
  TOKEN_STAGE,
  bindsRoot,
  selectorParts,
  stylesRoot,
  tailwindCss
} from "../shared/styles.mjs";
import { themes } from "../shared/trees.mjs";

const namesIn = (tree, path) => declarationsIn(tree.read(path), path);

export default check({
  name: "themes-agree-with-each-other",
  says: "A token present in one theme and missing in another is a value that resolves to nothing under the second.",
  subjects: {
    "same-token-set": "every theme declares the same tokens, and exactly one binds :root",
    "registration-matches": "the default agrees with app.html, and dark themes match Tailwind's dark variant",
    "complete-role-families": "every colour role declares all seven slots, each a direct alias whose slot matches",
    "meaning-hues-pinned": "meaning roles hold their fixed hues, and no role spans two chromatic families"
  },
  run(tree) {
    const found = [];
    const present = themes(tree).filter(({ css }) => tree.isFile(css));
    if (present.length === 0) return found;

    const baseline = [...new Set(namesIn(tree, present[0].css).map(({ name }) => name))].sort().join("\n");
    let defaultTheme = null;
    let ambiguous = false;
    const dark = [];

    for (const { name, css } of present) {
      const declarations = namesIn(tree, css);
      const selectors = selectorParts(declarations.flatMap(({ selectors: chain }) => chain));

      if (!selectors.some((selector) => selector.includes(`[data-theme="${name}"]`))) {
        found.push({ subject: "same-token-set", path: css, message: `does not bind [data-theme="${name}"]` });
      }
      if (bindsRoot(selectors)) {
        if (defaultTheme) ambiguous = true;
        defaultTheme ??= name;
      }

      const schemes = valuesOfProperty(tree.read(css), css, "color-scheme").map(({ value }) => value);
      if (schemes.length !== 1 || !["light", "dark"].includes(schemes[0])) {
        found.push({
          subject: "same-token-set",
          path: css,
          message: `declares ${schemes.length} color-scheme values, not one light or dark`
        });
      } else if (schemes[0] === "dark") {
        dark.push(name);
      }

      const set = [...new Set(declarations.map(({ name: prop }) => prop))].sort().join("\n");
      if (set !== baseline) {
        found.push({ subject: "same-token-set", path: css, message: "declares a different set of tokens from the default" });
      }
    }

    if (!defaultTheme || ambiguous) {
      found.push({
        subject: "same-token-set",
        path: join(stylesRoot(tree), "chromatic-themes"),
        message: ambiguous ? "more than one theme binds :root" : "no theme binds :root"
      });
    }

    const html = join(tree.src, "app.html");
    const registered = tree.exists(html) ? (tree.read(html).match(/data-theme="([^"]+)"/) ?? [])[1] : null;
    if (registered !== defaultTheme) {
      found.push({
        subject: "registration-matches",
        path: html,
        message: `names ${registered ?? "no theme"}; the default is ${defaultTheme ?? "undecided"}`
      });
    }

    const tailwind = tailwindCss(tree);
    const variants = tree.isFile(tailwind)
      ? [...new Set([...tree.read(tailwind).matchAll(/data-theme="([^"]+)"/g)].map((match) => match[1]))].sort()
      : [];
    if (variants.join("\n") !== [...dark].sort().join("\n")) {
      found.push({
        subject: "registration-matches",
        path: tailwind,
        message: `the dark variant lists ${variants.join(", ") || "nothing"}; the dark themes are ${dark.join(", ") || "none"}`
      });
    }

    const colour = join(stylesRoot(tree), TOKEN_STAGE, "color.css");
    if (!tree.isFile(colour)) return found;

    const bound = new Map();
    for (const { name, value, line } of namesIn(tree, colour)) {
      if (!name.startsWith("--token-color-")) continue;
      const role = Object.keys(ROLES).find((candidate) => name.startsWith(`--token-color-${candidate}-`));
      const slot = role ? name.slice(`--token-color-${role}-`.length) : null;
      if (!role || !SLOTS.includes(slot)) {
        found.push({ subject: "complete-role-families", path: colour, line, message: `${name} is not a declared role and slot` });
        continue;
      }
      const alias = value.match(/^var\(--chromatic-([a-z]+)-(.+)\)$/);
      if (!alias || alias[2] !== slot) {
        found.push({
          subject: "complete-role-families",
          path: colour,
          line,
          message: `${name} must alias --chromatic-<hue>-${slot} directly`
        });
        continue;
      }
      bound.set(`${role}/${slot}`, alias[1]);
    }

    for (const role of Object.keys(ROLES)) {
      for (const slot of SLOTS) {
        if (bound.has(`${role}/${slot}`)) continue;
        found.push({ subject: "complete-role-families", path: colour, message: `${role} is missing the ${slot} slot` });
      }
    }

    const meaningHues = new Set(Object.values(MEANING_ROLES));
    for (const [role, hue] of Object.entries(ROLES)) {
      const actual = bound.get(`${role}/surface`);
      if (!actual) continue;
      if (role in MEANING_ROLES && actual !== hue) {
        found.push({ subject: "meaning-hues-pinned", path: colour, message: `${role} is fixed to ${hue}, not ${actual}` });
      }
      if (!(role in MEANING_ROLES) && meaningHues.has(actual)) {
        found.push({ subject: "meaning-hues-pinned", path: colour, message: `${role} reuses the fixed-meaning hue ${actual}` });
      }
      const spans = SLOTS.filter((slot) => bound.get(`${role}/${slot}`) !== actual);
      if (spans.length > 0) {
        found.push({ subject: "meaning-hues-pinned", path: colour, message: `${role} spans more than one hue (${spans.join(", ")})` });
      }
    }
    return found;
  }
});
