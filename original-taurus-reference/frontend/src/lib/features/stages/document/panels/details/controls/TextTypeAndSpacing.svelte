<script lang="ts">
  import IndentControl from './IndentControl.svelte';
  import RowHeightControl from './RowHeightControl.svelte';
  import TextTypeSelect from './TextTypeSelect.svelte';

  // The grouped block/row section the three text lenses share: line spacing, style,
  // and indent under one divider. Each lens names its own row and block targets.
  let {
    subKind,
    rowKeys,
    blockIds
  }: { subKind: string; rowKeys: string[]; blockIds: string[] } = $props();
</script>

<div class="space-y-2 border-t border-border pt-3">
  <RowHeightControl {rowKeys} />
  <div class="flex items-center justify-between gap-3">
    <span class="text-caption text-secondary">Style</span>
    <TextTypeSelect value={subKind} />
  </div>
  <IndentControl {blockIds} />
</div>
