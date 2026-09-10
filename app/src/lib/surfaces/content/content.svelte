<script lang="ts">
  import { workspaceState } from "$model/client/workspace-state";
  import { loadCentre } from "$surfaces/content/effects/loads-centre.svelte";
  import { centreFailureFor } from "$surfaces/content/procedures/centre-failure-for";
  import {
    ContentState,
    type CentreLoader
  } from "$surfaces/content/shared/content-state.svelte";

  /**
   * The work surface — the generous plane, and what the active tab holds.
   *
   * It fills from view state rather than from the route. That is the whole
   * reason tabs can exist: switching tabs is not a navigation, so nothing about
   * what is open is expressible as a URL segment, and a work surface that took
   * route content could not follow a tab.
   *
   * **The registry is the filesystem.** There is no map from category to
   * component here, because a map is a second list of what exists and the first
   * one is the tree. A content view's key is its path — `research.thread` is the
   * `thread.svelte` in the research category's `content/` — and the same fact
   * generates the vocabulary the model publishes, so the two cannot disagree.
   *
   * **A chunk that fails to arrive is a state, not a blank plane.** The glob
   * cannot name a file that is not there, so a rejected import means the module
   * itself threw — and the difference between "still loading" and "this category
   * is broken" is the whole diagnosis.
   */
  const CENTRES = import.meta.glob("$lib/app-views/categories/*/content/*.svelte") as Record<
    string,
    CentreLoader
  >;

  const view = workspaceState();
  const state = new ContentState();

  const path = $derived(
    `/src/lib/app-views/categories/${view.active.content.replace(".", "/content/")}.svelte`
  );

  const load = $derived(CENTRES[path]);

  // A tab switch rekeys the centre before its new chunk arrives. A component is
  // visible only beside the path that produced it.
  const CurrentCentre = $derived(state.loadedPath === path ? state.centre : undefined);
  const CurrentMissing = $derived(state.missing === path ? state.missing : undefined);
  const CurrentFailure = $derived(centreFailureFor(state.failure, path));

  loadCentre({
    state,
    path: () => path,
    loader: () => load
  });
</script>

<!--
  Keyed on the tab rather than the category, so switching between two tabs of the
  same kind remounts instead of reusing one component's state for both. Two open
  documents are not one document.
-->
{#if CurrentMissing}
  <p class="text-body-sm text-danger-text p-4 font-mono">{CurrentMissing}</p>
{:else if CurrentFailure}
  <p class="text-body-sm text-danger-text p-4 font-mono">{path}<br />{CurrentFailure.reason}</p>
{:else if CurrentCentre}
  {#key view.activeId + view.active.content}
    <CurrentCentre />
  {/key}
{/if}
