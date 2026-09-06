<script lang="ts">
  import BlockInspector from "$development-views/blocks-demo/components/block-inspector.svelte";
  import DocumentSurface from "$development-views/blocks-demo/components/document-surface.svelte";
  import SlideSurface from "$development-views/blocks-demo/components/slide-surface.svelte";
  import { ResizeHandle } from "$authored-components/resize-handle";
  import { ScreenGroup, ScreenNote, ScreenSurface } from "$authored-components/screen";
  import {
    COLLAPSE_BELOW,
    COLLAPSED_WIDTH,
    MAX_WIDTH,
    MIN_WIDTH
  } from "$surfaces/inspector/types";

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
   *
   * **The panel drags at the real inspector's bounds.** It used to be pinned at
   * 180px — narrower than the application's own minimum — so every control in it
   * was being judged at a width the product never renders.
   */
  type Block = {
    id: string;
    surface: "document" | "slide";
    sizing: "flow" | "grow" | "fixed";
    text: string;
    align: "start" | "center" | "end" | "justify";
    vertical: "top" | "middle" | "bottom";
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
      vertical: "top",
      size: "h3",
      weight: "semibold"
    },
    {
      id: "doc-body",
      surface: "document",
      sizing: "flow",
      text: "Across the three storm events, undergrounded segments lost 38% fewer customer-minutes than overhead ones. The difference is largest on feeders with more than nine spans of overhead run, which is where the next tranche of spend should go. Type into this and watch the height follow — the width cannot move, because it is the column.",
      align: "start",
      vertical: "top",
      size: "body",
      weight: "normal"
    },
    {
      id: "slide-title",
      surface: "slide",
      sizing: "grow",
      text: "Undergrounding works",
      align: "start",
      vertical: "top",
      size: "h4",
      weight: "semibold"
    },
    {
      id: "slide-shape",
      surface: "slide",
      sizing: "fixed",
      text: "38%",
      align: "center",
      vertical: "middle",
      size: "h3",
      weight: "semibold",
      width: "11rem",
      height: "7rem"
    }
  ]);

  let selectedId = $state<string | undefined>("doc-body");
  const selected = $derived(blocks.find((block) => block.id === selectedId));

  let panelWidth = $state(320);
  let panelCollapsed = $state(false);
  const visible = $derived(panelCollapsed ? COLLAPSED_WIDTH : panelWidth);

  const update = (
    key: "align" | "vertical" | "size" | "weight" | "width" | "height",
    value: string
  ) => {
    const index = blocks.findIndex((block) => block.id === selectedId);
    if (index === -1) return;
    // The panel only ever sends strings for these six fields, and every one of
    // them is a string union or an optional string on Block.
    (blocks[index] as Record<string, unknown>)[key] = value;
  };

  const edit = (id: string, text: string) => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index !== -1) blocks[index].text = text;
  };
</script>

<svelte:head>
  <title>Content blocks — Icarus</title>
</svelte:head>

<div class="flex min-h-0 flex-1">
  <ScreenSurface wide class="flex-1">
    <div class="flex flex-col gap-3">
      <span class="eyebrow">Celestial · content blocks</span>
      <h1 class="text-h2 tracking-heading max-w-title m-0 font-semibold text-balance">
        One component, two surfaces
      </h1>
      <p class="text-body-sm text-ink-secondary max-w-prose m-0">
        Both surfaces below render the same component with the same data. The slide turns chrome
        on; the document does not. That one prop is the whole reason one reads as prose and the
        other as a composition.
      </p>
      <div class="rail rail-attention max-w-prose p-3">
        <p class="text-body-sm text-ink-secondary m-0">
          <strong class="text-ink-primary">Demonstrative.</strong> This is not what the document or
          slide editors should look like — they own their own surfaces and will decide their own
          chrome. Blocks are arguably the wrong level to be working at anyway: the real unit is an
          atom, and a block is composed of atoms. What this page is for is the one claim below.
        </p>
      </div>

      <div class="rail rail-quiet max-w-prose p-3">
        <p class="text-body-sm text-ink-secondary m-0">
          The document is set in the <strong class="text-ink-primary">reading voice</strong> and
          floats on the pasteboard; the slide is set in the instrument voice on the same plane. A
          document set in the interface font tells the reader the page is part of the application —
          it is not, it is the thing the application is for.
        </p>
      </div>
    </div>

    <ScreenGroup label="A document — flow">
      <DocumentSurface
        blocks={blocks.filter((block) => block.surface === "document")}
        {selectedId}
        onselect={(id) => (selectedId = id)}
        onedit={edit}
      />
    </ScreenGroup>

    <ScreenGroup label="A slide — grow and fixed">
      <SlideSurface
        blocks={blocks.filter((block) => block.surface === "slide")}
        {selectedId}
        onselect={(id) => (selectedId = id)}
        onedit={edit}
      />
    </ScreenGroup>

    <ScreenNote>
      The document's blocks have no edges even when selected — selection is a dashed outline that
      costs no layout, because a document that reflows when you click it is a document you cannot
      read. The slide's blocks have real edges, because on a slide the box is the thing being
      arranged.
    </ScreenNote>
  </ScreenSurface>

  <aside
    class="border-border-subtle bg-surface-panel relative shrink-0 border-s"
    style="width: {visible}px"
  >
    <BlockInspector block={selected} {update} collapsed={panelCollapsed} />
    <ResizeHandle
      side="end"
      width={panelWidth}
      collapsed={panelCollapsed}
      min={MIN_WIDTH}
      max={MAX_WIDTH}
      collapseBelow={COLLAPSE_BELOW}
      label="the block inspector"
      onchange={({ width, collapsed }) => {
        panelWidth = width;
        panelCollapsed = collapsed;
      }}
    />
  </aside>
</div>
