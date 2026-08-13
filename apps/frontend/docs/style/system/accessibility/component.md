# Accessibility — component

> **Concrete requirements.** Measurable and testable. The stance behind them is
> [theory](theory.md).

## Required in the first stylesheet

Four things must be present from the first line of CSS. None is expensive up
front; each is expensive to retrofit.

- **Visible focus on every interactive element.** A global `:focus-visible` rule
  applying a 2px `--color-interactive-border` perimeter at 2px offset to links,
  buttons, inputs, selects, textareas, `summary`, and anything with `tabindex`.
  The `border` slot is the 3:1 non-text step, which is what a focus perimeter
  has to clear. Available as the [`focus-ring` recipe](../shape.md#named-recipes)
  for manual use.
- **Reduced motion honored.** `prefers-reduced-motion: reduce` collapses
  animation and transition globally while state stays explicit — see
  [Motion → Reduced motion](../motion/theory.md#reduced-motion).
- **Native color-scheme.** Each theme declares `color-scheme`, so form controls,
  scrollbars, and the caret match the surface. The same declaration drives every
  `light-dark()` in the [slot table](../color/slots.md#the-step-table), so a
  theme that omits it is broken in two ways at once.
- **Meaning never rides on color alone.** Every role pairs with an icon and copy,
  per [the state matrix](../interaction/component.md#state-matrix).

## Hard requirements

- Normal text ≥ 4.5:1 contrast; large text and meaningful non-text UI ≥ 3:1.
- Every interactive element has visible keyboard focus.
- Focus order follows visual and task order, and survives tab changes, panel
  collapse, drawer open and close, and overlays.
- Interactive targets ≥ 24×24 CSS px, with primary controls generally larger.
- The primary workflow completes without a mouse.
- Essential actions are never right-click-only, gesture-only, or shortcut-only —
  see [visible paths](../interaction/theory.md#visible-paths).
- State never relies on color alone.
- Reduced-motion preferences are respected.

## Keyboard and focus behaviour

- **Modals trap focus and restore it** to the control that opened them.
- **Drawers and non-modal panels do not trap focus.** A drawer is a place to
  work, not a cage; tabbing past its end returns to the document.
- **Focusing a panel must not destroy the prior selection.** Moving focus to an
  inspector, drawer, or composer while text is selected keeps that selection
  visible — this is what [`--surface-selection`](../shape.md#selection) is held
  for.
- **After completing or escaping, focus returns** to the prior work context when
  it is safe to do so.
- **Suppressed scrollbars still scroll.** Every region hiding its scrollbar
  chrome stays operable by keyboard, and focused content always scrolls into
  view. A region that cannot satisfy that shows its scrollbar. This is a hard
  requirement and holds whether or not a layout module restates it.

## Semantic behaviour

Use native semantic HTML — navigation, headings, buttons, inputs, lists, tables,
dialogs — and add ARIA only where native semantics genuinely fall short.
