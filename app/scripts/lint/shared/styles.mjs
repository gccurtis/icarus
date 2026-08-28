/**
 * The four stages, and what each one is allowed to say.
 *
 * A stage is a namespace and a direction: it declares its own prefix and reads
 * the stage behind it. Everything the style checks do is one of those two
 * questions asked about one file, so the tables live here and the checks stay
 * short enough to read.
 */
import { join, sep } from "node:path";

export const STAGES = ["chromatic-themes", "semantic-tokens", "x-integrations"];
export const TOKEN_STAGE = "semantic-tokens";
export const TOKEN_FILES = ["color.css", "typography.css", "spacing.css", "shape.css", "motion.css"];

/**
 * The complete role assignment. A role binds directly to one chromatic family,
 * and this table is the only place a hue is chosen. Meaning roles are fixed;
 * identity and brand roles may share a hue with one another but never with a
 * meaning role — a person who has learnt that red means danger has learnt it
 * everywhere.
 */
export const MEANING_ROLES = { success: "green", danger: "red", attention: "amber", inactive: "grey" };
export const IDENTITY_ROLES = { interactive: "blue", active: "cyan", intelligence: "violet" };
export const BRAND_ROLES = { primary: "blue", secondary: "cyan", "accent-1": "pink", "accent-2": "teal" };
export const ROLES = { ...MEANING_ROLES, ...IDENTITY_ROLES, ...BRAND_ROLES };
export const SLOTS = ["surface", "surface-hover", "border", "fill", "fill-hover", "text", "on-fill"];

/** What a consumer must never name: anything behind the public token boundary. */
export const PRIVATE = /--(?:palette|theme|chromatic)-(?:[a-z0-9-]+|\{)/g;

/** `:root, [data-theme="x"]` is two selectors written on one rule. */
export const selectorParts = (selectors) =>
  selectors.flatMap((selector) => selector.split(",").map((part) => part.trim()));

/** Whether a theme is the default: it binds `:root` on its own, not only its attribute. */
export const bindsRoot = (parts) =>
  parts.some((part) => part.includes(":root") && !part.includes("[data-theme"));

export const stylesRoot = (tree) => tree.path("styles");
export const appCss = (tree) => join(stylesRoot(tree), "app.css");
export const slotsCss = (tree) => join(stylesRoot(tree), "chromatic-themes", "slots.css");
export const generatedCss = (tree) => join(stylesRoot(tree), "x-integrations", "shadcn", "generated.css");
export const tailwindCss = (tree) => join(stylesRoot(tree), "x-integrations", "tailwind", "tailwind.css");

/** Every stylesheet under `styles/`, with the quarantined one left out. */
export const stylesheets = (tree, { includeGenerated = false } = {}) =>
  tree
    .under(stylesRoot(tree))
    .filter((path) => path.endsWith(".css"))
    .filter((path) => includeGenerated || path !== generatedCss(tree));

/** Which stage a stylesheet belongs to. Everything downstream branches on this. */
export const stageOf = (tree, path) => {
  const root = stylesRoot(tree);
  if (path === appCss(tree)) return "door";
  if (path === slotsCss(tree)) return "slots";
  if (path.startsWith(join(root, "chromatic-themes") + sep)) return "theme";
  if (path.startsWith(join(root, TOKEN_STAGE) + sep)) return "token";
  if (path.startsWith(join(root, "x-integrations") + sep)) return "integration";
  return null;
};

/** The prefix each stage declares, as a test over a custom-property name. */
export const OWNS = {
  theme: (name) => /^--(?:palette|theme)-/.test(name),
  slots: (name) => name.startsWith("--chromatic-"),
  token: (name) => name.startsWith("--token-"),
  integration: (name) => !/^--(?:palette|theme|chromatic|token)-/.test(name)
};

/** What each stage may read: the stage behind it, and never past the public boundary. */
export const READS = {
  theme: (name) => name.startsWith("--palette-"),
  slots: (name) => /^--(?:palette|theme)-/.test(name),
  token: (name) => /^--(?:token|theme|chromatic)-/.test(name),
  integration: (name) => name.startsWith("--token-"),
  door: (name) => name.startsWith("--token-")
};
