# Typography — component

> **Concrete tokens.** Exact values, identical in every theme. The stylesheet
> declares these once; nothing may hard-code them at a call site.

The stance these serve is [theory](theory.md).

## Fonts

| Family | Token | Weights | Use |
| --- | --- | --- | --- |
| **IBM Plex Sans** | `--font-sans` | 400, 500, 600 | Chrome, panels, controls, tables, dialogs, prose. The default body face. |
| **IBM Plex Mono** | `--font-mono` | 400, 500 | Formulas, identifiers, hashes, trace data, logs, timestamps. |

| Token | Value |
| --- | --- |
| `--font-sans` | `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, "Cascadia Code", monospace` |

Both are self-hosted from the application bundle; only the weights listed above
are loaded.

## Scale

Each step is a **size and line-height pair**. Both halves are tokens.

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
