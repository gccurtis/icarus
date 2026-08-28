/**
 * CSS read as a tree rather than as text.
 *
 * postcss is already a dependency, and every style check asks a question a
 * regex answers wrongly: which selector a declaration sits under, whether a
 * colour is inside a comment, whether an `@import` is at the top of the file or
 * buried in a media block.
 */
import postcss from "postcss";
import valueParser from "postcss-value-parser";

/**
 * A colour written out rather than named. `currentColor` and `transparent` are
 * neither, and neither is `color-mix()` — it composes values it was handed, so
 * what it produces is whatever those already were.
 */
const COLOUR_FUNCTIONS = new Set([
  "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"
]);
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** The named colours that turn up in real stylesheets. `none` and `inherit` are not colours. */
const NAMED = new Set([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple", "gray", "grey",
  "silver", "maroon", "olive", "lime", "aqua", "teal", "navy", "fuchsia", "cyan", "magenta",
  "pink", "brown", "gold", "beige", "ivory", "khaki", "indigo", "violet", "salmon", "coral",
  "crimson", "tan", "plum", "orchid", "turquoise", "lavender", "wheat", "chocolate", "tomato"
]);

const parse = (text, from) => {
  try {
    return postcss.parse(text, { from });
  } catch {
    // A stylesheet that does not parse is the build's finding, not this one's.
    return null;
  }
};

/** The selectors a node sits beneath, outermost first. `@media` and friends included. */
const contextOf = (node) => {
  const chain = [];
  for (let at = node.parent; at && at.type !== "root"; at = at.parent) {
    chain.unshift(at.type === "atrule" ? `@${at.name} ${at.params}`.trim() : at.selector);
  }
  return chain;
};

/**
 * Every custom property a stylesheet declares, with where it was declared.
 * The same name may appear more than once — under two selectors, or twice under
 * one, which is itself something a check may want to see.
 */
export const declarationsIn = (text, from) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    found.push({
      name: decl.prop,
      value: decl.value.trim(),
      selectors: contextOf(decl),
      selector: contextOf(decl).at(-1) ?? "",
      line: decl.source?.start?.line ?? 1
    });
  });
  return found;
};

/** Every value a stylesheet gives one ordinary property — `color-scheme`, `content`. */
export const valuesOfProperty = (text, from, prop) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  root.walkDecls(prop, (decl) => found.push({ value: decl.value.trim(), line: decl.source?.start?.line ?? 1 }));
  return found;
};

/** Every `var(--x)` a stylesheet reads, wherever it appears. */
export const referencesIn = (text, from) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  const readValue = (value, line, prop) => {
    valueParser(value).walk((node) => {
      if (node.type !== "function" || node.value !== "var") return;
      const [first] = node.nodes;
      if (first?.value?.startsWith("--")) found.push({ name: first.value, line, prop });
    });
  };
  root.walkDecls((decl) => readValue(decl.value, decl.source?.start?.line ?? 1, decl.prop));
  root.walkAtRules((rule) => readValue(rule.params, rule.source?.start?.line ?? 1, `@${rule.name}`));
  return found;
};

/** Whether a value writes a colour out. `var(--x)` does not; `#0a0a0a` does. */
export const literalColoursIn = (value) => {
  const found = [];
  valueParser(value).walk((node) => {
    if (node.type === "function" && COLOUR_FUNCTIONS.has(node.value.toLowerCase())) {
      found.push(`${node.value}()`);
      return false;
    }
    if (node.type === "word") {
      if (HEX.test(node.value)) found.push(node.value);
      else if (NAMED.has(node.value.toLowerCase())) found.push(node.value);
    }
    return undefined;
  });
  return found;
};

/** Declarations whose value writes a colour out rather than naming one. */
export const literalColourDeclarations = (text, from) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  root.walkDecls((decl) => {
    const colours = literalColoursIn(decl.value);
    if (colours.length > 0) {
      found.push({
        prop: decl.prop,
        colours,
        selector: contextOf(decl).at(-1) ?? "",
        line: decl.source?.start?.line ?? 1
      });
    }
  });
  return found;
};

/** `@import` targets, in source order, with whether each is a bare package or a path. */
export const importsIn = (text, from) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  root.walkAtRules("import", (rule) => {
    const target = rule.params.trim().replace(/^["']|["'];?$/g, "").replace(/\s.*$/, "");
    found.push({ target, relative: target.startsWith("."), line: rule.source?.start?.line ?? 1 });
  });
  return found;
};

/** Every at-rule of one name, with its params — `@custom-variant`, `@theme`, `@layer`. */
export const atRulesIn = (text, from, name) => {
  const root = parse(text, from);
  if (!root) return [];
  const found = [];
  root.walkAtRules(name, (rule) => {
    found.push({ params: rule.params.trim(), line: rule.source?.start?.line ?? 1 });
  });
  return found;
};
