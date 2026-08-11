<script lang="ts">
  import { Select } from '$lib/components';
  import { insertElementOptions } from '$data/documents';
  import type { BlockKind } from '$data/documents';
  import { editorSession } from '../../../editor/session';

  // Offered on an empty block only: picking a kind turns the current line into a
  // divider / code / callout / list / prompt block. The empty value keeps it text.
  function insertEl(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value) $editorSession?.actions.insertElement(value as BlockKind);
  }
</script>

<div class="space-y-1">
  <p class="text-caption text-secondary">Insert element</p>
  <Select
    value=""
    aria-label="Insert element"
    options={[{ value: '', label: 'Text — or insert…' }, ...insertElementOptions]}
    size="sm"
    onchange={insertEl}
  />
</div>
