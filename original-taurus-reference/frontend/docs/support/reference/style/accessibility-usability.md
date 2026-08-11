# Accessibility and usability

Accessibility is the operational form of intuitiveness, not a later compliance layer. The baseline target is WCAG 2.2 AA or better for the Taurus shell and native components.

## Hard requirements

- Normal text meets at least 4.5:1 contrast; large text and meaningful non-text UI meet at least 3:1.
- Every interactive element has visible keyboard focus.
- Focus order follows the visual and task order and survives tab switches, panel changes, and overlays.
- Interactive targets are at least 24×24 CSS pixels unless a valid exception applies; primary controls should generally be larger.
- The primary workflow can be completed without a mouse.
- Essential actions are never right-click-only, gesture-only, or shortcut-only.
- State never relies on color alone.
- Reduced-motion preferences are respected.

## Cognitive accessibility

Reduce memory load through stable placement, labels, visible choices, recent items, and good defaults. Use plain-language state such as Resolved, Resolving, Stale, Failed, Needs review, Accepted, or Reverted.

Every error should answer:

1. What happened?
2. What can the user do next?
3. Was the user's work preserved?

## Semantic behavior

Use native semantic HTML for navigation, headings, buttons, inputs, lists, tables, and dialogs. Use ARIA where native semantics are insufficient. Announce meaningful dynamic changes without creating a stream of noise for ordinary editing.

Modals trap focus and restore it when closed. Non-modal panels and the focused AI Agent Surface must not trap the keyboard. Truncated meaningful text remains available through expansion, resize, detail, or an accessible label.

## Review gates

A screen is not ready when the primary action is unclear, hidden grouping is unpredictable, focus is invisible, keyboard use fails, contrast is insufficient, targets are too small, live state is icon-only, errors lack recovery, or the task requires secret product knowledge.

Source: [Taurus Accessibility & Usability Guardrails](https://app.notion.com/p/392b6410e50281de8f06c206383e8d2f)
