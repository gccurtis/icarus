# TemplatesPanel.svelte (document wrapper)

Five lines: renders the shared
[`features/shared/templates/TemplatesPanel`](../../../shared/templates/TemplatesPanel.svelte.md)
with `scope="document"`. Exists because rail sections mount their component with **no props**
(see `features/shared/surface.ts`), so each stage pins its scope with a wrapper it owns — the
same reason slides has its twin.
