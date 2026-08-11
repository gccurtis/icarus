# Typography system

> Status: design baseline aligned to the current Alpha scaffold.

Text is the primary interface material across labels, documents, formulas, live objects, inspector controls, references, status, and review. The typography should be modern, precise, low-fatigue, and open source.

## Fonts

- **IBM Plex Sans:** current primary UI face for chrome, panels, controls, tables, dialogs, and application text. It is already self-hosted in Alpha through `@fontsource`.
- **IBM Plex Mono:** formulas, code-like expressions, identifiers, trace data, logs, and technical tokens.
- **Atkinson Hyperlegible:** optional accessibility preference, not the default brand face.

Earlier Taurus material proposed Inter Variable for the UI. Keep Inter as a historical alternative, but do not introduce it alongside IBM Plex Sans without a deliberate typography decision; one clear primary family is preferable to an accidental mixture.

## Working scale

| Style | Size / line height | Use |
| --- | --- | --- |
| H1 | 34 / 42 | Major screen or page title. |
| H2 | 28 / 36 | Document section or modal title. |
| H3 | 24 / 32 | Panel major heading or task title. |
| H4 | 20 / 28 | Inspector section heading. |
| Body large | 18 / 30 | Optional long-form editor body. |
| Body | 16 / 26 | Main prose and document content. |
| Body compact | 14 / 22 | Panels, tables, and inspector body. |
| Label | 13 / 18 | Controls, tabs, and field labels. |
| Caption | 12 / 16 | Metadata, helper text, and status. |
| Mono | 13 / 20 | Formulas, identifiers, and technical data. |

These are initial values to tune against working editors and real content density.

## Hierarchy laws

- Name the current object, especially at the top of the inspector.
- Prefer labels before icons for common or consequential actions.
- Use sentence case for controls, tabs, menu items, and headings.
- Keep long prose near 60–85 characters per line.
- Metadata affecting trust, provenance, or recovery must remain readable.
- Use weight with another cue; weight alone does not communicate state or interactivity.
- Use tabular figures for versions, timestamps, counts, and numeric grids.

Prompt blocks use UI typography because they are interactive live objects embedded in content. Formula input uses monospace; resolved output uses the typography appropriate to its content.

## Copy voice

Use concrete nouns for destinations—Resources, References, History, Personas—and verbs for action—Create, Open, Insert, Resolve, Review, Accept, Revert. Use explicit states such as Resolving, Stale, Applied, Failed, and Needs review.

The AI Agent Surface should sound operational: “Describe a change to make…” or “Ask about this document…”, not “How can I help?”

Source: [Taurus Typography System](https://app.notion.com/p/392b6410e50281b989c0fc85bab33ed7)
