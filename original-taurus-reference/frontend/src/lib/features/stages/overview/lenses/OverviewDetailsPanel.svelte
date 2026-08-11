<script lang="ts">
  import { overviewSelection } from '../overview-session';
  import ResourceLens from './ResourceLens.svelte';
  import ResourcesLens from './ResourcesLens.svelte';
  import ActivityLens from './ActivityLens.svelte';

  // Overview's Details lens. Like the document editor's DetailsPanel this file
  // only dispatches — each lens owns its own data loading, state, and copy.
  const selection = $derived($overviewSelection);
</script>

{#if selection.mode === 'resource'}
  <ResourceLens resourceId={selection.resourceId} />
{:else if selection.mode === 'resources'}
  <ResourcesLens resourceIds={selection.resourceIds} />
{:else if selection.mode === 'activity'}
  <ActivityLens event={selection.event} redacted={selection.redacted} />
{:else}
  <p class="text-body-sm text-muted">
    Nothing selected — click a resource row or an activity entry to inspect it.
  </p>
{/if}
