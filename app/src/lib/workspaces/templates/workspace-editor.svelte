<script lang="ts">
  import { PanelChip } from "$lib/unique-components/panel";
  import { ScreenBar, ScreenNote, ScreenSurface } from "$lib/unique-components/screen";
  import {
    outlineIn,
    pageSetupFor,
    previewOf,
    template,
    variablesIn,
    type PreviewLine,
    type TemplateVariable,
    type VariableType
  } from "$mock-capabilities/library";
  import { project } from "$mock-capabilities/project";

  /**
   * Templates — one template: the body, authored on the surface it will become.
   *
   * `docs/screen-panel-views/screens/templates/workspace-editor.md` is the
   * specification. Authoring a template is authoring the thing it makes, so the
   * library is replaced by the matching surface — and the one thing this state
   * adds is the strip across the top saying which template you are in and how to
   * get out. Without it the screen is indistinguishable from editing the real
   * document.
   *
   * **The tracks are `1fr 816px 1fr`** — the page is a fixed measure and the
   * pasteboard is whatever is left either side of it. That is what makes the
   * template read as an object being made rather than as a document being
   * written in. 816px is written off the spacing unit because every dimension
   * here is, and 204 units is exactly it.
   *
   * **The pasteboard is placed by line rather than named in the areas.** A
   * surround is a frame, and a frame is not a rectangle: `grid-template-areas`
   * can only name rectangles, so the pasteboard is one rectangle under the whole
   * page stack and the page sits on top of it. The rows carry no gap, so the
   * header, the body and the footer are one continuous sheet.
   *
   * **The body is the gate on this screen.** Nothing in a body records which
   * variable it stands for, so the three kinds of opening are drawn from the
   * preview door and the variable list beside it — which can say how a text, a
   * table and a generated variable each read, and cannot say where any of them
   * actually sits. The note at the top of the page says so rather than letting
   * the surface imply otherwise.
   *
   * Header and footer furniture is not on the model either. The running head is
   * the project's name and the foot is the outline's page count, so that the two
   * regions are drawn from doors rather than from invented sample text.
   */
  let {
    templateId = "tp-filing",
    onback = () => {}
  }: {
    templateId?: string;
    /** Back to the library. Absent only where this state was not entered from one. */
    onback?: () => void;
  } = $props();

  const it = $derived(template(templateId).current);
  const lines = $derived(previewOf(templateId).current);
  const variables = $derived(variablesIn(templateId).current);
  const setup = $derived(pageSetupFor(templateId).current);
  const outline = $derived(outlineIn(templateId).current);
  const projectName = $derived(project().current.name);

  const pages = $derived(outline.reduce((most: number, entry) => Math.max(most, entry.page), 1));

  /** Generated variables never sit in running prose: they are blocks in their own right. */
  const generated = $derived(
    variables.filter((variable: TemplateVariable) => variable.type === "Generated")
  );

  type Piece =
    | { readonly kind: "text"; readonly text: string }
    | { readonly kind: "variable"; readonly key: string; readonly type?: VariableType };

  const typeOf = (key: string): VariableType | undefined =>
    variables.find((variable: TemplateVariable) => variable.key === key)?.type;

  /** The body door writes an opening as `{key}`. This is what turns one back into an atom. */
  const piecesOf = (text: string): Piece[] => {
    const out: Piece[] = [];
    const pattern = /\{([^}]+)\}/g;
    let last = 0;
    let found = pattern.exec(text);
    while (found !== null) {
      if (found.index > last) out.push({ kind: "text", text: text.slice(last, found.index) });
      out.push({ kind: "variable", key: found[1], type: typeOf(found[1]) });
      last = found.index + found[0].length;
      found = pattern.exec(text);
    }
    if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
    return out;
  };

  /** A line that is nothing but a table variable is a placed block, not a sentence. */
  const placedTable = (line: PreviewLine): string | undefined => {
    const parts = piecesOf(line.text);
    const only = parts.length === 1 ? parts[0] : undefined;
    return only?.kind === "variable" && only.type === "Table" ? only.key : undefined;
  };
</script>

<!-- Running prose, with each opening rendered as the atom it will be replaced by. -->
{#snippet run(text: string)}
  {#each piecesOf(text) as piece, index (index)}
    {#if piece.kind === "text"}{piece.text}{:else}<span class="atom font-mono">{piece.key}</span
      >{/if}
  {/each}
{/snippet}

<!-- The page's content, drawn the same way whatever surface it is sitting on. -->
{#snippet content()}
  <!--
    On the page rather than beside it: this is a statement about the content
    that is missing, and there is nowhere beside the page that is not the
    pasteboard.
  -->
  <ScreenNote tone="gap">
    The openings are drawn from the variable list, not from the body. Nothing in a body records
    which variable it stands for, so none of the three can be placed, highlighted or jumped to —
    the surface can be drawn and nothing can be put in it.
  </ScreenNote>

  {#each lines as line (line.id)}
    {@const table = placedTable(line)}
    {#if table}
      <!-- A table variable is a block, dashed and labelled with its key. -->
      <div class="border-border-strong rounded-control flex flex-col gap-1 border border-dashed p-4">
        <span class="text-caption text-ink-muted">
          table variable · <span class="font-mono">{table}</span>
        </span>
        <span class="text-caption text-ink-muted">The supplied table, set as ordinary rows.</span>
      </div>
    {:else if line.style === "heading"}
      <h2 class="text-h3 text-ink-primary m-0 font-semibold">{@render run(line.text)}</h2>
    {:else}
      <p class="text-body text-ink-primary m-0">{@render run(line.text)}</p>
    {/if}
  {/each}

  {#each generated as variable (variable.id)}
    <!--
      Placed last because placement is exactly what the model cannot say. A
      generated variable is never a question at instantiation, which is why it
      is an opening rather than an insert.
    -->
    <div
      class="border-intelligence-border bg-intelligence-surface rounded-control flex flex-col gap-1 border p-4"
    >
      <span class="text-caption text-intelligence-text">
        Generated · <span class="font-mono">{variable.key}</span>
      </span>
      <span class="text-body-sm text-ink-secondary">
        {variable.becomes ?? "A prompt block in the result"}, which runs on first open.
      </span>
    </div>
  {/each}
{/snippet}

<ScreenSurface wide class="gap-0 p-0">
  <div class="board">
    <!--
      The one thing this state adds: which template, and the way back. The tab
      is still a Templates screen and has to say so.
    -->
    <div class="area-header">
      <ScreenBar title={it.name} {onback}>
        {#snippet meta()}
          <PanelChip>Template</PanelChip>
          <span class="text-caption text-ink-muted">
            Saved · revision <span class="tabular-nums">{it.revision}</span>
          </span>
        {/snippet}
      </ScreenBar>
    </div>

    <!--
      The surround. It holds nothing: what it does is give the page an edge, so
      the template reads as an object rather than as the whole tab.
    -->
    <div class="area-pasteboard" aria-hidden="true"></div>

    {#if it.makes === "Document"}
      <!--
        Furniture is carried into every copy made from this template. The
        regions exist only for a document: a slide has no running head.
      -->
      <div class="area-page-header">
        <span class="text-caption text-ink-muted">{projectName}</span>
        <span class="text-caption text-ink-muted tabular-nums">{setup.paper} · {setup.orientation}</span>
      </div>

      <div class="area-body">
        {@render content()}
      </div>

      <div class="area-page-footer">
        <span class="text-caption text-ink-muted">{it.name}</span>
        <span class="text-caption text-ink-muted tabular-nums">Page 1 of {pages}</span>
      </div>
    {:else if it.makes === "Spreadsheet"}
      <!-- A spreadsheet template puts a grid in the same place; the surround does not change. -->
      <div class="area-body sheet">
        {@render content()}
      </div>
    {:else}
      <!-- A deck or slide template puts a canvas in the same place, at 16:9. -->
      <div class="area-body">
        <div class="canvas">
          {@render content()}
        </div>
      </div>
    {/if}
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table. The middle track is the page's own
   * measure and the two outer ones are the pasteboard; the rows give the body
   * three bands to the one each the furniture gets, which is the proportion a
   * page actually has.
   */
  .board {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
    gap: 0;
    grid-template-columns: 1fr calc(var(--token-spacing-unit) * 204) 1fr;
    grid-template-rows:
      auto
      minmax(calc(var(--token-spacing-unit) * 6), 1fr)
      auto
      minmax(0, 1fr)
      minmax(0, 1fr)
      minmax(0, 1fr)
      auto;
    grid-template-areas:
      "header header      header"
      ".      .           ."
      ".      page-header ."
      ".      body        ."
      ".      body        ."
      ".      body        ."
      ".      page-footer .";
  }

  .area-header {
    grid-area: header;
  }

  /*
    Placed by line rather than named: a surround is a frame, and a frame is not
    a rectangle. This one rectangle covers everything under the strip, and the
    page stack is painted over it.
  */
  .area-pasteboard {
    grid-column: 1 / -1;
    grid-row: 2 / -1;
    background: var(--token-surface-canvas);
  }

  .area-page-header,
  .area-page-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 4);
    background: var(--token-surface-work);
    padding: calc(var(--token-spacing-unit) * 4) calc(var(--token-spacing-unit) * 24);
  }

  .area-body {
    grid-area: body;
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
    overflow-y: auto;
    background: var(--token-surface-work);
    /* The page setup's one-inch gutter, at the 96px an inch is on a screen. */
    padding: calc(var(--token-spacing-unit) * 6) calc(var(--token-spacing-unit) * 24);
  }

  .area-page-header {
    grid-area: page-header;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .area-page-footer {
    grid-area: page-footer;
    border-top: 1px solid var(--token-border-subtle);
  }

  /* A grid template's surface: cells rather than a measure, so the gutter goes. */
  .sheet {
    padding: calc(var(--token-spacing-unit) * 4);
  }

  /* A deck or slide template's surface, at the aspect its slides will be. */
  .canvas {
    display: flex;
    aspect-ratio: 16 / 9;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow-y: auto;
    border: 1px solid var(--token-border-subtle);
    background: var(--token-surface-work);
    padding: calc(var(--token-spacing-unit) * 6);
  }

  /**
   * A text variable is an atom in running prose: it reads as one thing that
   * will be replaced, rather than as a word that happens to be styled.
   */
  .atom {
    border: 1px solid var(--token-color-intelligence-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
    padding: 0 calc(var(--token-spacing-unit) * 1);
  }

  /*
    Below the width where a fixed measure and a surround both fit, the surround
    is what goes: the page takes the tab, and the strip that says which template
    this is stays first.
  */
  @media (max-width: 60rem) {
    .board {
      flex: 0 0 auto;
      grid-template-columns: 1fr;
      grid-template-rows: none;
      grid-template-areas:
        "header"
        "page-header"
        "body"
        "page-footer";
    }

    .area-pasteboard {
      grid-column: 1 / -1;
      grid-row: 2 / -1;
    }

    .area-body {
      overflow-y: visible;
      padding: calc(var(--token-spacing-unit) * 6) calc(var(--token-spacing-unit) * 6);
    }

    .area-page-header,
    .area-page-footer {
      padding: calc(var(--token-spacing-unit) * 4) calc(var(--token-spacing-unit) * 6);
    }
  }
</style>
