# Typography — theory

> **Committed stance.** Discipline rather than values. The values are in
> [component](component.md).

Text is the primary interface material. These surfaces are read far more than
they are clicked, so typography is modern, precise, low-fatigue, and open
source. Everything below survives a theme swap unchanged, because type does not
vary by theme.

## One family, chosen once

One clear primary family beats an accidental mixture. **Atkinson Hyperlegible**
remains an optional future accessibility preference, not the default brand face.
**Inter** is a historical alternative only — do not introduce it alongside the
sans face without a deliberate typography decision.

Fonts are **self-hosted** and loaded from the application bundle. No CDN, no
runtime font request to a third party — an application should not leak what its
user is reading in order to draw text.

## Hierarchy laws

- **Name the current object**, especially at the top of an inspector or drawer.
  A panel that shows properties without naming what they belong to is a puzzle.
- Prefer labels before icons for common or consequential actions.
- Use sentence case for controls, tabs, menu items, and headings.
- Keep long prose to 60–85 characters per line.
- Metadata affecting trust, provenance, or recovery stays readable: never below
  the `caption` step, never in `--ink-muted`.
- Use weight with another cue. Weight alone communicates neither state nor
  interactivity.
- Use tabular figures (`font-variant-numeric: tabular-nums`) for versions,
  timestamps, counts, confidence values, and every numeric grid, so digits align
  down a column and a changing number does not reflow its neighbours.

Each scale step is a **size and line-height pair**. Both halves are tokens;
setting one without the other is a defect, because the rhythm is the point.

## Code and prose are different materials

Expression and formula **input** uses monospace. Resolved **output** uses the
typography appropriate to its content — a computed sentence is prose, not code.
Embedded interactive blocks use UI typography, because they are controls that
happen to sit inside content.

## Copy voice

The system sounds operational. It describes what it is doing and what it found;
it does not solicit.

- **Concrete nouns for destinations:** name the place, not the metaphor.
- **Verbs for actions:** Create, Open, Insert, Resolve, Refresh, Detach, Review,
  Accept, Revert.
- **Explicit states:** Resolving, Stale, Applied, Failed, Needs review — the
  vocabulary fixed in
  [the state matrix](../interaction/component.md#state-matrix).
- An entry point for derived work reads *"Describe a change to make…"*, never
  *"How can I help you today?"*.

Three laws govern vocabulary, and they are correctness rules rather than
stylistic preferences:

- **One word per concept, everywhere.** A user learns the vocabulary once. A
  synonym introduced for variety costs more than the repetition saved.
- **Distinct concepts never share a word.** Where the model distinguishes two
  things, the copy distinguishes them too, in every surface.
- **Never claim more certainty than the system has.** Derived output is described
  as what it is — proposed, extracted, inferred, computed — and promoted to
  stronger language only once something has actually confirmed it.

Every error answers three questions: what happened, what can be done next, and
whether the user's work was preserved.
