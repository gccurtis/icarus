<script lang="ts">
  import { clientModel, type ResourceRef } from "$model/client";

  /**
   * What a `document` resource renders as.
   *
   * **A fixture, and the only caller of `inspect()` in the application.** Its
   * blocks are static prose; what is real is the reporting. Pressing inside a
   * block inspects the caret, and releasing after a drag inspects the selection
   * with its actual character offsets — so the inspector's whole path, from a
   * gesture through the workbench to a rendered panel, can be exercised without
   * a document capability existing.
   *
   * Offsets are computed against the block rather than taken from the DOM
   * selection directly: `anchorOffset` counts within one text node, and a block
   * holding any markup has several. Measuring the range from the block's start
   * gives the offset the model's contract means.
   *
   * Nothing here carries text into the inspection. That is the design the model
   * states: an inspection names ids and offsets, and whoever renders it fetches
   * what it needs. A payload would be a copy of something that lives elsewhere
   * and may have changed since — which is also why an inspection is not
   * persisted.
   */
  let { resource }: { resource: ResourceRef } = $props();

  const { workbench } = clientModel();

  const BLOCKS = [
    {
      id: "b1",
      text: "Selection reported here reaches the inspector through the workbench, not through a prop. Drag across this sentence and the panel to the right names the offsets."
    },
    {
      id: "b2",
      text: "Click without dragging and the inspection becomes a caret instead. Both are members of the same closed union, so the inspector has to handle each one it can receive."
    },
    {
      id: "b3",
      text: "Switch tabs and the inspection stays with the tab that owns it, because it is stored on the tab rather than on the workbench."
    }
  ];

  /** Characters from the block's start to a point inside it. */
  const offsetWithin = (block: Node, container: Node, offset: number): number => {
    const range = window.document.createRange();
    range.selectNodeContents(block);
    range.setEnd(container, offset);
    return range.toString().length;
  };

  const report = (blockId: string, event: MouseEvent) => {
    const block = event.currentTarget as HTMLElement;
    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.anchorNode && block.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const from = offsetWithin(block, range.startContainer, range.startOffset);
      workbench.inspect([
        { kind: "document-text-selection", blockId, from, to: from + range.toString().length }
      ]);
      return;
    }

    workbench.inspect([{ kind: "document-next-text", blockId }]);
  };
</script>

<article class="document">
  <h1 class="title">{resource.id}</h1>
  <p class="hint">Click a paragraph to inspect the caret; drag across one to inspect a selection.</p>

  {#each BLOCKS as block (block.id)}
    <!--
      A paragraph is not a control, so it takes no role and no tabindex. Reaching
      an inspection by keyboard is a real gap and belongs to a real editor, which
      owns a caret; giving a paragraph a button role here would claim a keyboard
      path that does not work.
    -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <p class="block" data-block-id={block.id} onmouseup={(event) => report(block.id, event)}>
      {block.text}
    </p>
  {/each}
</article>

<style>
  .document {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
    max-width: 65ch;
    margin-inline: auto;
    padding: calc(var(--token-spacing-unit) * 8) calc(var(--token-spacing-unit) * 6);
  }

  .title {
    font-size: var(--token-text-h3);
    line-height: var(--token-text-h3-leading);
    font-weight: 600;
    margin: 0;
  }

  .hint {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
    margin: 0;
  }

  .block {
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
    color: var(--token-ink-primary);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 2);
    border-radius: var(--token-radius-panel);
    cursor: text;
  }

  .block:hover {
    background-color: var(--token-surface-panel);
  }
</style>
