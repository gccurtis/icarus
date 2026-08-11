<script lang="ts">
  import AddCommentControl from '../controls/AddCommentControl.svelte';
  import Facts from '../controls/Facts.svelte';
  import TextTypeAndSpacing from '../controls/TextTypeAndSpacing.svelte';
  import TypographyControls from '../controls/TypographyControls.svelte';
  import { selectionKey, type RunSelection } from '../lens-helpers';

  // "Selected Text": a text range, possibly spanning blocks. Owns inline typography;
  // its rows come from the runtime (a run has no InspectedBlocks to derive them from).
  let { selection }: { selection: RunSelection } = $props();
</script>

<div class="space-y-3">
  <div class="min-w-0">
    <p class="text-caption font-medium text-secondary">Selected Text</p>
    <!-- Fixed three-line well so the panel does not jump as the selection changes. -->
    <div class="mt-1.5 rounded-control border border-border bg-work px-2 py-1.5">
      <p class="line-clamp-3 min-h-[3lh] whitespace-pre-wrap text-body-sm text-primary">
        {selection.text}
      </p>
    </div>
  </div>
  <TypographyControls typography={selection} selectionKey={selectionKey(selection)} />
  {#if selection.subKind !== undefined}
    <TextTypeAndSpacing
      subKind={selection.subKind ?? 'body'}
      rowKeys={selection.rowIds}
      blockIds={selection.blockIds}
    />
  {/if}
  <AddCommentControl />
  <Facts
    divided
    items={[
      { label: 'Characters', value: String(selection.chars) },
      { label: 'Words', value: String(selection.words) },
      { label: 'Lines', value: String(selection.blockIds.length) }
    ]}
  />
</div>
