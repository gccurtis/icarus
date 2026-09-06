<script lang="ts">
  import { BlockText, ContentBlock } from "$authored-components/block";

  /**
   * A slide: a fixed canvas, blocks placed on it, chrome on.
   *
   * The 16:9 frame is the point of difference. A document is a column of
   * unbounded length and a slide is a rectangle of fixed size, which is what
   * makes `grow` and `fixed` sensible here and nonsense in a document.
   */
  let {
    blocks,
    selectedId,
    onselect,
    onedit
  }: {
    blocks: readonly {
      id: string;
      sizing: "flow" | "grow" | "fixed";
      text: string;
      align: "start" | "center" | "end" | "justify";
      vertical: "top" | "middle" | "bottom";
      size: "caption" | "body-sm" | "body" | "body-lg" | "h4" | "h3";
      weight: "normal" | "medium" | "semibold";
      width?: string;
      height?: string;
    }[];
    selectedId?: string;
    onselect: (id: string) => void;
    onedit: (id: string, text: string) => void;
  } = $props();
</script>

<div class="bg-surface-pasteboard rounded-panel flex justify-center p-6">
  <div
    class="bg-surface-work shadow-raised flex w-full max-w-3xl flex-col items-start gap-4 p-8"
    style="aspect-ratio: 16 / 9"
  >
  {#each blocks as block (block.id)}
    <ContentBlock
      sizing={block.sizing}
      chrome
      selected={block.id === selectedId}
      width={block.width}
      height={block.height}
      label={`Block: ${block.text.slice(0, 32)}`}
      onselect={() => onselect(block.id)}
    >
      <BlockText
        value={block.text}
        label={`Text of ${block.id}`}
        align={block.align}
        vertical={block.vertical}
        size={block.size}
        weight={block.weight}
        fill={block.sizing === "fixed"}
        oninput={(next: string) => onedit(block.id, next)}
      />
    </ContentBlock>
    {/each}
  </div>
</div>
