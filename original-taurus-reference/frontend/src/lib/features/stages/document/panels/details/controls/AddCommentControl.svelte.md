# AddCommentControl.svelte

The **Add comment** button that closes out each text lens.

## A hand-off, not an editor action

```svelte
<Button size="sm" variant="ghost" class="px-2"
  onclick={() => setPanel('context', { section: 'comments' })}>
```

This is the one control in the inspector that does not call an `editorSession` action. Comments
are composed in the Comments panel on the **context** rail, so the button's whole job is to open
that rail at that section — it takes no props and needs no target, because the comments panel
reads the live selection itself.

That independence is why it sits in `controls/` despite being a single button: three lenses
render it, and the panel-routing detail should be stated once.

## Position is deliberate

It is always the **last** control in a lens, after formatting and before the read-only facts.
The lenses order it that way rather than this component enforcing it — a control cannot know
what follows it — but the top divider it carries assumes something precedes it, which is true
in all three lenses that use it.
