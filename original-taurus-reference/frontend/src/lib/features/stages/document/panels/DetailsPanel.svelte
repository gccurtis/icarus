<script lang="ts">
  import { editorSession } from '../editor/session';
  import BlockLens from './details/lenses/BlockLens.svelte';
  import NewBlockLens from './details/lenses/NewBlockLens.svelte';
  import NewTextLens from './details/lenses/NewTextLens.svelte';
  import NoneLens from './details/lenses/NoneLens.svelte';
  import RunLens from './details/lenses/RunLens.svelte';
  import CanonicalLayoutNotice from './shared/CanonicalLayoutNotice.svelte';

  // Details is an action lens for the inspected target. This file only dispatches:
  // each lens under details/lenses/ owns its own controls, state, and targets.
</script>

{#if !$editorSession}
  <p class="text-body-sm text-muted">
    Nothing to inspect yet — open a document and select content here.
  </p>
{:else}
  {@const selection = $editorSession.selection}
  <CanonicalLayoutNotice
    enabled={selection.mode !== 'none'}
    class="mb-3"
    message="Alignment, indent, and line-spacing changes preview locally but are not saved for this document."
  />
  {#if selection.mode === 'none'}
    <NoneLens />
  {:else if selection.mode === 'run'}
    <RunLens {selection} />
  {:else if selection.mode === 'new-text'}
    <NewTextLens {selection} />
  {:else if selection.mode === 'new-block'}
    <NewBlockLens {selection} />
  {:else if selection.mode === 'block'}
    <BlockLens {selection} />
  {:else}
    <!-- `row` / `blocks` stay in the frozen SelectionInfo vocabulary, but nothing
         produces them since the gutter's removal — editing must FEEL like a text
         editor, with no block-manipulation chrome (UX1; the block model itself
         stays), so those lenses are gone. Fall back to NoneLens. -->
    <NoneLens />
  {/if}
{/if}
