<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelControlGroup,
    PanelControlRow,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelNumber,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import {
    PAGE_NUMBER_POSITIONS,
    customPaperOps,
    marginOps,
    orientationOps,
    pageNumberFieldOps,
    pageNumberOf,
    pageNumberOps,
    paperOps,
    setupOf
  } from "$app-views/categories/document-editor/procedures/layout";
  import {
    figures,
    layoutMetrics,
    paperDimensions,
    paperOptions
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const ORIENTATIONS = [
    { value: "portrait", label: "Portrait", short: "P" },
    { value: "landscape", label: "Landscape", short: "L" }
  ];

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const setup = $derived(setupOf(body));
  const metrics = $derived(layoutMetrics(setup));
  const custom = $derived(typeof setup.paper === "object");
  const paper = $derived(custom ? "custom" : (setup.paper as string));
  const dimensions = $derived(paperDimensions(setup.paper));
  const numbering = $derived(pageNumberOf(body));

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const withBody = (make: (held: NonNullable<typeof body>) => Parameters<DocumentRuntime["apply"]>[0]) => {
    if (body !== undefined) commit(make(body));
  };

</script>

<Panel title="Layout">
  {#if body === undefined}
    <PanelEmpty title="Open a document to lay it out" />
  {:else}
    <PanelSection title="Paper">
      <PanelControlGroup flush>
        <PanelControlRow label="Size">
          <PanelSelect label="Paper size" value={paper} options={paperOptions()} onchange={(next) => withBody((held) => paperOps(held, next))} />
        </PanelControlRow>
        {#if custom}
          <PanelControlRow label="Width">
            <PanelNumber label="Paper width" value={dimensions.width} unit="in" min={1} max={40} step={0.1} flush onchange={(next) => withBody((held) => customPaperOps(held, { width: next }))} />
          </PanelControlRow>
          <PanelControlRow label="Height">
            <PanelNumber label="Paper height" value={dimensions.height} unit="in" min={1} max={40} step={0.1} flush onchange={(next) => withBody((held) => customPaperOps(held, { height: next }))} />
          </PanelControlRow>
        {/if}
        <PanelControlRow label="Orientation">
          <PanelChoice label="Orientation" value={setup.orientation} options={ORIENTATIONS} flush fill onchange={(next) => withBody((held) => orientationOps(held, next === "landscape" ? "landscape" : "portrait"))} />
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>

    <PanelSection title="Margins (in)">
      <PanelControlGroup flush>
        <PanelControlRow label="Top">
          <PanelNumber label="Top margin" value={setup.margins.top} unit="in" min={0} max={5} step={0.05} flush onchange={(next) => withBody((held) => marginOps(held, "top", next))} />
        </PanelControlRow>
        <PanelControlRow label="Right">
          <PanelNumber label="Right margin" value={setup.margins.right} unit="in" min={0} max={5} step={0.05} flush onchange={(next) => withBody((held) => marginOps(held, "right", next))} />
        </PanelControlRow>
        <PanelControlRow label="Bottom">
          <PanelNumber label="Bottom margin" value={setup.margins.bottom} unit="in" min={0} max={5} step={0.05} flush onchange={(next) => withBody((held) => marginOps(held, "bottom", next))} />
        </PanelControlRow>
        <PanelControlRow label="Left">
          <PanelNumber label="Left margin" value={setup.margins.left} unit="in" min={0} max={5} step={0.05} flush onchange={(next) => withBody((held) => marginOps(held, "left", next))} />
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>

    <PanelSection title="Page numbers">
      <PanelControlGroup flush>
        <PanelControlRow label="Position">
          <PanelSelect label="Page number position" value={numbering?.position ?? "none"} options={PAGE_NUMBER_POSITIONS} onchange={(next) => withBody((held) => pageNumberOps(held, next))} />
        </PanelControlRow>
        {#if numbering !== undefined}
          <PanelControlRow label="Start at">
            <PanelNumber label="First page number" value={numbering.startAt ?? 1} min={0} max={9999} flush onchange={(next) => withBody((held) => pageNumberFieldOps(held, { startAt: next }))} />
          </PanelControlRow>
          <PanelToggle label="Hide on the first page" checked={numbering.hideOnFirstPage === true} onchange={(next) => withBody((held) => pageNumberFieldOps(held, { hideOnFirstPage: next ? true : undefined }))} />
        {/if}
      </PanelControlGroup>
    </PanelSection>

    <PanelSection title="Dimensions" open={false}>
      <PanelFields>
        <PanelField label="Page (in)" mono stacked>{figures(metrics.paper)}</PanelField>
        <PanelField label="Text area (in)" mono stacked>{figures(metrics.content)}</PanelField>
        <PanelField label="Characters" mono stacked>{metrics.charactersPerLine} per line</PanelField>
        <PanelField label="Lines" mono stacked>{metrics.linesPerPage} per page</PanelField>
      </PanelFields>
    </PanelSection>
  {/if}
</Panel>
