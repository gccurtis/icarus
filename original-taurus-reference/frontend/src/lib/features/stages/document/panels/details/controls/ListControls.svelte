<script lang="ts">
  import { NumberField, Select } from '$lib/components';
  import { editorSession, type InspectedBlock } from '../../../editor/session';

  // Marker type and ordered-start for a list block. Nesting and item creation are
  // keyboard affordances in the editor, not controls — the hint below says so.
  let { block }: { block: InspectedBlock } = $props();
</script>

<div class="space-y-2 border-t border-border pt-3">
  <p class="text-caption text-secondary">List</p>
  <Select
    value={block.listType ?? 'bullet'}
    aria-label="List type"
    options={[
      { value: 'bullet', label: 'Bulleted' },
      { value: 'ordered', label: 'Numbered' },
      { value: 'check', label: 'Checklist' }
    ]}
    size="sm"
    onchange={(event: Event) =>
      $editorSession?.actions.setListType(
        (event.currentTarget as HTMLSelectElement).value,
        block.listStart
      )}
  />
  {#if block.listType === 'ordered'}
    <div class="flex items-center justify-between gap-3">
      <span class="text-caption text-secondary">Start at</span>
      <NumberField
        value={block.listStart ?? 1}
        ariaLabel="List start"
        min={1}
        max={999}
        step={1}
        class="w-16"
        onchange={(value: number) => $editorSession?.actions.setListType('ordered', value)}
      />
    </div>
  {/if}
  <p class="text-caption text-muted">
    Enter adds an item · Tab nests · click a checkbox to toggle it.
  </p>
</div>
