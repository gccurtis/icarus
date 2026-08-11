# 2026-07-26 — G1: real document templates

Un-mocks the New-tab **Templates** carousel against Omega's real template surface. The
carousel was a hardcoded array of six fake starters whose "create" just seeded a blank named
resource; it now lists the project's real templates and instantiates them.

Contract (verified against Omega source): `GET /documents/templates` → `{ templates: [Document] }`
where the descriptor is `base.template = { isTemplate, variables[] }` (field is `variables`, not
`contextVariables`); create-from-template is a **field on the normal create** —
`POST /documents { fromTemplateId }` — there is no dedicated route; both are always registered
(no `opts` guard).

## Types + list client

```ts
// systems/documents/types.ts
export type TemplateVariable = { name: string; description?: string };
export type DocumentTemplate = { id: string; name: string; variables: TemplateVariable[] };

// systems/documents/api.ts
export async function listTemplates(): Promise<DocumentTemplate[]> {
  const res = await api<{ templates: TemplateDoc[] }>('/documents/templates');
  return (res.templates ?? []).map(toTemplate);   // reads base.template.variables
}
```

A template list item is a full Document; the picker only needs `id`, `name`, and the template's
context `variables`, so `toTemplate` projects those and drops the rest.

## Create-from-template (a document create, mapped to a Resource)

```ts
// systems/resources/api.ts
export async function createResourceFromTemplate(templateId: string): Promise<Resource> {
  const doc = await api<{ id; name; updatedAt?; creatorId? }>('/documents',
    { method: 'POST', body: JSON.stringify({ fromTemplateId: templateId }) });
  const created: Resource = { id: doc.id, name: doc.name || 'Untitled', kind: 'document',
    updatedAt: doc.updatedAt ? Date.parse(doc.updatedAt) : Date.now(),
    pinned: false, access: projectWideAccess(), creatorId: doc.creatorId || undefined };
  resources.update((list) => [created, ...list.filter((x) => x.id !== created.id)]);
  return created;
}
```

Because instantiation is a document create (not a `/resources` create), it returns a document;
the resources client maps it to a `Resource` and prepends it to the catalog store, mirroring
`addResource`, so the new document appears in the table and the tab can resolve into it.

## New-tab wiring

```svelte
<!-- NewTabStage.svelte -->
let templates = $state<DocumentTemplate[]>([]);     // loaded per project via listTemplates()
const templateCards = $derived(templates.map((t) => ({ id: t.id, name: t.name,
  kind: 'document', blurb: t.variables.length ? `${t.variables.length} field(s) to fill` : 'Document template' })));
{#if templateCards.length}
  <TemplatesCarousel templates={templateCards} {kindMeta} onpick={fromTemplate} />
{/if}
```

The hardcoded `TEMPLATES` array and its `MockBadge` are gone. Real templates load per project;
the section hides entirely when the project has none (rather than showing fake starters).
`fromTemplate` now calls `createResourceFromTemplate` and resolves the blank tab into the new
document.

## Deferred (tracked): "save as template"

Marking a document as a template is a `set_template` changeset op
(`POST /documents/:id/changes`) plus a document-side affordance — heavier, and separate from
consuming templates. Left as a follow-up; this slice delivers list + instantiate.

## Verification

- `pnpm check` 0/0; `pnpm test` **274** (+3: listTemplates mapping + defaults; createResourceFromTemplate).
- Contract matched to Omega source before wiring (`variables` field; `fromTemplateId` create).
- All 4 touched companions updated to multi-section + byte-verified.
- Live UI E2E pending (no headless Chrome): on `:8443`, open a New tab → pick a template → it
  creates the document and opens it; with no templates, the carousel is hidden.
