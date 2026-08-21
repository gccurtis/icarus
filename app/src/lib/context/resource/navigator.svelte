<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import PanelTop from "@lucide/svelte/icons/panel-top";
  import SeparatorHorizontal from "@lucide/svelte/icons/separator-horizontal";

  import {
    Panel,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    furnitureIn,
    outlineIn,
    pagesIn,
    type FurnitureRow,
    type OutlineEntry,
    type PageRow
  } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Getting somewhere in a long document.
   *
   * `docs/screen-panel-views/context/resource/navigator.md` is the specification.
   * Two ways to move — by structure and by page — and they answer different
   * questions, so a chip switches between them in one region rather than stacking
   * two lists a reader has to scroll past each other.
   *
   * **Pages are numbered rows, not thumbnails.** The specification leaves the
   * choice to review; a thumbnail needs the whole document rendered small, which
   * is the one thing a long document cannot do cheaply, and a number with the
   * heading that starts on it already answers "what is on page 4".
   *
   * **A page number is a label, never an address.** It moves when paper or
   * gutters change, which the note at the foot says out loud.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const outline = $derived(outlineIn(documentId).current);
  const pages = $derived(pagesIn(documentId).current);
  const furniture = $derived(furnitureIn(documentId).current);

  let view = $state<"outline" | "pages">("outline");
  let filter = $state("");

  const VIEWS = [
    { value: "outline", label: "Outline" },
    { value: "pages", label: "Pages" }
  ] as const;

  const matches = (text: string) => text.toLowerCase().includes(filter.trim().toLowerCase());

  const shownOutline = $derived(outline.filter((entry) => matches(entry.text)));
  const shownPages = $derived(
    pages.filter(
      (page) => matches(`Page ${page.number}`) || matches(page.firstHeading ?? page.continues ?? "")
    )
  );

  const onOutline = $derived(view === "outline");
  const matched = $derived(onOutline ? shownOutline.length : shownPages.length);
  const total = $derived(onOutline ? outline.length : pages.length);

  /** What a page carries: the heading that starts on it, or the one it is still in. */
  const pageSub = (page: PageRow) =>
    page.firstHeading ?? (page.continues === undefined ? undefined : `Continues ${page.continues}`);

  const FURNITURE_LENS: Readonly<Record<FurnitureRow["kind"], string>> = {
    break: "resource.page-break",
    header: "resource.header",
    footer: "resource.footer"
  };

  const FURNITURE_ICON = {
    break: SeparatorHorizontal,
    header: PanelTop,
    footer: PanelBottom
  };

  const goToHeading = (entry: OutlineEntry) =>
    mockWorkbench.inspect("resource.text-block-document", { kind: "block", id: entry.id });
</script>

<Panel title="Navigator">
  <PanelSearch
    placeholder={onOutline ? "Filter headings" : "Filter pages"}
    {matched}
    {total}
    bind:value={filter}
    flush
  >
    <!--
      Outline and Pages are the same region, not two. They are the same document
      answered two ways, and showing both at once would make the panel twice as
      long to say one thing.
    -->
    <PanelChoice
      label="Show"
      value={view}
      options={VIEWS}
      onchange={(next) => (view = next as typeof view)}
    />

    {#if onOutline}
      {#each shownOutline as entry (entry.id)}
        <!--
          TODO(vocabulary): needs PanelRow `depth` — an indent of more than one
          level, for an outline nested by heading level. `indent` is a boolean, so
          a level-3 heading sits where a level-2 one does.
        -->
        <PanelRow
          title={entry.text}
          meta="p.{entry.page}"
          indent={entry.level > 1}
          onselect={() => goToHeading(entry)}
        />
      {/each}
    {:else}
      {#each shownPages as page (page.number)}
        <PanelRow
          title="Page {page.number}"
          sub={pageSub(page)}
          icon={FileText}
          onselect={() =>
            mockWorkbench.inspect("resource.document", { kind: "page", id: `${page.number}` })}
        />
      {/each}
    {/if}
  </PanelSearch>

  <!--
    Explicit structure the author put in, plus the two pieces of furniture that
    are otherwise only reachable by clicking the edge of a page. Context rather
    than the reason the panel was opened, so it arrives shut.
  -->
  <PanelSection title="Breaks and furniture" open={false} flush>
    {#each furniture as row (row.id)}
      <PanelRow
        title={row.label}
        meta={row.page === undefined ? undefined : `p.${row.page}`}
        icon={FURNITURE_ICON[row.kind]}
        onselect={() =>
          mockWorkbench.inspect(FURNITURE_LENS[row.kind], { kind: row.kind, id: row.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    Page numbers are computed from the layout as it stands. They move when the
    paper or the gutters change, so none of them is an address.
  </PanelNote>
</Panel>
