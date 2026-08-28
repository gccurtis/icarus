<script lang="ts">
  import Library from "@lucide/svelte/icons/library";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelButton,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { contextsFor } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * What the prompt blocks in this deck can look up.
   *
   * `docs/screen-panel-views/context/resource/context-deck.md` is the
   * specification — the same view as the document editor's, for the same reason:
   * a generated block runs against a scope, and the scope is worth seeing without
   * leaving the deck.
   *
   * **The chips answer the view's open question rather than settling it.** Whether
   * this lists the scopes in use here or every scope so one can be assigned is
   * undecided, so both readings are one press apart and the count says which one
   * is showing.
   */
  let { resourceId = "r-board", onopen }: { resourceId?: string; onopen?: () => void } = $props();

  const view = viewState();

  const all = $derived(contextsFor(resourceId).current);

  let show = $state<"used" | "all">("used");

  const SHOW = [
    { value: "used", label: "Used here" },
    { value: "all", label: "All" }
  ] as const;

  const shown = $derived(all.filter((scope) => show === "all" || scope.usedByBlocks > 0));
  const count = $derived(
    shown.length === all.length ? all.length : `${shown.length} of ${all.length}`
  );
</script>

<Panel title="Context">
  <!--
    The way out to the screen that owns these. The specification puts it at the
    foot; `Panel` has no footer, and a control below a list of unbounded length is
    a control nobody finds.
  -->
  {#snippet actions()}
    <PanelButton label="Open Context screen" icon={SquareArrowOutUpRight} onclick={onopen} />
  {/snippet}

  <PanelSection title="Saved Contexts" {count} flush>
    <PanelChoice
      label="Show"
      value={show}
      options={SHOW}
      onchange={(next: string) => (show = next as typeof show)}
    />

    {#each shown as scope (scope.id)}
      <PanelRow
        title={scope.name}
        sub={scope.usedByBlocks === 0
          ? "No block in this deck uses it"
          : `${scope.usedByBlocks} prompt blocks`}
        meta="{scope.resolves} resolved"
        icon={Library}
        onselect={() => view.inspect("scope.context", { kind: "scope", id: scope.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    The resolved count is what a block would get if it ran now, not what it got the
    last time it ran.
  </PanelNote>
</Panel>
