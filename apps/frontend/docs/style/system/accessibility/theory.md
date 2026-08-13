# Accessibility — theory

> **Committed stance.** Target: **WCAG 2.2 AA or better** for the shell and all
> native components. Accessibility is the operational form of intuitiveness, not
> a later compliance layer. The measurable requirements are in
> [component](component.md).

If the system is easy to think in, it is easy to operate without a mouse, at low
vision, and under cognitive load. Where those come apart, the north star was
aspirational rather than real.

## Compliance by construction

Contrast is carried by the [slot table](../color/slots.md#the-step-table) rather
than by case-by-case judgment: `border` meets 3:1 for non-text UI, `fill` meets
4.5:1 so `on-fill` is legible on it, and `text` meets 7:1 for small or dense
text — in every theme, measured against that theme's own work surface.

**A component that picks the right slot for the job is compliant.** This is the
main reason a component picks a job rather than an intensity: an intensity can
be chosen wrongly, a job cannot.

Pairings outside that contract — a role's `text` on another role's `fill`, a
content slot on an elevated rather than work surface — are measured before use.

## Cognitive accessibility

Reduce memory load through stable placement, real labels, visible choices, recent
items, and good defaults.

Use plain-language state: Resolved, Resolving, Stale, Failed, Needs review,
Accepted, Reverted. The vocabulary is fixed in
[Typography → Copy voice](../typography/theory.md#copy-voice) — one word per
state, everywhere, so a user learns it once.

Every error answers three questions: **what happened, what can be done next, and
was the user's work preserved.**

## Announce meaning, not increments

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
