<script lang="ts">
  import { Badge } from '$lib/components';
  import AddColumnControls from '../controls/AddColumnControls.svelte';
  import AlignmentControls from '../controls/AlignmentControls.svelte';
  import Facts from '../controls/Facts.svelte';
  import IndentControl from '../controls/IndentControl.svelte';
  import ListControls from '../controls/ListControls.svelte';
  import PromptControls from '../controls/PromptControls.svelte';
  import RowHeightControl from '../controls/RowHeightControl.svelte';
  import TextTypeSelect from '../controls/TextTypeSelect.svelte';
  import {
    blockIdsOf,
    blockKindName,
    rowKeysOf,
    wordCount,
    type BlockSelection
  } from '../lens-helpers';

  // One whole block. Layout, not inline typography — a block selection has no text
  // range to mark up. Kind-specific sections appear for prompt and list blocks.
  let { selection }: { selection: BlockSelection } = $props();

  const blocks = $derived([selection.block]);
  const rowKeys = $derived(rowKeysOf(blocks));
  const blockIds = $derived(blockIdsOf(blocks));
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between gap-3">
    <p class="text-label uppercase tracking-wide text-muted">Block</p>
    {#if selection.block.kind === 'text'}
      <TextTypeSelect value={selection.block.subKind ?? 'body'} ariaLabel="Text type" />
    {:else}
      <Badge tone="neutral">{blockKindName(selection.block)}</Badge>
    {/if}
  </div>
  {#if selection.block.kind === 'prompt' && selection.block.blockId}
    <PromptControls blockId={selection.block.blockId} />
  {/if}
  {#if selection.block.kind === 'list'}
    <ListControls block={selection.block} />
  {/if}
  <AlignmentControls {blockIds} />
  <RowHeightControl {rowKeys} divided />
  <IndentControl {blockIds} divided />
  <AddColumnControls blockId={selection.block.blockId} />
  <Facts
    items={[
      { label: 'Words', value: String(wordCount(selection.block.text)) },
      { label: 'Characters', value: String(selection.block.text.length) }
    ]}
  />
</div>
