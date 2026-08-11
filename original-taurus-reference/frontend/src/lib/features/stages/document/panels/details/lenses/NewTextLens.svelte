<script lang="ts">
  import AddCommentControl from '../controls/AddCommentControl.svelte';
  import TextTypeAndSpacing from '../controls/TextTypeAndSpacing.svelte';
  import TypographyControls from '../controls/TypographyControls.svelte';
  import { blockIdsOf, rowKeysOf, selectionKey, type NewTextSelection } from '../lens-helpers';

  // "Next Text": a caret in a text or callout block. Formatting set here is stored
  // for the next typed character rather than applied to anything existing.
  let { selection }: { selection: NewTextSelection } = $props();

  const blocks = $derived([selection.block]);
</script>

<div class="space-y-3">
  <div>
    <p class="text-caption font-medium text-secondary">Next Text</p>
    <p class="mt-1 text-caption text-muted">Formatting applies to the text you type next.</p>
  </div>
  <TypographyControls typography={selection} selectionKey={selectionKey(selection)} />
  <TextTypeAndSpacing
    subKind={selection.block.subKind ?? 'body'}
    rowKeys={rowKeysOf(blocks)}
    blockIds={blockIdsOf(blocks)}
  />
  <AddCommentControl />
</div>
