# panels.ts

The document's **surface contribution** — the panel sections a document brings to the shell
rails when its stage is active.

## One function, one list

```ts
export function documentSurface(docId: string, title: string): SurfaceContribution {
  return {
    id: `document:${docId}`,
    scope: `Document — ${title}`,
    context: [ /* Info, Search, Outline, Layout, Templates, References, Name Manager, Comments, AI Tasks, History */ ],
    inspector: [{ id: 'details', label: 'Details', icon: SlidersHorizontal, content: DetailsPanel }]
  };
}
```

`Templates` (added 2026-07-28) is the mocked template-library panel — the stage-owned wrapper
`panels/TemplatesPanel.svelte` pinning `scope="document"` onto the shared
`features/shared/templates/TemplatesPanel`.

`runtime.ts` used to import ten Svelte components and ten Lucide icons purely to name them in
`publishSurface` — a sync-and-network class holding direct references to UI. Catalog item
**A1** called that out; moving the list here reduces the runtime's side to one line
(`activeSurface.set(documentSurface(this.docId, this.title))`) and keeps the component graph
out of the model layer.

## No data flows through it

The shell renders contributed sections blind: each panel reads its own store (`editorSession`)
rather than receiving props. That is why this function needs only the document id and title —
the id makes the surface instance stable and the title is the AI dock's implicit-context label.

Section ids are stable serializable strings because workspace persistence stores the active
section; the components are carried in memory only. See `features/shared/surface.ts`, which
stays frozen through the reorg.
