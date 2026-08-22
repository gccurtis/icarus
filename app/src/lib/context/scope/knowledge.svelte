<script lang="ts">
  import FileSearch from "@lucide/svelte/icons/file-search";
  import FileX from "@lucide/svelte/icons/file-x";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Waypoints from "@lucide/svelte/icons/waypoints";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import {
    generatedBlocksUsing,
    latticeNodesIn,
    retrievabilityOf,
    type GeneratedBlock,
    type LatticeNode
  } from "$mock-capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * What can actually be retrieved from this scope, and what has been written
   * against it.
   *
   * `docs/screen-panel-views/context/scope/knowledge.md` is the specification.
   * Containing a resource and being able to retrieve from it are different
   * things, and this view is about the second.
   *
   * **Two rows rather than one percentage.** A figure like "42% indexed" hides
   * which of the two numbers a reader is looking at; 88 and 123 are both counts
   * of resources, and both are things a person can act on.
   *
   * **The lattice starts shut and offers nothing.** Its nodes are
   * system-managed, so a control here would suggest they are part of what a
   * person configures. The rows open a read-only lens and the panel has no
   * action row at all.
   */
  let { contextId = "cx-drafts" }: { contextId?: string } = $props();

  const view = viewState();

  const retrieval = $derived(retrievabilityOf(contextId).current);
  const blocks = $derived(generatedBlocksUsing(contextId).current);
  const nodes = $derived(latticeNodesIn(contextId).current);

  const unowned = $derived(blocks.filter((block: GeneratedBlock) => !block.ownerResolved).length);

  /** The level as a word, so a node reads as a sentence rather than a field. */
  const LEVEL: Record<LatticeNode["level"], string> = {
    window: "Window",
    cluster: "Cluster",
    theme: "Theme"
  };
</script>

<Panel title="Knowledge">
  <!-- Neither row is a target: the split is a count of the scope, not a thing in it. -->
  <PanelSection title="What can be retrieved" flush>
    <PanelRow title="{retrieval.indexed} resources with indexed material" icon={FileSearch} />
    <PanelRow
      title="{retrieval.nothingIndexed} resources with nothing indexed yet"
      icon={FileX}
      tone="attention"
    />

    <PanelNote>
      {retrieval.contains} resources are in the scope. A search over this Context
      can only ever reach the first line.
    </PanelNote>
    <PanelNote tone="gap">
      Nothing upstream separates not processed yet from cannot be processed, and
      those two want different responses. Until a source registry exists they are
      one number.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Generated blocks using this" count={blocks.length} flush>
    {#each blocks as block (block.id)}
      <PanelRow
        title={block.name}
        sub={block.ownerResolved
          ? `In ${block.resource} · ${block.location}`
          : `In ${block.resource} — the block that owns it could not be found`}
        icon={Sparkles}
        tone={block.ownerResolved ? "intelligence" : "attention"}
        onselect={() =>
          view.inspect("scope.generated-block", { kind: "block", id: block.id })}
      />
    {/each}

    <PanelNote>
      Changing this Context changes what these produce the next time they run.
    </PanelNote>
    {#if unowned > 0}
      <PanelNote tone="gap">
        A generated output stores no pointer to the block that owns it, so where
        one lives is a reverse query — and for {unowned} of these it comes back
        empty.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Lattice, debug only" count={nodes.length} open={false} flush>
    {#each nodes as node (node.id)}
      <PanelRow
        title="{LEVEL[node.level]} · {node.label}"
        sub="Tier {node.tier} · {node.members} members"
        icon={Waypoints}
        onselect={() => view.inspect("scope.lattice-node", { kind: "node", id: node.id })}
      />
    {/each}

    <PanelNote>
      Retrieval internals, kept for investigating a scope that returns something
      unexpected. Nothing here is a product concept and nothing here is editable.
    </PanelNote>
  </PanelSection>
</Panel>
