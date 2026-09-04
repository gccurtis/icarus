<script lang="ts">
  import { DropZone } from "$authored-components/drag";
  import StackNodeRow from "$development-views/stack-builder/components/stack-node.svelte";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Button } from "$vendored-components/button";

  const stack = stackOf();

  const ADDITIONS = [
    { value: "custom", label: "Add a custom entry…" },
    { value: "substack", label: "Add a group…" }
  ];

  const addTo = (value: string) => {
    if (value === "custom") stack.addCustom("A custom entry");
    else stack.addSubstack("A group");
  };

  const drop = (dragged: string) => {
    if (dragged.includes("/")) stack.add(dragged, null, stack.nodes.length);
    else stack.move(dragged, null, stack.nodes.length);
  };
</script>

<div class="flex flex-col gap-3 p-3">
  <DropZone
    label={stack.title}
    empty="Drag a component here, or add one from the menu"
    count={stack.nodes.length}
    additions={ADDITIONS}
    onadd={addTo}
    ondrop={drop}
  >
    <div class="flex w-full flex-col gap-1">
      {#each stack.nodes as node, index (node.id)}
        <StackNodeRow {node} {index} parentId={null} siblings={stack.nodes.length} />
      {/each}
    </div>
  </DropZone>

  {#if stack.selected}
    <div>
      <Button variant="ghost" size="sm" onclick={() => stack.remove(stack.selectedId)}>
        Remove {stack.selected.name}
      </Button>
    </div>
  {/if}
</div>
