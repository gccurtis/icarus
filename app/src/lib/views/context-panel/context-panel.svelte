<script lang="ts">
  import type { Component } from "svelte";

  import { PanelPlaceholder } from "$authored-components/panel";
  import { ResizeHandle } from "$authored-components/resize-handle";
  import { railFor, workspaceState, type ContextId } from "$model/client/workspace-state";
  import { RAIL_ENTRIES } from "$views/context-panel/procedures/rail-entries";
  import { COLLAPSE_BELOW, MAX_WIDTH, MIN_WIDTH, RAIL_WIDTH } from "$views/context-panel/types";

  /**
   * The context panel — the map. It answers "where am I and what else is here?"
   *
   * A context is a way of looking at what surrounds the active resource: its
   * outline, what it relates to, who commented on it. Never a mode of working —
   * a rail entry answers "what else is here?", not "what am I doing?".
   *
   * **The rail is inside this panel rather than beside it in the frame's grid.**
   * It is the panel's own navigation and has no meaning without it, so the frame
   * sees one zone and this view owns how it divides. It is also what makes
   * collapsing work: the panel narrows to the rail rather than disappearing, so
   * there is always something left to click.
   *
   * **The registry is the filesystem.** A context id names a path —
   * `"project.variables"` is `context/project/variables.svelte` — so there is no
   * map from id to component here. What each entry is *called* and what it looks
   * like cannot be derived and lives in
   * [`rail-entries`](procedures/rail-entries.ts); which entries this screen
   * offers, and in what order, belongs to the model.
   *
   * **There is no subscreen switch here.** A screen with several centres is
   * moved between by choosing something — a persona, a template, a task — not by
   * a pair of buttons above the rail. A control that names the states of a
   * screen is a control that has to be kept in step with them, and it offers a
   * way to reach an editor without choosing what it edits.
   */
  const VIEWS = import.meta.glob("$lib/views/panels/context/**/*.svelte") as Record<
    string,
    () => Promise<{ default: Component }>
  >;

  const view = workspaceState();

  const rail = $derived(railFor(view.active.screen, view.active.subscreen));
  const active = $derived(view.context);
  const collapsed = $derived(view.frame.contextCollapsed);

  const load = $derived(
    active === undefined
      ? undefined
      : VIEWS[`/src/lib/views/panels/context/${active.replace(".", "/")}.svelte`]
  );

  let Content = $state<Component | undefined>(undefined);

  $effect(() => {
    const loader = load;
    Content = undefined;
    if (!loader) return;

    let current = true;
    void loader().then((module) => {
      if (current) Content = module.default;
    });
    return () => {
      current = false;
    };
  });

  /**
   * Selecting a context always opens the panel.
   *
   * That is the whole uncollapse affordance on this side, and it needs no arrow
   * of its own: the rail is visible while collapsed, and the thing a user wants
   * when they reach for an icon is to see what it holds. Choosing the context
   * that is already showing is left alone rather than treated as a toggle —
   * closing a panel by clicking into it is a surprise, and the edge already
   * closes it.
   */
  const select = (id: ContextId) => {
    view.selectContext(id);
    if (collapsed) view.resize({ contextCollapsed: false });
  };

  const visible = $derived(RAIL_WIDTH + view.frame.contextWidth);
</script>

<aside class="panel" aria-label="Context">
  <nav class="rail" aria-label="Context views">
    {#each rail as id (id)}
      {@const entry = RAIL_ENTRIES[id]}
      <button
        type="button"
        class="pin"
        class:on={id === active}
        aria-current={id === active ? "true" : undefined}
        title={entry.label}
        aria-label={entry.label}
        onclick={() => select(id)}
      >
        <entry.icon size={16} aria-hidden="true" />
      </button>
    {/each}
  </nav>

  {#if !collapsed}
    <div class="content">
      <div class="body">
        {#if Content}
          {#key active}
            <Content />
          {/key}
        {:else if active !== undefined}
          <!--
            A key the rail offers and the tree has no file for: a view that has
            been designed and not built. Blank was the state before, which is
            indistinguishable from a panel that failed to load.
          -->
          <PanelPlaceholder
            panel={active}
            screen={view.active.screen}
            subscreen={view.active.subscreen}
          />
        {/if}
      </div>
    </div>
  {/if}

  <ResizeHandle
    side="start"
    width={visible}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
    label="the context panel"
    onchange={({ width, collapsed: next }) =>
      view.resize({ contextWidth: width - RAIL_WIDTH, contextCollapsed: next })}
  />
</aside>

<style>
  .panel {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    background-color: var(--token-surface-panel);
    border-right: 1px solid var(--token-border-subtle);
  }

  .rail {
    display: flex;
    width: calc(var(--token-spacing-unit) * 11);
    flex-shrink: 0;
    flex-direction: column;
    align-items: center;
    gap: var(--token-spacing-unit);
    overflow-y: auto;
    padding-block: calc(var(--token-spacing-unit) * 2);
    border-right: 1px solid var(--token-border-subtle);
    scrollbar-width: none;
  }

  .pin {
    display: flex;
    height: calc(var(--token-spacing-unit) * 7);
    width: calc(var(--token-spacing-unit) * 7);
    align-items: center;
    justify-content: center;
    border-radius: var(--token-radius-control);
    color: var(--token-ink-muted);
  }

  .pin:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .pin.on {
    background-color: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .content {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .body {
    min-height: 0;
    flex: 1;
  }

</style>
