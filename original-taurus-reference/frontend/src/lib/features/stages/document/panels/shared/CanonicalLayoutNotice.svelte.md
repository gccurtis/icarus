# CanonicalLayoutNotice.svelte

The amber "this won't be saved" banner shown when the open document has no canonical layout.
Shared by the Details inspector and the Layout panel, which both offer controls that fall into
this category.

## The condition lives here, the wording does not

```svelte
let { message, enabled = true, class: className = '' }:
  { message: string; enabled?: boolean; class?: string } = $props();

const unsupported = $derived(!!$editorSession && !$editorSession.supportsCanonicalLayout);
```

Both panels previously carried their own copy of the same `{#if}` and the same styling, with
different text. What is worth deduping is the *rule* — when to warn, and what a warning looks
like — not the sentence, because each panel should name the controls it actually offers: the
inspector says "alignment, indent, and line-spacing", the Layout panel says "page and block
layout". Sharing one generic sentence would have made both panels vaguer.

Reading `supportsCanonicalLayout` from the store rather than taking it as a prop keeps callers
from having to know the flag exists; they only decide *whether this spot warrants a notice*.

## `enabled` for extra caller conditions

```svelte
{#if unsupported && enabled}
```

The inspector suppresses the notice when nothing is selected — with no target there is no
pending layout change to warn about, and a standing banner over an empty panel is noise. That
is a caller's judgement, so it is a prop rather than another condition baked in here.

`class` exists for the same reason: the inspector needs bottom margin above the lens, the
Layout panel sits in a `space-y` stack and needs none.
