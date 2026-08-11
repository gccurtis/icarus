# Backend request — project purpose statement

**Priority:** Medium · **Status:** **Shipped**
**Unblocks:** the persisted **purpose statement** under the project name on the Overview
stage. See [discrepancies/overview.md](../discrepancies/overview.md).

## What the front-end needs

A short, editable, project-scoped **purpose** (a sentence or few) describing what the
project is for. It shows and is edited on the Overview stage, survives reload, and is
shared by project members.

Two capabilities:

1. **Store it** — a `purpose` (a.k.a. `description`) field on the project that any
   member can read and editors/owners can write.
2. **Draft it when empty** *(optional, later)* — if no one writes a purpose, offer an
   AI-drafted one from the project's name + contents.

## Shipped API

```http
GET   /projects            -> { "projects": [ { "id", "name", "role", "purpose" } ] }
PATCH /projects/:id        { "purpose": "…" }   # editor/owner; "" clears it
  -> 200 { "id", "name", "role", "purpose" }

```

Omega returns the persisted string on every Project row. Owners may update every profile
field; editors may update purpose only; readers may not update it. Purpose is trimmed,
limited to 1,000 Unicode runes, and an empty string clears it. The optional AI-draft
idea remains part of [ai-generation.md](ai-generation.md), not this completed request.

## Front-end follow-up — done

- [`PurposeStatement.svelte`](../../src/lib/features/stages/overview/PurposeStatement.svelte)
  reads `purpose` through the Project model and saves with `PATCH`; the old unsaved note
  is gone and viewers are read-only.
- If AI generation later supports it, add a separate "Draft with AI" affordance.
