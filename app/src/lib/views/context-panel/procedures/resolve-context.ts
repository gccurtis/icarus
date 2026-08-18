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
 */
export const CONTEXT_IDS = ["overview", "outline"] as const;

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
 * appearing in several arrays, which `overview` is.
 */
export const CONTEXTS_BY_SCREEN: Record<ScreenKind, readonly ContextId[]> = Object.freeze({
  "project-overview": Object.freeze(["overview"] as const),
  research: Object.freeze(["overview"] as const),
  analysis: Object.freeze(["overview"] as const),
  context: Object.freeze(["overview"] as const),
  templates: Object.freeze(["overview"] as const),
  personas: Object.freeze(["overview"] as const),
  automations: Object.freeze(["overview"] as const),
  document: Object.freeze(["outline", "overview"] as const),
  slides: Object.freeze(["outline", "overview"] as const),
  spreadsheet: Object.freeze(["outline", "overview"] as const),
  "new-tab": Object.freeze(["overview"] as const)
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
