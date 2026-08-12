# Accessibility

> **Committed stance.** Target: **WCAG 2.2 AA or better** for the shell and all
> native components. Accessibility is the operational form of intuitiveness, not
> a later compliance layer.

## Required in the first stylesheet

Four things must be present from the first line of CSS. None is expensive up
front; each is expensive to retrofit.

- **Visible focus on every interactive element.** A global `:focus-visible` rule
  applying a 2px `--color-interactive-normal` perimeter at 2px offset to links,
  buttons, inputs, selects, textareas, `summary`, and anything with `tabindex`.
  Available as the
  [`focus-ring` recipe](../component/surface-recipes.md#named-recipes) for manual
  use.
- **Reduced motion honored.** `prefers-reduced-motion: reduce` collapses
  animation and transition globally while state stays explicit — see
  [Motion → Reduced motion](../catalog/motion.md#reduced-motion).
- **Native color-scheme.** Each theme layer sets `color-scheme`, so form
  controls, scrollbars, and the caret match the surface.
- **Meaning never rides on color alone.** Every semantic role pairs with an icon
  and copy, per [the state matrix](../component/components-and-states.md#state-matrix).

## Hard requirements

- Normal text ≥ 4.5:1 contrast; large text and meaningful non-text UI ≥ 3:1.
- Every interactive element has visible keyboard focus.
- Focus order follows visual and task order, and survives tab changes, panel
  collapse, drawer open and close, and overlays.
- Interactive targets ≥ 24×24 CSS px, with primary controls generally larger.
- The primary workflow completes without a mouse.
- Essential actions are never right-click-only, gesture-only, or shortcut-only —
  see [visible paths](interaction-and-disclosure.md#visible-paths).
- State never relies on color alone.
- Reduced-motion preferences are respected.

## Keyboard and focus behaviour

- **Modals trap focus and restore it** to the control that opened them.
- **Drawers and non-modal panels do not trap focus.** A drawer is a place to
  work, not a cage; tabbing past its end returns to the document.
- **Focusing a panel must not destroy the prior selection.** Moving focus to an
  inspector, drawer, or composer while text is selected keeps that selection
  visible — this is what
  [`--surface-selection`](../catalog/surfaces.md#selection) is held for.
- **After completing or escaping, focus returns** to the prior work context when
  it is safe to do so.
- **Suppressed scrollbars still scroll.** Every region hiding its scrollbar
  chrome stays operable by keyboard, and focused content always scrolls into
  view — see [Surfaces → Scrolling](../component/surface-recipes.md#scrolling).

## Cognitive accessibility

Reduce memory load through stable placement, real labels, visible choices, recent
items, and good defaults.

Use plain-language state: Resolved, Resolving, Stale, Failed, Needs review,
Accepted, Reverted. The vocabulary is fixed in
[Typography → Copy voice](../catalog/typography.md#copy-voice) — one word per state,
everywhere, so a user learns it once.

Every error answers three questions: **what happened, what can be done next, and
was the user's work preserved.**

## Semantic behaviour

Use native semantic HTML — navigation, headings, buttons, inputs, lists, tables,
dialogs — and add ARIA only where native semantics genuinely fall short.

Announce meaningful dynamic changes without producing a stream of noise. A
long-running task that emits an update per processed item is unusable with a
screen reader; announce stage transitions and completion, not increments.
Ordinary editing announces nothing.

Truncated meaningful text stays available through expansion, resize, a detail
view, or an accessible label. Provenance strings and identifiers are frequently
long and frequently truncated, and they are exactly the text a user cannot afford
to lose.

## Review gates

A screen is not ready when:

- the primary action is unclear;
- hidden grouping is unpredictable;
- focus is invisible or its order is wrong;
- keyboard-only use fails at any point on the primary path;
- contrast is insufficient or targets are too small;
- live state is icon-only or color-only;
- an error offers no recovery;
- or the task requires secret product knowledge.

Contrast is carried by the variant ramp rather than by case-by-case judgment:
`normal` meets 3:1 for non-text UI, `emphasized` meets 4.5:1 for body text, and
`strong` meets 7:1 for small or dense text, in both themes. A component that
picks the right variant for the job is compliant by construction. Pairings
outside that contract — colored text on a colored fill, a content step on an
elevated rather than work surface — are measured before use. See
[Color system → Contrast](../catalog/color-system.md#contrast).
