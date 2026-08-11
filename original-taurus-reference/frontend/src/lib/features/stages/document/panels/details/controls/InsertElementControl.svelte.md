# InsertElementControl.svelte

The **Insert element** picker — how an empty line becomes a divider, code block, callout, list,
or AI prompt block.

## A select used as a menu

```svelte
<Select
  value=""
  aria-label="Insert element"
  options={[{ value: '', label: 'Text — or insert…' }, ...insertElementOptions]}
  onchange={insertEl}
/>
```

The value is pinned to `''` rather than bound: this is an action menu, not a stateful field. It
resets to the placeholder after every use, so the label always describes what the line *is*
(text) and what can be done to it, and picking the same element twice in a row still fires.

The blank first option is the "leave it as text" case, which is why `insertEl` ignores an empty
value instead of treating it as a kind.

## Only on the New Block lens

`insertElement` replaces the current line when it is empty and inserts after it otherwise, so
offering it anywhere else would be ambiguous — on a line with text, "insert a divider" could
reasonably mean before, after, or instead of it. Restricting the control to the empty-block lens
means the action has exactly one meaning wherever it can be reached.
