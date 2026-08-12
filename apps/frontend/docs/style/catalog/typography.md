# Typography

> **Concrete tokens.** Exact values. The stylesheet declares these once;
> nothing may hard-code them at a call site.

Text is the primary interface material. These surfaces are read far more than
they are clicked. Typography is modern, precise, low-fatigue, and open source.

## Fonts

| Family | Token | Weights | Use |
| --- | --- | --- | --- |
| **IBM Plex Sans** | `--font-sans` | 400, 500, 600 | Chrome, panels, controls, tables, dialogs, prose. The default body face. |
| **IBM Plex Mono** | `--font-mono` | 400, 500 | Formulas, identifiers, hashes, trace data, logs, timestamps. |

Both are **self-hosted** and loaded from the application bundle. No CDN, no
runtime font request to a third party — an application should not leak what its
user is reading in order to draw text.

| Token | Value |
| --- | --- |
| `--font-sans` | `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, "Cascadia Code", monospace` |

**Atkinson Hyperlegible** remains an optional future accessibility preference,
not the default brand face. **Inter** is a historical alternative only — do not
introduce it alongside IBM Plex Sans without a deliberate typography decision.
One clear primary family beats an accidental mixture.

## Scale

Each step is a **size and line-height pair**. Both halves are tokens; setting one
without the other is a defect, because the rhythm is the point.

| Step | Size token | Size | Leading token | Line height | Use |
| --- | --- | --- | --- | --- | --- |
| h1 | `--text-h1` | 34px / 2.125rem | `--text-h1-leading` | 42px / 2.625rem | Major screen or page title |
| h2 | `--text-h2` | 28px / 1.75rem | `--text-h2-leading` | 36px / 2.25rem | Document section or modal title |
| h3 | `--text-h3` | 24px / 1.5rem | `--text-h3-leading` | 32px / 2rem | Panel major heading, object title |
| h4 | `--text-h4` | 20px / 1.25rem | `--text-h4-leading` | 28px / 1.75rem | Inspector and drawer section heading |
| body-lg | `--text-body-lg` | 18px / 1.125rem | `--text-body-lg-leading` | 30px / 1.875rem | Optional long-form editor body |
| body | `--text-body` | 16px / 1rem | `--text-body-leading` | 26px / 1.625rem | Main prose and document content (default) |
| body-sm | `--text-body-sm` | 14px / 0.875rem | `--text-body-sm-leading` | 22px / 1.375rem | Panels, tables, inspector and drawer body |
| label | `--text-label` | 13px / 0.8125rem | `--text-label-leading` | 18px / 1.125rem | Controls, tabs, field labels |
| caption | `--text-caption` | 12px / 0.75rem | `--text-caption-leading` | 16px / 1rem | Metadata, helper text, status |
| mono | `--text-mono` | 13px / 0.8125rem | `--text-mono-leading` | 20px / 1.25rem | Formulas, identifiers, technical data |

The document root defaults to `--font-sans` at the `body` step.

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
  vocabulary fixed in [the state matrix](../component/components-and-states.md#state-matrix).
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
