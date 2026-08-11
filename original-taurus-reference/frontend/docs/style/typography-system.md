# Typography system (authoritative)

> Status: **authoritative**. Values implemented in [`src/app.css`](../../src/app.css).
> Rationale: [reference baseline](../support/reference/style/typography-system.md).

Text is the primary interface material. Typography is modern, precise,
low-fatigue, and open source.

## Fonts

| Family | Token / utility | Loaded weights | Use |
| --- | --- | --- | --- |
| **IBM Plex Sans** | `--font-sans` / `font-sans` | 400, 500, 600 | Chrome, panels, controls, tables, dialogs, application text. Default body face. |
| **IBM Plex Mono** | `--font-mono` / `font-mono` | 400, 500 | Formulas, identifiers, trace data, logs, timestamps, technical tokens. |

Both are self-hosted offline via `@fontsource` (imported in `src/app.css`).
Fallbacks: `font-sans` → `ui-sans-serif, system-ui, sans-serif`; `font-mono` →
`ui-monospace, 'Cascadia Code', monospace`.

**Atkinson Hyperlegible** remains an optional future accessibility preference,
not the default brand face. **Inter** is a historical alternative only — do not
introduce it alongside IBM Plex Sans without a deliberate typography decision.

## Scale

Each step is a Tailwind `text-*` utility that carries its own line-height.

| Utility | Token | Size | Line height | Use |
| --- | --- | --- | --- | --- |
| `text-h1` | `--text-h1` | 34px (2.125rem) | 42px (2.625rem) | Major screen or page title |
| `text-h2` | `--text-h2` | 28px (1.75rem) | 36px (2.25rem) | Document section or modal title |
| `text-h3` | `--text-h3` | 24px (1.5rem) | 32px (2rem) | Panel major heading or task title |
| `text-h4` | `--text-h4` | 20px (1.25rem) | 28px (1.75rem) | Inspector section heading |
| `text-body-lg` | `--text-body-lg` | 18px (1.125rem) | 30px (1.875rem) | Optional long-form editor body |
| `text-body` | `--text-body` | 16px (1rem) | 26px (1.625rem) | Main prose and document content (default) |
| `text-body-sm` | `--text-body-sm` | 14px (0.875rem) | 22px (1.375rem) | Panels, tables, inspector body |
| `text-label` | `--text-label` | 13px (0.8125rem) | 18px (1.125rem) | Controls, tabs, field labels |
| `text-caption` | `--text-caption` | 12px (0.75rem) | 16px (1rem) | Metadata, helper text, status |
| `text-mono` | `--text-mono` | 13px (0.8125rem) | 20px (1.25rem) | Formulas, identifiers, technical data |

The document `<body>` defaults to `text-body` size/line-height in IBM Plex Sans.

## Hierarchy laws

- Name the current object, especially at the top of the inspector.
- Prefer labels before icons for common or consequential actions.
- Use sentence case for controls, tabs, menu items, and headings.
- Keep long prose near 60–85 characters per line.
- Metadata affecting trust, provenance, or recovery must remain readable.
- Use weight with another cue; weight alone does not communicate state.
- Use tabular figures (`tabular-nums`) for versions, timestamps, counts, and
  numeric grids.

Prompt blocks use UI typography (interactive live objects). Formula **input**
uses monospace; resolved **output** uses the typography appropriate to its
content.

## Copy voice

Concrete nouns for destinations (Resources, References, History, Personas); verbs
for actions (Create, Open, Insert, Resolve, Review, Accept, Revert); explicit
states (Resolving, Stale, Applied, Failed, Needs review). The AI Agent Surface
sounds operational ("Describe a change to make…"), not "How can I help?".
