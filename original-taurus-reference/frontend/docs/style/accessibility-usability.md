# Accessibility and usability (authoritative)

> Status: **authoritative — committed stance + implemented baseline.**
> Accessibility is the operational form of intuitiveness, not a later compliance
> layer. Target: **WCAG 2.2 AA or better** for the shell and native components.
> Full rationale: [reference baseline](../support/reference/style/accessibility-usability.md).

## Implemented today (in `src/app.css`)

- **Visible focus on every interactive element.** A global `:focus-visible` rule
  applies a 2px `focus`-color perimeter with 2px offset to links, buttons,
  inputs, selects, textareas, `summary`, and anything with `tabindex`. Also
  available as the `focus-ring` utility for manual use.
- **Reduced motion honored.** `prefers-reduced-motion: reduce` collapses
  animations and transitions globally while keeping state explicit.
- **Native color-scheme.** Each theme sets `color-scheme` (`light` / `dark`) so
  form controls, scrollbars, and caret match the surface.
- **Meaning never rides on color alone.** Semantic roles are always paired with
  icon + copy in components (see the [color usage laws](color-system.md#usage-laws)).

## Hard requirements (upheld as we build)

- Normal text ≥ 4.5:1 contrast; large text and meaningful non-text UI ≥ 3:1.
- Every interactive element has visible keyboard focus.
- Focus order follows visual/task order and survives tab switches, panel changes,
  and overlays.
- Interactive targets ≥ 24×24 CSS px (primary controls generally larger).
- The primary workflow completes without a mouse.
- Essential actions are never right-click-only, gesture-only, or shortcut-only.
- State never relies on color alone.
- Reduced-motion preferences are respected.

## Cognitive accessibility

Reduce memory load through stable placement, labels, visible choices, recent
items, and good defaults. Use plain-language state: Resolved, Resolving, Stale,
Failed, Needs review, Accepted, Reverted. Every error answers: what happened,
what can the user do next, and was their work preserved.

## Semantic behavior

Use native semantic HTML (navigation, headings, buttons, inputs, lists, tables,
dialogs); add ARIA only where native semantics fall short. Announce meaningful
dynamic changes without a stream of noise. Modals trap and restore focus;
non-modal panels and the focused AI Agent Surface must not trap the keyboard.
Truncated meaningful text stays available via expansion, resize, detail, or an
accessible label.

## Review gates

A screen is not ready when the primary action is unclear, hidden grouping is
unpredictable, focus is invisible, keyboard use fails, contrast is insufficient,
targets are too small, live state is icon-only, errors lack recovery, or the task
requires secret product knowledge.

> **Not yet validated:** token contrast pairings have been chosen with AA in mind
> but not machine-verified across every combination. Validate against real
> surfaces before claiming AA conformance.
