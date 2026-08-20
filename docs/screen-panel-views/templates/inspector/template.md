# A template

| Selecting | What it is | Sections |
| --- | --- | --- |
| A template in the library | The template: what it makes, what it looks like, what it asks for | This template · Preview · It will ask for · Actions · Attribution |

## Layout

| 300px |
| --- |
| this template |
| preview |
| preview |
| it will ask for |
| it will ask for |
| actions |
| attribution |

## This template

Name, editable, and what it makes.

**Shows** — `Name · Regulatory filing shell`, `Makes a · Document — fixed at
creation`, `Available in · This project | Everywhere`

**Needs** — the `Template` record.

## Preview

Rendered from the real body. The model has no thumbnail, tag, category, favourite
or usage count, and the library does not pretend those exist — so the preview is
the only visual identity a template has.

**Shows** — a page thumbnail with variable regions distinguished from ordinary
content.

**Needs** — a small renderer for the body.

**Open** — distinguishing the variable regions requires knowing where they are,
which is the gap that gates the screen.

## It will ask for

Its variables, with type and requiredness.

**Shows**

- `filingDocket` — Text · required
- `filingParty` — Text · required
- `outageTable` — Table · required
- `execSummary` — Generated · optional

**Needs** — the variable list.

## Actions

**Edit** enters the authoring subscreen. **Use** is disabled. **Duplicate** copies
it.

**Open** — Use is disabled while variables cannot be placed in the body.

## Attribution

Starts collapsed.

**Shows** — `Created by · Mira Jain`, `Revision · 6`

**Needs** — creator actor and revision.
