# TemplatesPanel.svelte (slides wrapper)

Five lines: renders the shared
[`features/shared/templates/TemplatesPanel`](../../shared/templates/TemplatesPanel.svelte.md)
with `scope="slides"`, which turns on the **This slide / Whole deck** choice in the
Make-a-template section. Exists because rail sections mount their component with **no props**;
the document stage has the matching wrapper.
