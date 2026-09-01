<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { ScreenNote, ScreenSurface } from "$authored-components/screen";
  import {
    documentFooter,
    documentHeader,
    documentRecord,
    documentTable,
    findInDocument,
    furnitureIn,
    inlineFormula,
    outlineIn,
    pageSetup,
    pagesIn,
    promptBlock,
    textBlock,
    type PageSetup
  } from "$capabilities/resource";
  import { workspaceState, type InspectorView } from "$model/client/workspace-state";

  const view = workspaceState();

  /**
   * Document editor — the only state this category has.
   *
   * `docs/screen-panel-views/screens/document-editor/workspace.md` is the
   * specification. **One region, `editor`, and one track.** A rich-text editor is
   * not a composition of panels, and drawing it as one would describe
   * ProseMirror's job rather than ours — so the layout table has a single `1fr`
   * column and a single band, and the band takes the height it is given.
   *
   * **ProseMirror is not installed.** What is drawn here is the part that is
   * *ours*: pagination, the four gutters, the canonical header and footer bands,
   * an inline formula set as prose, and a prompt block marked in the gutter
   * rather than boxed. The view itself, undo history, IME state and pending
   * operations belong to the framework and to the tab runtime, and none of them
   * is here. The note under the canvas says so rather than leaving a reviewer to
   * discover that nothing types.
   *
   * **There is no door that lists a body's blocks** — `textBlock` addresses one
   * at a time — so the page flow is assembled from the doors that can name a
   * block: the outline's headings, the furniture list's page break, and the find
   * index, which is the only door that hands back block ids together with the
   * page they fall on.
   *
   * **A page has no ID.** "Page 3" is a label for where a block currently falls
   * and moves with paper and gutters, which is why the number is set beside the
   * sheet on the pasteboard rather than printed on it as an address.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const record = $derived(documentRecord(documentId).current);
  const setup = $derived(pageSetup(documentId).current);
  const pages = $derived(pagesIn(documentId).current);
  const headings = $derived(outlineIn(documentId).current);
  const furniture = $derived(furnitureIn(documentId).current);
  const header = $derived(documentHeader(documentId).current);
  const footer = $derived(documentFooter(documentId).current);
  const hits = $derived(findInDocument(documentId, "storm").current);

  /** Addressed by id, which is all the door offers — a body has no list of its formulas. */
  const formula = $derived(inlineFormula("if-1").current);

  const PAPER: Record<PageSetup["paper"], { readonly w: number; readonly h: number }> = {
    Letter: { w: 8.5, h: 11 },
    A4: { w: 8.27, h: 11.69 }
  };

  const sheet = $derived(
    setup.orientation === "Landscape"
      ? { w: PAPER[setup.paper].h, h: PAPER[setup.paper].w }
      : PAPER[setup.paper]
  );

  /** "1.25 in" against the paper, as a percentage, so a guide survives any zoom. */
  const across = (measure: string) => (Number.parseFloat(measure) / sheet.w) * 100;
  const down = (measure: string) => (Number.parseFloat(measure) / sheet.h) * 100;

  type Piece =
    | { kind: "break"; key: string; page: number; rank: number; label: string }
    | { kind: "heading"; key: string; page: number; rank: number; level: 1 | 2 | 3; text: string }
    | { kind: "body"; key: string; page: number; rank: number; text: string }
    | { kind: "generated"; key: string; page: number; rank: number; prompt: string; output: string }
    | {
        kind: "table";
        key: string;
        page: number;
        rank: number;
        rows: number;
        headerRow: boolean;
        widths: readonly string[];
      };

  const pieces = $derived.by<readonly Piece[]>(() => {
    const out: Piece[] = [];
    const seen = new Set<string>();

    for (const row of furniture) {
      if (row.kind !== "break" || row.page === undefined) continue;
      out.push({ kind: "break", key: row.id, page: row.page, rank: 0, label: row.label });
    }

    for (const heading of headings) {
      out.push({
        kind: "heading",
        key: heading.id,
        page: heading.page,
        rank: 1,
        level: heading.level,
        text: heading.text
      });
    }

    for (const hit of hits) {
      if (hit.blockId === undefined || seen.has(hit.blockId)) continue;
      seen.add(hit.blockId);

      if (hit.source === "Body") {
        const block = textBlock(hit.blockId).current;
        out.push({ kind: "body", key: block.id, page: block.page, rank: 2, text: block.text });
      } else if (hit.source === "Prompt block output") {
        const block = promptBlock(hit.blockId).current;
        out.push({
          kind: "generated",
          key: block.id,
          page: hit.page,
          rank: 3,
          prompt: block.prompt,
          output: block.output
        });
      } else if (hit.source === "Table") {
        const table = documentTable(hit.blockId).current;
        out.push({
          kind: "table",
          key: table.id,
          page: hit.page,
          rank: 4,
          rows: table.rows,
          headerRow: table.headerRow,
          widths: table.columnWidths
        });
      }
    }

    return out;
  });

  const on = (page: number) => pieces.filter((piece) => piece.page === page).sort((a, b) => a.rank - b.rank);

  /** The first paragraph carries the formula atom: the doors give it no anchor of its own. */
  const carriesFormula = $derived(pieces.find((piece) => piece.kind === "body")?.key);

  const folio = (page: number) => page + footer.startAt - 1;

  /**
   * The first page differs, and here it differs by being empty. The band is still
   * drawn and still pressable — it is the one canonical header either way — it
   * simply has nothing on it.
   */
  const headerOn = (page: number) => {
    const content = page === 1 && setup.firstPageDiffers ? header.firstPageContent : header.content;
    return content === "Empty" ? "" : content;
  };

  const HEADING: Record<1 | 2 | 3, string> = {
    1: "text-h3 leading-h3 font-semibold",
    2: "text-body font-semibold",
    3: "text-body-sm font-semibold"
  };

  let selected = $state<string | undefined>(undefined);

  const inspect = (key: InspectorView, kind: string, id: string) => {
    selected = id;
    view.inspect(key, { kind, id });
  };

  /**
   * A trackpad pinch arrives as a wheel event carrying `ctrlKey`. Taking it here,
   * before the browser acts on it, scales the pasteboard and leaves the shell
   * alone. The browser's own zoom happens above the document and no page can
   * scope it, which this does not pretend to.
   */
  let zoom = $state(1);

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoom = Math.min(2, Math.max(0.5, zoom - event.deltaY / 400));
  };
</script>

<ScreenSurface wide class="gap-0 overflow-y-hidden p-0">
  <div class="board">
    <div class="area-editor">
      <!-- The pasteboard: the document floats on it with room on all four sides. -->
      <div class="canvas bg-surface-canvas" onwheel={pinch}>
        <div class="pasteboard" style="--zoom: {zoom}">
          {#each pages as page (page.number)}
            <div class="sheet">
              <article
                class="page bg-surface-panel border-border-subtle border"
                style="aspect-ratio: {sheet.w} / {sheet.h};
                       --m-top: {down(setup.margins.top)}%;
                       --m-bottom: {down(setup.margins.bottom)}%;
                       --m-inside: {across(setup.margins.inside)}%;
                       --m-outside: {across(setup.margins.outside)}%;
                       --h-top: {down(header.fromTop)}%;
                       --f-bottom: {down(footer.fromBottom)}%"
              >
                <!--
                  All four gutters, dashed. Inside is drawn on the left because
                  every sheet here is a recto; the setting is named inside and
                  outside so it survives a page turn.
                -->
                <span class="guide border-border-strong" aria-hidden="true"></span>

                <!--
                  One canonical header, projected onto every page. Pressing it
                  opens the single editor for it — you are never editing "the
                  header on page 4".
                -->
                <button
                  type="button"
                  aria-label="Header"
                  class="band band-header text-caption text-ink-muted hover:bg-surface-panel-hover"
                  onclick={() => view.inspect("document-editor.header")}
                >
                  <span class="truncate">{headerOn(page.number)}</span>
                </button>

                <div class="flow">
                  {#each on(page.number) as piece (piece.key)}
                    {#if piece.kind === "break"}
                      <span class="break border-border-strong text-caption text-ink-muted">
                        {piece.label}
                      </span>
                    {:else if piece.kind === "heading"}
                      <button
                        type="button"
                        class="block-run text-ink-primary {HEADING[piece.level]}"
                        class:is-selected={selected === piece.key}
                        onclick={() => inspect("document-editor.text-block", "block", piece.key)}
                      >
                        {piece.text}
                      </button>
                    {:else if piece.kind === "body"}
                      <button
                        type="button"
                        class="block-run text-body-sm text-ink-secondary"
                        class:is-selected={selected === piece.key}
                        onclick={() => inspect("document-editor.text-block", "block", piece.key)}
                      >
                        {piece.text}
                        {#if piece.key === carriesFormula}
                          <!--
                            An atom in running text, set as ordinary prose rather
                            than as a widget. It reads its value when it runs, so
                            there is nothing stale about it and nothing to
                            refresh.
                          -->
                          <span
                            class="text-ink-primary underline decoration-dotted underline-offset-2"
                            title="{formula.expression} · {formula.readsWhen}"
                          >
                            {formula.shows}
                          </span>
                        {/if}
                      </button>
                    {:else if piece.kind === "generated"}
                      <button
                        type="button"
                        class="block-run text-body-sm text-ink-secondary"
                        class:is-selected={selected === piece.key}
                        onclick={() => inspect("document-editor.prompt-block", "block", piece.key)}
                        title={piece.prompt}
                      >
                        <!--
                          What marks a block as generated belongs in the gutter,
                          not around the prose. A document is stable and nothing
                          pops out of it.
                        -->
                        <span class="gutter-mark text-intelligence-text" aria-hidden="true">
                          <Sparkles size={12} />
                        </span>
                        {piece.output}
                      </button>
                    {:else}
                      <button
                        type="button"
                        class="block-run"
                        class:is-selected={selected === piece.key}
                        onclick={() => inspect("document-editor.table", "table", piece.key)}
                      >
                        <!--
                          Content, not calculation: a document table has no
                          addresses and no formulas. Its widths are proportional
                          so it survives a change of paper.
                        -->
                        <span class="table-shape border-border-subtle">
                          {#each Array.from({ length: piece.rows }) as _, rowIndex (rowIndex)}
                            <span class="table-row">
                              {#each piece.widths as width, columnIndex (columnIndex)}
                                <span
                                  class="table-cell border-border-subtle"
                                  class:bg-surface-elevated={piece.headerRow && rowIndex === 0}
                                  style="width: {width}"
                                ></span>
                              {/each}
                            </span>
                          {/each}
                        </span>
                      </button>
                    {/if}
                  {/each}
                </div>

                {#if page.number > 1 || footer.showOnFirst}
                  <button
                    type="button"
                    aria-label="Footer"
                    class="band band-footer text-caption text-ink-muted hover:bg-surface-panel-hover"
                    onclick={() => view.inspect("document-editor.footer")}
                  >
                    <span class="truncate">{footer.content.split("{page}")[0].trim()}</span>
                    {#if footer.content.includes("{page}")}
                      <span class="tabular-nums">{folio(page.number)}</span>
                    {/if}
                  </button>
                {/if}
              </article>

              <span class="text-caption text-ink-muted tabular-nums">
                Page {page.number}{page.continues ? ` · continues ${page.continues}` : ""}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <div class="under bg-surface-panel border-border-subtle flex flex-col gap-1 border-t px-4 py-2">
        <ScreenNote tone="gap" meta="Pinch to zoom · {Math.round(zoom * 100)}%">
          ProseMirror is not installed. The view, the schema derived from the body model, undo
          history, IME state and pending operations are its and the tab runtime's, and none of
          them is here — nothing on these pages types.
        </ScreenNote>
        <ScreenNote meta="{record.pages} pages · {record.words} words · {record.saved}">
          What is drawn is what Icarus adds: pagination onto a framework that has no page, all
          four gutters as a dashed guide, one canonical header and footer projected onto every
          sheet, an inline formula set as prose, and a generated block marked in the gutter.
          There is no toolbar, and there will not be one — every property of the thing you select
          is in the inspector.
        </ScreenNote>
      </div>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification: one `1fr` track, one `editor` band.
   * There is nothing to fall back to at a narrow width — a single column is
   * already what a fallback would produce — so the sheet shrinks with the
   * pasteboard instead, and the pasteboard keeps its room on all four sides.
   */
  .board {
    display: grid;
    flex: 1;
    min-height: calc(var(--token-spacing-unit) * 120);
    grid-template-columns: 1fr;
    grid-template-areas: "editor";
  }

  .area-editor {
    grid-area: editor;
    display: flex;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
  }

  .canvas {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  /* Room on all four sides, so the document floats rather than butting the zone. */
  .pasteboard {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 6);
    padding: calc(var(--token-spacing-unit) * 8);
    transform: scale(var(--zoom));
    transform-origin: top center;
  }

  .sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  /*
   * A page is always its full height, whatever falls on it. A page that shrank
   * to its content would be a scrolling flow wearing a paper costume, and page 4
   * — which only continues a heading — is exactly where that would show.
   */
  .page {
    position: relative;
    width: calc(var(--token-spacing-unit) * 168);
    max-width: 100%;
    overflow: hidden;
    box-shadow: var(--token-shadow-raised);
  }

  .guide {
    position: absolute;
    top: var(--m-top);
    right: var(--m-outside);
    bottom: var(--m-bottom);
    left: var(--m-inside);
    border-width: 1px;
    border-style: dashed;
    pointer-events: none;
  }

  .band {
    position: absolute;
    right: var(--m-outside);
    left: var(--m-inside);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1);
    text-align: start;
  }

  .band-header {
    top: var(--h-top);
  }

  .band-footer {
    bottom: var(--f-bottom);
  }

  .flow {
    position: absolute;
    top: var(--m-top);
    right: var(--m-outside);
    bottom: var(--m-bottom);
    left: var(--m-inside);
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow: hidden;
  }

  /*
   * Bled one unit into the gutter on each side, so the hover fill and the
   * generated block's gutter mark sit outside the text column rather than
   * shifting the measure the moment either appears.
   */
  .block-run {
    position: relative;
    display: block;
    padding: calc(var(--token-spacing-unit) * 1);
    margin-inline: calc(var(--token-spacing-unit) * -1);
    text-align: start;
    text-wrap: pretty;
  }

  .block-run:hover {
    background: var(--token-surface-panel-hover);
  }

  .block-run.is-selected {
    background: var(--token-color-active-surface);
  }

  /* Out in the margin, where a mark about a block belongs rather than around it. */
  .gutter-mark {
    position: absolute;
    right: 100%;
    top: calc(var(--token-spacing-unit) * 1);
    margin-right: calc(var(--token-spacing-unit) * 1);
  }

  .break {
    display: flex;
    align-items: center;
    justify-content: center;
    border-top-width: 1px;
    border-top-style: dashed;
    padding-top: calc(var(--token-spacing-unit) * 1);
  }

  .table-shape {
    display: flex;
    flex-direction: column;
    border-width: 1px;
    border-style: solid;
  }

  .table-row {
    display: flex;
  }

  .table-cell {
    height: calc(var(--token-spacing-unit) * 5);
    border-bottom-width: 1px;
    border-inline-end-width: 1px;
    border-style: solid;
  }

  .table-row:last-child .table-cell {
    border-bottom-width: 0;
  }

  .table-cell:last-child {
    border-inline-end-width: 0;
  }

  .under {
    flex-shrink: 0;
  }
</style>
