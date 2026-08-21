import type { ScreenKind } from "$model/client";

/**
 * The context panel's rail positions.
 *
 * **This vocabulary lives here rather than in the model**, and that is the
 * decision worth stating. The workbench remembers a `contextId` per tab and
 * never interprets it — exactly as it remembers an inspection key — so which
 * contexts exist, which screen offers which, and what to do with a stored id
 * that is no longer on the rail are all this view's.
 *
 * The alternative put the menu in the model, and the cost was that a model type
 * grew a member for every screen that arrived. Keeping it here means the model's
 * surface stops changing when a screen does.
 *
 * A context is a way of looking at what surrounds the active resource — its
 * outline, what it relates to, who commented on it. Never a mode of working: a
 * rail entry answers "what else is here?", never "what am I doing?", which is
 * why these are contexts rather than activities.
 *
 * **One id is one component, everywhere it appears.** `variables` is the project
 * Name Manager on every screen that can hold a formula, so it is one id and one
 * file. Where a name means genuinely different content per screen — every screen
 * has an "Overview", and no two show the same thing — the ids differ and the
 * *labels* collide instead. `project` is that case: it is the project overview's
 * own orientation view, and it is labelled "Overview" like the rest of them.
 */
export const CONTEXT_IDS = [
  "overview",
  "outline",
  "project",
  "resources",
  "mentions",
  "people",
  "activity",
  "tasks",
  "health",
  "variables",
  "contexts",
  "templates",

  "newtab-create",
  "newtab-recent",
  "newtab-templates",
  "newtab-bring-in"
] as const;

export type ContextId = (typeof CONTEXT_IDS)[number];

export const isContextId = (value: string): value is ContextId =>
  (CONTEXT_IDS as readonly string[]).includes(value);

/**
 * What each screen's rail offers, **first entry first**.
 *
 * `Record<ScreenKind, …>` rather than a partial map, so a new screen fails to
 * compile until it has been given a rail. A screen reaching the panel with no
 * contexts has no way to render, and finding that at runtime is strictly worse
 * than finding it at build time.
 *
 * The first entry of each array is that screen's default — what the rail shows
 * before the user has chosen. A context may be shared between screens by
 * appearing in several arrays, which `overview` and `variables` both are.
 */
export const CONTEXTS_BY_SCREEN: Record<ScreenKind, readonly ContextId[]> = Object.freeze({
  /**
   * Ten entries, in the order
   * `docs/screen-panel-views/screens/project-overview/overview.md` lists them. Overview
   * leads because it answers "where am I and what is outstanding" without a
   * click; Mentions is third because what a person addressed to you is the only
   * thing worth a permanent interruption.
   */
  "project-overview": Object.freeze([
    "project",
    "resources",
    "mentions",
    "people",
    "activity",
    "tasks",
    "health",
    "variables",
    "contexts",
    "templates"
  ] as const),
  research: Object.freeze(["overview"] as const),
  analysis: Object.freeze(["overview"] as const),
  context: Object.freeze(["overview"] as const),
  templates: Object.freeze(["overview"] as const),
  personas: Object.freeze(["overview"] as const),
  automations: Object.freeze(["overview"] as const),
  document: Object.freeze(["outline", "overview"] as const),
  slides: Object.freeze(["outline", "overview"] as const),
  spreadsheet: Object.freeze(["outline", "overview"] as const),
  "new-tab": Object.freeze([
    "newtab-create",
    "newtab-recent",
    "newtab-templates",
    "newtab-bring-in"
  ] as const)
});

/**
 * Which context a tab is actually on: the one it remembers, or the screen's
 * default.
 *
 * **The fallback is the whole reason this is a procedure rather than a lookup in
 * the markup.** A tab's remembered context can *drift* out of range — a
 * templates tab switching mode swaps to a disjoint rail, and a stored id can
 * outlive the context it named — and a reset rail is harmless where a crash
 * during paint is not.
 *
 * It lives in `procedures/` rather than inside the component so that the drift
 * case is unit-testable. There is no component-render harness in this project,
 * and this is the one piece of context logic that genuinely has a wrong answer.
 */
export const resolveContext = (screen: ScreenKind, stored: string | undefined): ContextId => {
  const available = CONTEXTS_BY_SCREEN[screen];

  return stored !== undefined && isContextId(stored) && available.includes(stored)
    ? stored
    : available[0];
};
