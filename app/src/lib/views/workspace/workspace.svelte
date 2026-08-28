<script lang="ts">
  import type { Component } from "svelte";

  import { viewState } from "$model/client/view-state";

  /**
   * The work surface — the generous plane, and what the active tab holds.
   *
   * It fills from view state rather than from the route. That is the whole
   * reason tabs can exist: switching tabs is not a navigation, so nothing about
   * what is open is expressible as a URL segment, and a work surface that took
   * route content could not follow a tab.
   *
   * **The registry is the filesystem.** There is no map from screen to component
   * here, because a map is a second list of what exists and the first one is
   * `src/lib/views/workspaces/`. A screen and a subscreen name a path — `research` and
   * `one-question` are `workspaces/research/workspace-one-question.svelte` — and
   * the same fact generates the vocabulary the model publishes, so the two
   * cannot disagree.
   *
   * **A chunk that fails to arrive is a state, not a blank plane.** The glob
   * cannot name a file that is not there, so a rejected import means the module
   * itself threw — and the difference between "still loading" and "this screen
   * is broken" is the whole diagnosis.
   */
  const CENTRES = import.meta.glob("$lib/views/workspaces/**/*.svelte") as Record<
    string,
    () => Promise<{ default: Component }>
  >;

  const view = viewState();

  /** A screen with one centre calls it `workspace`; the rest qualify it. */
  const path = $derived(
    `/src/lib/views/workspaces/${view.active.screen}/${
      view.active.subscreen === "workspace" ? "workspace" : `workspace-${view.active.subscreen}`
    }.svelte`
  );

  const load = $derived(CENTRES[path]);

  let Centre = $state<Component | undefined>(undefined);
  let missing = $state<string | undefined>(undefined);
  let broke = $state<string | undefined>(undefined);

  $effect(() => {
    const loader = load;
    Centre = undefined;
    broke = undefined;
    missing = loader === undefined ? path : undefined;
    if (!loader) return;

    let current = true;
    void loader().then(
      (module) => {
        if (current) Centre = module.default;
      },
      (reason: unknown) => {
        if (current) broke = String(reason);
      }
    );
    return () => {
      current = false;
    };
  });
</script>

<!--
  Keyed on the tab rather than the screen, so switching between two tabs of the
  same kind remounts instead of reusing one component's state for both. Two open
  documents are not one document.
-->
{#if missing}
  <p class="text-body-sm text-danger-text p-4 font-mono">{missing}</p>
{:else if broke}
  <p class="text-body-sm text-danger-text p-4 font-mono">{path}<br />{broke}</p>
{:else if Centre}
  {#key view.activeId + view.active.subscreen}
    <Centre />
  {/key}
{/if}
