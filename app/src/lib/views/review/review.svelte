<script lang="ts">
  import type { Component } from "svelte";

  import { forgetDoors } from "$mock-capabilities/read.svelte";
  import { provideTrace } from "$lib/trace/trace.svelte";
  import GridMap from "$views/review/components/grid-map.svelte";
  import Picker from "$views/review/components/picker.svelte";
  import StatePanel from "$views/review/components/state-panel.svelte";
  import Tree from "$views/review/components/tree.svelte";
  import { Review, type ReviewKind } from "$views/review/shared/create-review.svelte";

  /**
   * One panel, what it is a function of, and what it is made of.
   *
   * Three pages use this — context, inspector, workspace — because the three
   * differ only in which tree they enumerate. Modals have no page of their own on
   * purpose: a modal is opened by an interaction inside one of the three, so
   * reaching it through that interaction is the only way of seeing it that is
   * true to how it is reached.
   *
   * **The state is above and the composition is beside, and only one of them is
   * writable.** Everything on the right is derived from what is at the top, so a
   * second place to change it would be a second answer to what the panel is a
   * function of. Change a door, watch the tree and the stage both move.
   *
   * **The stage is a real flank.** A context view and a lens render at 300px
   * against canvas, because that is the width they will have, and a shape that
   * reads at 800 and breaks at 300 is exactly what a review is for. A workspace
   * gets the whole plane.
   */
  let {
    kind,
    modules
  }: {
    kind: ReviewKind;
    /** The glob for this tree. Handed in, because the pattern must be a literal. */
    modules: Record<string, () => Promise<unknown>>;
  } = $props();

  // Reading the initial value is exactly right: a route hands in one kind and one
  // glob and never changes either, so a different tree is a different page.
  // svelte-ignore state_referenced_locally
  const review = new Review(kind, modules);
  provideTrace(review.run);

  /** The node the pointer is over on the right, lit up on the left. */
  let lit = $state<string | undefined>(undefined);

  /**
   * Every rendered panel gets the same bag. Svelte ignores a prop a component
   * does not destructure, so one bag covers all of them — and the alternative is
   * a map of per-component props that goes stale the moment a signature changes.
   *
   * Named `stageProps` rather than `props`: a local called `props` makes
   * `$props` read as a store subscription, which the compiler warns about and
   * the checker refuses outright.
   */
  const stageProps = { open: true, onback: () => {}, onclose: () => {} };

  const flank = $derived(kind !== "workspace");

  /**
   * The panel is held rather than awaited in the markup, because the door log can
   * only be read once the panel has actually rendered — and an `{#await}` block
   * resolves after every effect on this component has already run. Awaiting
   * inline showed every panel as reading no door at all.
   */
  let Stage = $state<Component | undefined>(undefined);
  let failure = $state<string | undefined>(undefined);

  $effect(() => {
    const entry = review.selected;
    Stage = undefined;
    failure = undefined;
    if (!entry) return;

    let current = true;
    entry
      .load()
      .then((module) => {
        if (!current) return;
        // The one window where the old panel is gone and the new one has not
        // rendered. Clearing in `select` instead leaves the outgoing panel a
        // frame in which to answer again, and its doors turn up beside the
        // incoming one's.
        forgetDoors();
        Stage = module.default;
      })
      .catch((error: unknown) => {
        if (current) failure = error instanceof Error ? error.message : String(error);
      });
    return () => {
      current = false;
    };
  });

  /**
   * The door log is written during the render that just happened, so it is read
   * back a tick later — and again whenever an override changes what was asked.
   *
   * **It must not depend on `review.doors`.** `refresh()` writes that, so reading
   * it here makes the effect its own trigger and the page spins until the tab
   * gives up. What genuinely changes what gets asked is the panel arriving and an
   * override landing, and those are the whole dependency list.
   */
  $effect(() => {
    void Stage;
    void review.revision;
    review.refresh();
  });

  $effect(() => {
    if (!lit) return;
    const element = document.querySelector<HTMLElement>(`[data-trace="${lit}"]`);
    if (!element) return;
    element.style.outline = "2px solid var(--token-color-active-border)";
    element.style.outlineOffset = "1px";
    return () => {
      element.style.outline = "";
      element.style.outlineOffset = "";
    };
  });
</script>

<svelte:head><title>{kind} — review</title></svelte:head>

<div class="review" class:narrow={flank}>
  <header class="head">
    <div class="flex flex-wrap items-center gap-4">
      <nav class="text-caption flex items-center gap-2">
        <a class:on={kind === "context"} href="/demo/context">context</a>
        <a class:on={kind === "inspector"} href="/demo/inspector">inspector</a>
        <a class:on={kind === "workspace"} href="/demo/workspace">workspace</a>
      </nav>
      <Picker
        grouped={review.grouped}
        value={review.selectedId}
        onselect={(id) => review.select(id)}
      />
      {#if review.selected}
        <span class="text-caption text-ink-muted font-mono">
          src/lib/{kind === "workspace" ? "workspaces" : kind}/{review.selected.id}.svelte
        </span>
      {/if}
    </div>

    <StatePanel doors={review.doors} onchange={() => (review.revision += 1)} />
  </header>

  <main class="stage" data-review-stage>
    {#if failure}
      <p class="text-body-sm text-danger-text p-4">{failure}</p>
    {:else if Stage}
      <!-- Keyed, so two panels of one shape remount rather than reuse a mount. -->
      {#key review.selectedId}
        <div class="mount" class:flank>
          <Stage {...stageProps} />
        </div>
      {/key}
    {:else}
      <p class="text-caption text-ink-muted p-4">Loading…</p>
    {/if}
  </main>

  <aside class="side">
    {#if kind === "workspace"}
      <GridMap
        root={review.run.root}
        revision={review.revision + review.doors.length}
        onhover={(id) => (lit = id)}
      />
    {:else}
      <Tree root={review.run.root} onhover={(id) => (lit = id)} />
    {/if}
  </aside>
</div>

<style>
  /**
   * The one number worth tuning, and it is two numbers because the two stages
   * are different sizes.
   *
   * A workspace takes the whole plane, so it gets seventy per cent and the
   * composition column gets what is left. A context view or a lens is 300px
   * whatever the window is, so a stage at seventy per cent would be a 300px panel
   * with eight hundred pixels of empty canvas beside it — the reading is
   * happening on the right, so the right gets the room.
   */
  .review {
    --review-split: 70%;

    display: grid;
    grid-template-columns: var(--review-split) 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "head head"
      "stage side";
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .review.narrow {
    --review-split: 60%;
  }

  .head {
    grid-area: head;
    display: flex;
    max-height: 45vh;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    overflow-y: auto;
    border-bottom: 1px solid var(--token-border-subtle);
    padding: calc(var(--token-spacing-unit) * 3);
  }

  .head nav a {
    color: var(--token-ink-muted);
  }

  .head nav a.on {
    color: var(--token-ink-primary);
    font-weight: 600;
  }

  .stage {
    grid-area: stage;
    min-width: 0;
    overflow: auto;
    background-color: var(--token-surface-work);
  }

  .side {
    grid-area: side;
    min-width: 0;
    overflow: auto;
    border-inline-start: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
    padding: calc(var(--token-spacing-unit) * 3);
  }

  .mount {
    min-height: 100%;
  }

  /* A flank is 300px and vertical. Anything else is a lie about the geometry. */
  .mount.flank {
    width: calc(var(--token-spacing-unit) * 75);
    border-inline-end: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }
</style>
