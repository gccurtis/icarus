<script lang="ts">
  import type { Component } from "svelte";
  import PanelRight from "@lucide/svelte/icons/panel-right";

  import { PanelPlaceholder } from "$authored-components/panel";
  import { ResizeHandle } from "$authored-components/resize-handle";
  import { workspaceState } from "$model/client/workspace-state";
  import {
    COLLAPSE_BELOW,
    COLLAPSED_WIDTH,
    MAX_WIDTH,
    MIN_WIDTH
  } from "$surfaces/inspector/types";

  /**
   * The inspector — the lens. It answers "what is this, and what can I do to it?"
   *
   * **It is driven by an inspection key and nothing else.** The key is a
   * namespaced label naming a file — `"collaboration.person"` is
   * `inspector/collaboration/person.svelte` — so there is no map here either.
   * What the lens is *about* is the selection, which the model carries beside the
   * key rather than inside it.
   *
   * **A lens is re-created when its subject changes, not only when its key
   * does.** A lens reads the selection itself, so two things of one kind are the
   * same component with different data — and whatever the lens is holding for
   * the reader, a half-written reply or a Withdraw that has not been sent, would
   * carry across and be shown as belonging to the second one. A draft belongs to
   * the thing it was written about.
   *
   * **Never derived from focus.** Clicking into this panel blurs whatever was
   * focused in the centre, and a focus-derived inspection would empty the panel
   * the user is reaching for.
   *
   * Nothing selected is a state rather than an absence, which is why it has a
   * sentence of its own rather than rendering blank.
   */
  const LENSES = import.meta.glob([
    "$lib/app-views/categories/*/inspector/*.svelte",
    "$lib/app-views/general/*/*.svelte"
  ]) as Record<string, () => Promise<{ default: Component }>>;

  const view = workspaceState();

  /** A general lens is a directory of its own; a category's sits in its inspector stack. */
  const pathOf = (key: string): string => {
    const [category, name] = key.split(".");
    return category === "general"
      ? `/src/lib/app-views/general/${name}/${name}.svelte`
      : `/src/lib/app-views/categories/${category}/inspector/${name}.svelte`;
  };

  const inspected = $derived(view.inspected);
  const collapsed = $derived(view.frame.inspectorCollapsed);

  /** The lens and what it is about, which together are one panel's lifetime. */
  const subject = $derived(
    `${inspected}\u0000${view.selection?.id ?? ""}\u0000${view.selection?.at ?? ""}`
  );

  const blockOf = (address: string | undefined): string =>
    address?.split("/atoms/")[0] ?? "";

  /**
   * Text endpoints move several times during a drag or double-click. The
   * structural block span is the component lifetime; each lens still reads the
   * live offsets from workspace state. This avoids destroying controlled
   * descendants in the middle of a pointer gesture.
   */
  const structuralSubject = $derived.by(() => {
    // Retain the original subject as a dependency while deliberately reducing
    // its offsets to a stable structural identity.
    void subject;
    const selection = view.selection;
    if (selection === undefined) return `${view.activeId}:${inspected}`;
    if (
      selection.kind === "text-selection" ||
      selection.kind === "next-letter" ||
      selection.kind === "empty-line"
    ) {
      return `${view.activeId}:${inspected}:${blockOf(selection.id)}:${blockOf(selection.at)}`;
    }
    return `${view.activeId}:${inspected}:${selection.id}:${selection.at ?? ""}`;
  });

  const load = $derived(
    inspected === "empty"
      ? undefined
      : LENSES[pathOf(inspected)]
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
    {#key structuralSubject}
      <div class="body"><Lens /></div>
    {/key}
  {:else if inspected === "empty"}
    <p class="empty">
      <strong>Nothing selected</strong>
      Pick something in the centre, or a row on the left.
    </p>
  {:else if load === undefined}
    <!--
      A key the vocabulary names and the tree has no file for: a lens that has
      been designed and not built. The placeholder says which key arrived and
      what it was about, so the routing is provable before the lens exists.
    -->
    <PanelPlaceholder
      panel={inspected}
      kind={view.selection?.kind}
      id={view.selection?.id}
      at={view.selection?.at}
    />
  {/if}

  <ResizeHandle
    side="end"
    width={collapsed ? COLLAPSED_WIDTH : view.frame.inspectorWidth}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
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
    display: flex;
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 3);
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    color: var(--token-ink-muted);
  }

  .empty strong {
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    font-weight: 500;
    color: var(--token-ink-primary);
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
