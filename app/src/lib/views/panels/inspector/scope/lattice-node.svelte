<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { context, latticeNode } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * A lattice node: retrieval internals, for debugging.
   *
   * `docs/screen-panel-views/inspector/scope/lattice-node.md` is the
   * specification. Not a product concept — it is here so retrieval behaviour can
   * be investigated when a scope returns something unexpected.
   *
   * **Nothing here is editable and nothing is offered.** Lattice nodes are
   * system-managed, so the lens has no actions row: a control here would suggest
   * this is part of what a person configures.
   *
   * **Parents are named, and no hierarchy is promised.** The knowledge model
   * describes a single parent while the clustering describes overlapping
   * cliques, and until that is settled this panel may not draw a tree.
   */
  let {
    contextId = "cx-drafts",
    nodeId = "ln-relay"
  }: { contextId?: string; nodeId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const node = $derived(latticeNode(nodeId).current);

  const trail = $derived([
    { label: scope.name, key: "context" },
    { label: "Lattice" },
    { label: node.label }
  ]);
</script>

<Panel title={node.label}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={() =>
        view.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  <PanelNote>
    Debug only. These are retrieval internals: nothing here is a product concept
    and nothing here can be changed.
  </PanelNote>

  <PanelSection title="Node">
    <PanelFields>
      <PanelField label="Tier" mono>{node.tier}</PanelField>
      <PanelField label="Level">{node.level}</PanelField>
      <PanelField label="Members" mono>{node.members}</PanelField>
    </PanelFields>
  </PanelSection>

  <!-- The statistics behind the node, rather than what it is. Starts shut. -->
  <PanelSection title="Windows" open={false}>
    <PanelFields>
      <PanelField label="Windows" mono>{node.windows}</PanelField>
      <PanelField label="Density" mono>{node.density.toFixed(2)}</PanelField>
      <PanelField label="Cohesion" mono>{node.cohesion.toFixed(2)}</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    Open on arrival, because it is a warning about what the rows above mean. The
    parents are listed without `onselect`: the clustering hands down labels, and
    a row that opened one would be claiming an edge this model cannot promise.
  -->
  <PanelSection title="Contradiction" count={node.parents.length} flush>
    {#each node.parents as parent (parent)}
      <PanelRow title={parent} sub="Named as a parent" />
    {/each}

    {#if node.parents.length === 0}
      <PanelNote>No parent was named for this node.</PanelNote>
    {/if}

    <PanelNote tone="gap">
      The knowledge model describes one parent per node; the clustering describes
      overlapping cliques. Both cannot be right, so this panel names what it was
      given and promises no hierarchy.
    </PanelNote>
  </PanelSection>
</Panel>
