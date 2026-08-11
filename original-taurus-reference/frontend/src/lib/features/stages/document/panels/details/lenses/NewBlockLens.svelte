<script lang="ts">
  import AddCommentControl from '../controls/AddCommentControl.svelte';
  import InsertElementControl from '../controls/InsertElementControl.svelte';
  import TextTypeAndSpacing from '../controls/TextTypeAndSpacing.svelte';
  import TypographyControls from '../controls/TypographyControls.svelte';
  import { blockIdsOf, rowKeysOf, selectionKey, type NewBlockSelection } from '../lens-helpers';

  // "New Block": an empty text block. Same typography as Next Text, plus the one
  // place a line can be turned into a divider / code / callout / list / prompt.
  let { selection }: { selection: NewBlockSelection } = $props();

  const blocks = $derived([selection.block]);
</script>

<div class="space-y-3">
  <div>
    <p class="text-body-sm font-medium text-primary">New Block</p>
    <p class="mt-0.5 text-caption text-muted">Type to start, insert an element, or set its style.</p>
  </div>
  <InsertElementControl />
  <div class="border-t border-border pt-3">
    <TypographyControls typography={selection} selectionKey={selectionKey(selection)} />
  </div>
  <TextTypeAndSpacing
    subKind={selection.block.subKind ?? 'body'}
    rowKeys={rowKeysOf(blocks)}
    blockIds={blockIdsOf(blocks)}
  />
  <AddCommentControl />
</div>
