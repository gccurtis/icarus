<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { savedContexts } from "$mock-capabilities/project";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Context — the project's saved scopes, and what each of them resolves to now.
   *
   * `docs/screen-panel-views/context/project/contexts.md` is the specification.
   * A Context is a live rule rather than a stored list, so the count beside the
   * name is the whole point of the row: it says whether the rule still means what
   * it meant when it was written. Editing one happens on the Context screen.
   *
   * **The way out is a control rather than a footer**, because a panel has none:
   * a control under a list of unbounded length is a control nobody reaches. It is
   * disabled until a parent hands it somewhere to go — routing is not a door a
   * panel has.
   */
  let { onopen }: { onopen?: () => void } = $props();

  const all = $derived(savedContexts().current);

  let search = $state("");

  const shown = $derived(
    all.filter((context) => context.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  /**
   * A Context that resolves to nothing broadens retrieval to the whole project
   * rather than restricting it to nothing, which is the opposite of what its
   * author asked for. It is drawn as a warning until an explicit-empty sentinel
   * exists to say which was meant.
   */
  const empty = $derived(shown.filter((context) => context.resolves === 0));
</script>

<Panel title="Context">
  {#snippet actions()}
    <PanelButton
      label="Open Context screen"
      icon={ArrowRight}
      disabled={onopen === undefined}
      title="Edit these scopes on the Context screen"
      onclick={onopen}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search Contexts"
    matched={shown.length}
    total={all.length}
    empty="No Context matches."
    bind:value={search}
    flush
  >
    <PanelSection title="Saved Contexts" count={shown.length} flush>
      {#each shown as context (context.id)}
        <PanelRow
          title={context.name}
          sub={context.rule}
          meta={context.resolves === 0 ? "Resolves to 0" : `${context.resolves} resources`}
          icon={context.resolves === 0 ? TriangleAlert : undefined}
          tone={context.resolves === 0 ? "attention" : "default"}
          onselect={() =>
            mockWorkbench.inspect("scope.context", { kind: "context", id: context.id })}
        />
      {/each}

      {#if empty.length > 0}
        <PanelNote tone="gap">
          {empty.length === 1 ? "One Context resolves" : `${empty.length} Contexts resolve`} to
          nothing. A rule with no members widens retrieval to the whole project, so these are
          blocked from dispatch.
        </PanelNote>
      {/if}
    </PanelSection>
  </PanelSearch>
</Panel>
