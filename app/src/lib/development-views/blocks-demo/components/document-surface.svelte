<script lang="ts">
  import { BlockText, ContentBlock } from "$authored-components/block";

  /**
   * A page of a document: one column, blocks stacked down it, no chrome.
   *
   * The measure is the surface's decision rather than any block's, which is
   * exactly why a document block is `flow`. A paragraph that could set its own
   * width would be able to break the column it sits in.
   */
  let {
    blocks,
    selectedId,
    onselect,
    onedit
  }: {
    blocks: readonly {
      id: string;
      text: string;
      align: "start" | "center" | "end" | "justify";
      vertical: "top" | "middle" | "bottom";
      size: "caption" | "body-sm" | "body" | "body-lg" | "h4" | "h3";
      weight: "normal" | "medium" | "semibold";
    }[];
    selectedId?: string;
    onselect: (id: string) => void;
    onedit: (id: string, text: string) => void;
  } = $props();
</script>

<div class="bg-surface-pasteboard rounded-panel flex justify-center p-6">
  <div
    class="bg-surface-work shadow-raised font-reading leading-reading flex w-full max-w-3xl flex-col gap-4 px-12 py-10"
  >
  {#each blocks as block (block.id)}
    <ContentBlock
      sizing="flow"
      selected={block.id === selectedId}
      label={`Paragraph: ${block.text.slice(0, 32)}`}
      onselect={() => onselect(block.id)}
    >
      <BlockText
        value={block.text}
        label={`Text of ${block.id}`}
        align={block.align}
        vertical={block.vertical}
        size={block.size}
        weight={block.weight}
        oninput={(next: string) => onedit(block.id, next)}
      />
    </ContentBlock>
    {/each}
  </div>
</div>
