<script lang="ts">
  import { Draggable, DropZone } from "$authored-components/drag";
  import Self from "$development-views/stack-builder/components/stack-node.svelte";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import type { StackNode } from "$development-views/stack-builder/types";

  let {
    node,
    index,
    parentId,
    siblings
  }: {
    node: StackNode;
    index: number;
    parentId: string | null;
    siblings: number;
  } = $props();

  const stack = stackOf();

  const place = (dragged: string, parent: string | null, at: number) => {
    if (dragged.includes("/")) stack.add(dragged, parent, at);
    else stack.move(dragged, parent, at);
  };

  const ADDITIONS = [
    { value: "custom", label: "Add a custom entry…" },
    { value: "substack", label: "Add a group…" }
  ];

  const addTo = (value: string) => {
    if (value === "custom") stack.addCustom("A custom entry", node.id);
    else stack.addSubstack("A group", node.id);
  };

  const destinations = $derived([
    ...(index > 0 ? [{ value: "up", label: "Move up" }] : []),
    ...(index < siblings - 1 ? [{ value: "down", label: "Move down" }] : []),
    ...(parentId === null ? [] : [{ value: "out", label: "Move out of the group" }])
  ]);

  const placeSelf = (where: string) => {
    if (where === "out") stack.move(node.id, null, Number.MAX_SAFE_INTEGER);
    else stack.move(node.id, parentId, where === "up" ? index - 1 : index + 1);
  };
</script>

<div class="node" class:selected={node.id === stack.selectedId}>
  <Draggable
    id={node.id}
    label={node.name}
    {destinations}
    onplace={placeSelf}
    onreceive={(dragged) => place(dragged, parentId, index)}
  >
    <button
      type="button"
      class="flex w-full min-w-0 items-baseline gap-2 py-0.5 text-left"
      onclick={() => stack.select(node.id)}
    >
      <span class="text-body-sm shrink-0">
        {node.kind === "substack" ? `${node.name} ⌄` : node.name}
      </span>
      <span class="text-caption text-ink-muted truncate">
        {node.description || "no description yet"}
      </span>
    </button>
  </Draggable>
</div>

{#if node.kind === "substack"}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="children" ondrop={(event) => event.stopPropagation()}>
    <DropZone
      label={node.name}
      empty="Drop a component into this group"
      count={node.children.length}
      additions={ADDITIONS}
      onadd={addTo}
      ondrop={(dragged) => place(dragged, node.id, node.children.length)}
    >
      <div class="flex w-full flex-col gap-1">
        {#each node.children as child, at (child.id)}
          <Self node={child} index={at} parentId={node.id} siblings={node.children.length} />
        {/each}
      </div>
    </DropZone>
  </div>
{/if}

<style>
  .node {
    border-radius: var(--token-radius-control);
  }

  .node.selected {
    background-color: var(--token-surface-selection);
  }

  .children {
    margin-inline-start: calc(var(--token-spacing-unit) * 4);
  }
</style>
