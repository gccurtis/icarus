<script lang="ts">
  import { editorSession } from '../../../editor/session';
  import Facts from '../controls/Facts.svelte';
</script>

<!-- Nothing inspectable: describe the document and how to select something. -->
{#if $editorSession}
  <div class="space-y-3">
    <p class="truncate text-body-sm font-medium text-primary">{$editorSession.name}</p>
    <Facts
      items={[
        { label: 'Blocks', value: String($editorSession.blocks) },
        { label: 'Words', value: String($editorSession.words) }
      ]}
    />
    <p class="text-caption text-muted">Select text or place the caret to inspect content.</p>
  </div>
{/if}
