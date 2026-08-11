# `/library/templates` — the template library route

Two lines, the sibling of [`/library/context`](../context/+page.svelte.md). Both render the same
component; only the space differs.

```svelte
<LibraryConsole space="templates" />
```

## What the Templates space adds

The console is identical for both spaces except the center of the work surface, which for a
template is a **preview** over the **context slots it needs**
([`TemplateSpace`](../../../lib/features/library/TemplateSpace.svelte.md)). Templates also get a
`Bring into project` action under the header's `⋯`; contexts do not, because a context is reached
for from inside the project that needs it rather than pushed from here.

## What is real here

The screen is real; **the data is mocked and badged**. Omega does have document templates
(`base.template.isTemplate` plus `ContextVariable`s, listed by `GET /documents/templates` and
instantiated by `POST /documents {fromTemplateId}` — both already called by
[`NewTabStage`](../../../lib/features/stages/new-tab/NewTabStage.svelte.md)), but they are
project-scoped, so the owner-scoped library this screen presents does not exist yet. Wiring the
real template list here is the first slice worth doing, since the client calls already exist.
