# Change record — 2026-07-22 — Persisted project purpose in the Overview

Omega already stores a Project purpose and authorizes owners and editors to update it.
This small Alpha slice replaces the Overview card's deliberately unsaved local state
with that existing API contract.

## Map purpose through the Project data boundary

```ts
export type Project = {
  // …
  purpose: string;
};

export async function updateProject(
  id: string,
  changes: { name?: string; icon?: IconColor; visibility?: Visibility; purpose?: string }
): Promise<void> {
  const p = await api<ApiProject>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
  // …merge p.purpose back into the shared projects store
}
```

**Why:** Alpha previously discarded the field Omega already returned. **Purpose:** keep
the UI's Project row aligned with its persisted counterpart and reuse the existing profile
PATCH boundary. **Why this way:** `updateProject` already correctly handles server errors
and store replacement for the neighboring profile fields, so purpose belongs to the same
single operation rather than a new, parallel client.

## Save purpose explicitly from the Overview card

```svelte
const project = $derived($projects.find((p) => p.id === projectId) ?? null);
const canEdit = $derived(project?.role === 'owner' || project?.role === 'editor');

async function save() {
  const purpose = text.trim();
  if (!project || !canEdit || purpose === project.purpose) return;
  await updateProject(project.id, { purpose });
}
```

**Why:** the old card was an intentional edit-only mock, which made typed purpose vanish
on reload. **Purpose:** show the persisted purpose, make saving discoverable, and preserve
Omega's authorization model in the client experience. **Why this way:** the card reads
the shared store, uses an explicit Save control, reports the server result, and makes the
same content read-only for viewers instead of issuing a request the server must reject.

## Close the completed purpose request

```text
project-purpose: Open → Shipped
Overview discrepancy: purpose persisted; activity still mock
```

**Why:** Alpha's request and discrepancy docs still described the now-available backend
field as missing. **Purpose:** keep the integration ledger useful to Omega and make the
remaining Activity work visible without conflating it with this completed slice.

## Verification

`pnpm check` and `pnpm build` were run in the isolated purpose worktree before commit.
