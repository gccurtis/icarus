<script lang="ts">
  import { Select } from '$lib/components';
  import { textTypeOptions } from '$data/documents';
  import { editorSession } from '../../../editor/session';

  // The Body / Heading 1-6 picker. `setTextType` is whole-line: it converts every
  // text block the current selection touches, so no target prop is needed.
  let {
    value,
    ariaLabel = 'Style',
    class: className = 'w-32'
  }: { value: string; ariaLabel?: string; class?: string } = $props();
</script>

<Select
  {value}
  aria-label={ariaLabel}
  options={textTypeOptions}
  size="sm"
  class={className}
  onchange={(event: Event) =>
    $editorSession?.actions.setTextType((event.currentTarget as HTMLSelectElement).value)}
/>
