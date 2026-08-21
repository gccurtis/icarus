<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { pageSetup, type PageSetup } from "$mock-capabilities/resource";

  /**
   * Paper, gutters, furniture and numbering — everything that applies to every
   * page.
   *
   * `docs/screen-panel-views/context/resource/page.md` is the specification. What
   * is set here is drawn on the page itself as a dashed guide, which is why there
   * is no ruler above the text: a margin is easier to judge where you write than
   * to measure on a scale somewhere else.
   *
   * **The controls hold their own values.** `pageSetup` is a read and there is no
   * write door yet, so a change is kept here and the record answers for anything
   * nobody has touched. Replacing the mock is a write call per `onchange` rather
   * than a rewrite.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const stored = $derived(pageSetup(documentId).current);

  let edits = $state<{
    paper?: PageSetup["paper"];
    orientation?: PageSetup["orientation"];
    top?: string;
    bottom?: string;
    inside?: string;
    outside?: string;
    headerBand?: string;
    footerBand?: string;
    firstPageDiffers?: boolean;
    startAt?: number;
    position?: string;
    showOnFirst?: boolean;
  }>({});

  const paper = $derived(edits.paper ?? stored.paper);
  const orientation = $derived(edits.orientation ?? stored.orientation);
  const top = $derived(edits.top ?? stored.margins.top);
  const bottom = $derived(edits.bottom ?? stored.margins.bottom);
  const inside = $derived(edits.inside ?? stored.margins.inside);
  const outside = $derived(edits.outside ?? stored.margins.outside);
  const headerBand = $derived(edits.headerBand ?? stored.headerBand);
  const footerBand = $derived(edits.footerBand ?? stored.footerBand);
  const firstPageDiffers = $derived(edits.firstPageDiffers ?? stored.firstPageDiffers);
  const startAt = $derived(edits.startAt ?? stored.numbering.startAt);
  const position = $derived(edits.position ?? stored.numbering.position);
  const showOnFirst = $derived(edits.showOnFirst ?? stored.numbering.showOnFirst);

  const PAPER = [
    { value: "Letter", label: "Letter" },
    { value: "A4", label: "A4" }
  ] as const;

  const ORIENTATION = [
    { value: "Portrait", label: "Portrait" },
    { value: "Landscape", label: "Landscape" }
  ] as const;

  const POSITIONS = [
    { value: "Footer, outside", label: "Footer, outside" },
    { value: "Footer, centre", label: "Footer, centre" },
    { value: "Footer, inside", label: "Footer, inside" },
    { value: "Header, outside", label: "Header, outside" }
  ] as const;

  /** A start number is typed, so it arrives as text and is only taken when it is one. */
  const setStartAt = (next: string) => {
    const value = Number.parseInt(next, 10);
    if (Number.isFinite(value)) edits.startAt = value;
  };
</script>

<Panel title="Page">
  <PanelSection title="Paper">
    <PanelChoice
      label="Size"
      value={paper}
      options={PAPER}
      onchange={(next) => (edits.paper = next as PageSetup["paper"])}
    />
    <PanelChoice
      label="Orientation"
      value={orientation}
      options={ORIENTATION}
      onchange={(next) => (edits.orientation = next as PageSetup["orientation"])}
    />
  </PanelSection>

  <PanelSection title="Gutters">
    <PanelFields>
      <PanelField label="Top" mono>
        <PanelEditableText
          label="Top margin"
          value={top}
          mono
          onchange={(next) => (edits.top = next)}
        />
      </PanelField>
      <PanelField label="Bottom" mono>
        <PanelEditableText
          label="Bottom margin"
          value={bottom}
          mono
          onchange={(next) => (edits.bottom = next)}
        />
      </PanelField>
      <PanelField label="Inside" mono>
        <PanelEditableText
          label="Inside margin"
          value={inside}
          mono
          onchange={(next) => (edits.inside = next)}
        />
      </PanelField>
      <PanelField label="Outside" mono>
        <PanelEditableText
          label="Outside margin"
          value={outside}
          mono
          onchange={(next) => (edits.outside = next)}
        />
      </PanelField>
    </PanelFields>

    <!--
      Named for a bound document rather than for a screen: the wide margin is the
      one at the spine, and it has to stay at the spine when the page turns.
    -->
    <PanelNote>
      Inside is the bound edge and outside the open one, so a two-sided document
      keeps its wide margin at the spine.
    </PanelNote>
  </PanelSection>

  <!-- The reserved bands, and whether the first page is exempt. -->
  <PanelSection title="Header and footer" open={false}>
    <PanelFields>
      <PanelField label="Header" mono>
        <PanelEditableText
          label="Header band"
          value={headerBand}
          mono
          onchange={(next) => (edits.headerBand = next)}
        />
      </PanelField>
      <PanelField label="Footer" mono>
        <PanelEditableText
          label="Footer band"
          value={footerBand}
          mono
          onchange={(next) => (edits.footerBand = next)}
        />
      </PanelField>
      <PanelField label="First page differs">
        <PanelToggle
          label="First page differs"
          checked={firstPageDiffers}
          onchange={(next) => (edits.firstPageDiffers = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Page numbering" open={false}>
    <PanelFields>
      <PanelField label="Start at" mono>
        <PanelEditableText
          label="Start numbering at"
          value={`${startAt}`}
          mono
          onchange={setStartAt}
        />
      </PanelField>
      <PanelField label="Position">
        <PanelSelect
          label="Number position"
          value={position}
          options={POSITIONS}
          onchange={(next) => (edits.position = next)}
        />
      </PanelField>
      <PanelField label="Show on first">
        <PanelToggle
          label="Show the number on the first page"
          checked={showOnFirst}
          onchange={(next) => (edits.showOnFirst = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelNote>
      Page numbers are generated from these three. A number typed into footer
      content is a literal and will not follow the document.
    </PanelNote>
  </PanelSection>
</Panel>
