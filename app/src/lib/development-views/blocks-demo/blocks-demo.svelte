<script lang="ts">
  import BlockInspector from "$development-views/blocks-demo/components/block-inspector.svelte";
  import DocumentSurface from "$development-views/blocks-demo/components/document-surface.svelte";
  import SlideSurface from "$development-views/blocks-demo/components/slide-surface.svelte";
  import { ScreenGroup, ScreenNote, ScreenSurface } from "$authored-components/screen";

  /**
   * Content blocks on the two surfaces that hold them, with the panel that
   * inspects one.
   *
   * **The claim this page exists to make:** the document and the slide below
   * render the *same component* with the same data. The only difference is that
   * the slide turns chrome on and the document does not — and that single prop
   * is the whole reason a document reads as prose and a slide reads as a
   * composition.
   *
   * **The panel on the right is the second half.** Selecting a block changes
   * what the inspector offers, because a paragraph in a document and a text
   * object on a slide can be changed in genuinely different ways: one cannot
   * choose its own width, the other exists to.
   */
  type Block = {
    id: string;
    surface: "document" | "slide";
    sizing: "flow" | "grow" | "fixed";
    text: string;
    align: "start" | "center" | "end";
    size: "caption" | "body-sm" | "body" | "body-lg" | "h4" | "h3";
    weight: "normal" | "medium" | "semibold";
    width?: string;
    height?: string;
  };

  let blocks = $state<Block[]>([
    {
      id: "doc-title",
      surface: "document",
      sizing: "flow",
      text: "Q3 Resilience Memo",
      align: "start",
      size: "h3",
      weight: "semibold"
    },
    {
      id: "doc-body",
      surface: "document",
      sizing: "flow",
      text: "Across the three storm events, undergrounded segments lost 38% fewer customer-minutes than overhead ones. The difference is largest on feeders with more than nine spans of overhead run, which is where the next tranche of spend should go. Type into this and watch the height follow — the width cannot move, because it is the column.",
      align: "start",
      size: "body",
      weight: "normal"
    },
    {
      id: "slide-title",
      surface: "slide",
      sizing: "grow",
      text: "Undergrounding works",
      align: "start",
      size: "h4",
      weight: "semibold"
    },
    {
      id: "slide-shape",
      surface: "slide",
      sizing: "fixed",
      text: "38%",
      align: "center",
      size: "h3",
      weight: "semibold",
      width: "11rem",
      height: "7rem"
    }
  ]);

  let selectedId = $state<string | undefined>("doc-body");
  const selected = $derived(blocks.find((block) => block.id === selectedId));

  const update = (
    key: "align" | "size" | "weight" | "width" | "height",
    value: string
  ) => {
    const index = blocks.findIndex((block) => block.id === selectedId);
    if (index === -1) return;
    // The panel only ever sends strings for these five fields, and every one of
    // them is a string union or an optional string on Block.
    (blocks[index] as Record<string, unknown>)[key] = value;
  };
</script>

<svelte:head>
  <title>Content blocks — Icarus</title>
</svelte:head>

<div class="flex h-full min-h-0">
  <ScreenSurface wide class="flex-1">
    <a href="/demo/vocabulary" class="text-caption text-interactive-text w-fit hover:underline">
      ← Composition vocabulary
    </a>

    <h1 class="text-h3 leading-h3 m-0 font-semibold tracking-tight">Content blocks</h1>
    <p class="text-body-sm text-ink-muted m-0 max-w-prose">
      Both surfaces below render the same component with the same data. The slide
      turns chrome on; the document does not. That one prop is the whole reason
      one reads as prose and the other as a composition.
    </p>

    <ScreenGroup label="A document — flow">
      <DocumentSurface
        blocks={blocks.filter((block) => block.surface === "document")}
        {selectedId}
        onselect={(id) => (selectedId = id)}
        onedit={(id, text) => {
          const index = blocks.findIndex((block) => block.id === id);
          if (index !== -1) blocks[index].text = text;
        }}
      />
    </ScreenGroup>

    <ScreenGroup label="A slide — grow and fixed">
      <SlideSurface
        blocks={blocks.filter((block) => block.surface === "slide")}
        {selectedId}
        onselect={(id) => (selectedId = id)}
        onedit={(id, text) => {
          const index = blocks.findIndex((block) => block.id === id);
          if (index !== -1) blocks[index].text = text;
        }}
      />
    </ScreenGroup>

    <ScreenNote>
      The document's blocks have no edges even when selected — selection is a
      dashed outline that costs no layout, because a document that reflows when
      you click it is a document you cannot read. The slide's blocks have real
      edges, because on a slide the box is the thing being arranged.
    </ScreenNote>
  </ScreenSurface>

  <div class="border-border-subtle bg-surface-panel w-75 shrink-0 border-s">
    <BlockInspector block={selected} {update} />
  </div>
</div>
