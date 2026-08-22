<script lang="ts">
  import type { Component } from "svelte";
  import PanelRight from "@lucide/svelte/icons/panel-right";

  import { ResizeHandle } from "$lib/unique-components/resize-handle";
  import { viewState } from "$model/client/view-state";
  import { COLLAPSED_WIDTH, MAX_WIDTH, MIN_WIDTH } from "$views/inspector/types";

  /**
   * The inspector — the lens. It answers "what is this, and what can I do to it?"
   *
   * **It is driven by an inspection key and nothing else.** The key is a
   * namespaced label naming a file — `"collaboration.person"` is
   * `inspector/collaboration/person.svelte` — so there is no map here either.
   * What the lens is *about* is the selection, which the model carries beside the
   * key rather than inside it.
   *
   * **Never derived from focus.** Clicking into this panel blurs whatever was
   * focused in the centre, and a focus-derived inspection would empty the panel
   * the user is reaching for.
   *
   * Nothing selected is a state rather than an absence, which is why it has a
   * sentence of its own rather than rendering blank.
   */
  const LENSES = import.meta.glob("$lib/inspector/**/*.svelte") as Record<
    string,
    () => Promise<{ default: Component }>
  >;

  const view = viewState();

  const inspected = $derived(view.inspected);
  const collapsed = $derived(view.frame.inspectorCollapsed);

  const load = $derived(
    inspected === "empty"
      ? undefined
      : LENSES[`/src/lib/inspector/${inspected.replace(".", "/")}.svelte`]
  );

  let Lens = $state<Component | undefined>(undefined);

  $effect(() => {
    const loader = load;
    Lens = undefined;
    if (!loader) return;

    let current = true;
    void loader().then((module) => {
      if (current) Lens = module.default;
    });
    return () => {
      current = false;
    };
  });
</script>

<aside class="panel" aria-label="Inspector" data-inspected={inspected}>
  {#if collapsed}
    <button
      type="button"
      class="reopen"
      title="Show the inspector"
      aria-label="Show the inspector"
      onclick={() => view.resize({ inspectorCollapsed: false })}
    >
      <PanelRight size={16} aria-hidden="true" />
    </button>
  {:else if Lens}
    {#key inspected}
      <div class="body"><Lens /></div>
    {/key}
  {:else if inspected === "empty"}
    <p class="empty">
      Nothing selected. Pick something in the centre, or a row in the panel on the
      left.
    </p>
  {:else if load === undefined}
    <!--
      A key that resolves to no file. It cannot happen through the model — the
      key type is generated from this very tree — so it means the glob and the
      vocabulary disagree, and saying which key is the only useful thing to show.
    -->
    <p class="empty">No lens at <code>{inspected}</code>.</p>
  {/if}

  <ResizeHandle
    side="end"
    width={collapsed ? COLLAPSED_WIDTH : view.frame.inspectorWidth}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={MIN_WIDTH}
    label="the inspector"
    onchange={({ width, collapsed: next }) =>
      view.resize({ inspectorWidth: width, inspectorCollapsed: next })}
  />
</aside>

<style>
  .panel {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background-color: var(--token-surface-panel);
    border-left: 1px solid var(--token-border-subtle);
  }

  .body {
    min-height: 0;
    flex: 1;
  }

  .empty {
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 3);
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  .reopen {
    display: flex;
    justify-content: center;
    padding-block: calc(var(--token-spacing-unit) * 3);
    color: var(--token-ink-muted);
  }

  .reopen:hover {
    color: var(--token-ink-primary);
  }
</style>
