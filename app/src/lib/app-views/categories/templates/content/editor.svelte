<script lang="ts">
  import { PanelChip } from "$authored-components/panel";
  import {
    ScreenBar,
    ScreenCanvas,
    ScreenGrid,
    ScreenGridCell,
    ScreenNote,
    ScreenPage,
    ScreenSlide,
    ScreenSurface
  } from "$authored-components/screen";
  import { Input } from "$vendored-components/input";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  type TemplateTarget = "Document" | "Slide deck" | "Slide" | "Spreadsheet";

  type TemplateScope = "Project" | "Personal" | "Shared";

  type VariableType = "Text" | "Image" | "Table" | "Generated";

  type LibraryTemplate = {
    readonly id: string;
    readonly name: string;
    readonly makes: TemplateTarget;
    readonly scope: TemplateScope;
    readonly variables: number;
    readonly updated: string;
    readonly lastUsed?: string;
    readonly createdBy: string;
    readonly revision: number;
  };

  type TemplateVariable = {
    readonly id: string;
    readonly templateId: string;
    readonly key: string;
    readonly label: string;
    readonly type: VariableType;
    readonly required: boolean;
    readonly becomes?: string;
    readonly defaultValue?: string;
  };

  type PreviewLine = {
    readonly id: string;
    readonly text: string;
    readonly style: "heading" | "body";
    readonly variable: boolean;
  };

  type OutlineHeading = {
    readonly id: string;
    readonly text: string;
    readonly level: 1 | 2;
    readonly page: number;
  };

  type PageSetup = {
    readonly paper: "Letter" | "A4";
    readonly orientation: "Portrait" | "Landscape";
    readonly gutters: string;
  };

  type Read<T> = {
    readonly current: T;
    readonly error: undefined;
    readonly loading: false;
    refresh: () => Promise<void>;
  };

  const read = <T,>(current: T): Read<T> => ({
    current,
    error: undefined,
    loading: false,
    refresh: async () => {}
  });

  const TEMPLATES: readonly LibraryTemplate[] = [
    {
      id: "tp-filing",
      name: "Regulatory filing shell",
      makes: "Document",
      scope: "Project",
      variables: 4,
      updated: "2 weeks ago",
      lastUsed: "3 days ago",
      createdBy: "Mira Jain",
      revision: 6
    },
    {
      id: "tp-storm",
      name: "Storm brief",
      makes: "Document",
      scope: "Project",
      variables: 3,
      updated: "5 weeks ago",
      createdBy: "Ana Reyes",
      revision: 2
    },
    {
      id: "tp-board",
      name: "Board update",
      makes: "Slide deck",
      scope: "Project",
      variables: 2,
      updated: "3 weeks ago",
      lastUsed: "1 week ago",
      createdBy: "Tomas Kaur",
      revision: 4
    },
    {
      id: "tp-ops",
      name: "Weekly ops deck",
      makes: "Slide deck",
      scope: "Project",
      variables: 0,
      updated: "8 weeks ago",
      lastUsed: "Yesterday",
      createdBy: "Tomas Kaur",
      revision: 11
    },
    {
      id: "tp-title",
      name: "Title slide",
      makes: "Slide",
      scope: "Project",
      variables: 1,
      updated: "6 weeks ago",
      createdBy: "Tomas Kaur",
      revision: 1
    },
    {
      id: "tp-cost",
      name: "Cost model skeleton",
      makes: "Spreadsheet",
      scope: "Project",
      variables: 0,
      updated: "9 weeks ago",
      lastUsed: "Today",
      createdBy: "Mira Jain",
      revision: 3
    },
    {
      id: "tp-incident",
      name: "Incident review",
      makes: "Document",
      scope: "Shared",
      variables: 0,
      updated: "6 months ago",
      createdBy: "Devi Okonkwo",
      revision: 8
    },
    {
      id: "tp-divider",
      name: "Section divider",
      makes: "Slide",
      scope: "Personal",
      variables: 1,
      updated: "7 months ago",
      createdBy: "Devi Okonkwo",
      revision: 2
    }
  ];

  const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
    {
      id: "tv-docket",
      templateId: "tp-filing",
      key: "filingDocket",
      label: "Docket number",
      type: "Text",
      required: true
    },
    {
      id: "tv-party",
      templateId: "tp-filing",
      key: "filingParty",
      label: "Filing party",
      type: "Text",
      required: true,
      defaultValue: "Northwind Power"
    },
    {
      id: "tv-outages",
      templateId: "tp-filing",
      key: "outageTable",
      label: "Outage record",
      type: "Table",
      required: true
    },
    {
      id: "tv-exec",
      templateId: "tp-filing",
      key: "execSummary",
      label: "Executive summary",
      type: "Generated",
      required: false,
      becomes: "A prompt block in the result"
    },
    {
      id: "tv-storm-name",
      templateId: "tp-storm",
      key: "stormName",
      label: "Storm name",
      type: "Text",
      required: true
    },
    {
      id: "tv-storm-window",
      templateId: "tp-storm",
      key: "stormWindow",
      label: "Dates affected",
      type: "Text",
      required: true
    },
    {
      id: "tv-storm-takeaways",
      templateId: "tp-storm",
      key: "keyTakeaways",
      label: "Key takeaways",
      type: "Generated",
      required: false,
      becomes: "A prompt block in the result"
    },
    {
      id: "tv-quarter",
      templateId: "tp-board",
      key: "quarter",
      label: "Quarter",
      type: "Text",
      required: true,
      defaultValue: "Q4 2026"
    },
    {
      id: "tv-chart",
      templateId: "tp-board",
      key: "headlineChart",
      label: "Headline chart",
      type: "Image",
      required: false
    },
    {
      id: "tv-deck-title",
      templateId: "tp-title",
      key: "deckTitle",
      label: "Deck title",
      type: "Text",
      required: true
    },
    {
      id: "tv-section",
      templateId: "tp-divider",
      key: "sectionName",
      label: "Section name",
      type: "Text",
      required: true
    }
  ];

  const template = (templateId: string): Read<LibraryTemplate> =>
    read(TEMPLATES.find((row: LibraryTemplate) => row.id === templateId) ?? TEMPLATES[0]);

  const variablesIn = (templateId: string): Read<readonly TemplateVariable[]> =>
    read(
      TEMPLATE_VARIABLES.filter((variable: TemplateVariable) => variable.templateId === templateId)
    );

  const previewOf = (templateId: string): Read<readonly PreviewLine[]> => {
    void templateId;
    return read([
      { id: "pl-1", text: "Filing to the Commission", style: "heading", variable: false },
      { id: "pl-2", text: "Docket {filingDocket}", style: "body", variable: true },
      {
        id: "pl-3",
        text: "{filingParty} submits this application under §16-108.",
        style: "body",
        variable: true
      },
      { id: "pl-4", text: "Outage record", style: "heading", variable: false },
      { id: "pl-5", text: "{outageTable}", style: "body", variable: true },
      { id: "pl-6", text: "Statutory basis", style: "heading", variable: false }
    ]);
  };

  const outlineIn = (templateId: string): Read<readonly OutlineHeading[]> => {
    void templateId;
    return read([
      { id: "oh-1", text: "Filing to the Commission", level: 1, page: 1 },
      { id: "oh-2", text: "Outage record", level: 1, page: 1 },
      { id: "oh-3", text: "Statutory basis", level: 1, page: 2 },
      { id: "oh-4", text: "Relief requested", level: 1, page: 3 },
      { id: "oh-5", text: "Cost recovery", level: 2, page: 3 },
      { id: "oh-6", text: "Exhibits", level: 1, page: 4 }
    ]);
  };

  const pageSetupFor = (templateId: string): Read<PageSetup> => {
    void templateId;
    return read({ paper: "Letter", orientation: "Portrait", gutters: "1 in all round" });
  };

  const project = (): Read<{ readonly name: string }> =>
    read({ name: "Northwind Grid Resilience" });

  /**
   * Templates — one template, authored on the surface it will become.
   *
   * **Which template is view state, not a prop.** The library gets here by
   * choosing one — `showContent("templates.editor", id)` — and `focus` is where that
   * choice lands, so this file reads it rather than taking a default that would
   * quietly show the wrong template the moment anything else changed.
   *
   * **The surface is the resource's, not a template editor's.** Authoring a
   * template is authoring the thing it makes, so a Document gets a page on a
   * canvas, a deck or a slide gets a stage, and a Spreadsheet gets a grid. The
   * three real editors are still mockups, so what is drawn here is those three
   * shapes filled from the preview door — which the note under the bar says out
   * loud rather than letting the surface imply otherwise.
   *
   * **The strip across the top is the whole of what this state costs.** Without
   * it the centre is indistinguishable from editing the real document, and there
   * is no way back to the library.
   */
  const focus = $derived(view.active.focus);

  /**
   * A template that does not exist yet.
   *
   * The kind picker is not built, so a blank one is a Document — the commonest
   * of the four and the only one whose empty state is a page you can type on.
   */
  const fresh = $derived(focus === undefined || focus === "new");
  const id = $derived(focus ?? "new");

  const BLANK: readonly PreviewLine[] = [
    { id: "pl-blank", text: "", style: "body", variable: false }
  ];

  const it = $derived(template(id).current);
  const lines = $derived(fresh ? BLANK : previewOf(id).current);
  const variables = $derived<readonly TemplateVariable[]>(fresh ? [] : variablesIn(id).current);
  const outline = $derived(fresh ? [] : outlineIn(id).current);
  const setup = $derived<PageSetup>(pageSetupFor(id).current);
  const projectName = $derived(project().current.name);

  const name = $derived(fresh ? "Untitled template" : it.name);
  const makes = $derived<TemplateTarget>(fresh ? "Document" : it.makes);

  const pages = $derived(outline.reduce((most: number, entry) => Math.max(most, entry.page), 1));

  /** The door states page setup as a person would; `ScreenPage` takes the setting. */
  const PAPER = { Letter: "letter", A4: "a4" } as const;
  const TURN = { Portrait: "portrait", Landscape: "landscape" } as const;

  /** Generated variables never sit in running prose: they are blocks in their own right. */
  const generated = $derived(
    variables.filter((variable: TemplateVariable) => variable.type === "Generated")
  );

  /* ---------------------------------------------------------------- saving ---- */

  /**
   * Saved / Saving…, held here and written nowhere.
   *
   * A template has no draft state: every change to one is a change to the
   * template, which is the difference between authoring a template and filling
   * one in. So the honest indicator is not a Save button but a report that the
   * writing has already happened — and this one reports about a write that does
   * not happen at all, because the doors are reads.
   */
  let saving = $state(false);
  let settle: ReturnType<typeof setTimeout> | undefined;

  const touch = () => {
    saving = true;
    clearTimeout(settle);
    settle = setTimeout(() => (saving = false), 900);
  };

  $effect(() => () => clearTimeout(settle));

  /* ----------------------------------------------------------------- body ---- */

  /**
   * What has been typed, by template and line. The door's text stands until
   * something replaces it.
   *
   * Keyed by both because the body door hands every template the same six line
   * ids: keyed by line alone, a sentence typed into one template would appear in
   * the next one opened.
   */
  let edits = $state<Record<string, string>>({});
  let editing = $state<string | undefined>(undefined);
  let draft = $state("");
  let control = $state<HTMLElement | null>(null);

  const keyOf = (line: PreviewLine): string => `${id}/${line.id}`;

  const textOf = (line: PreviewLine): string => edits[keyOf(line)] ?? line.text;

  const start = (line: PreviewLine) => {
    draft = textOf(line);
    editing = keyOf(line);
  };

  const commit = () => {
    if (editing === undefined) return;
    const key = editing;
    editing = undefined;
    if (edits[key] === draft) return;
    edits[key] = draft;
    touch();
  };

  $effect(() => {
    const field = control as HTMLInputElement | null;
    field?.focus();
    field?.select();
  });

  /**
   * Escape abandons, Enter commits, and nothing reaches the surface underneath.
   *
   * The last of those is what the grid needs: a sheet owns its arrow keys, so an
   * arrow pressed inside a field would move the cursor off the cell being typed
   * into and take the field with it.
   */
  const keys = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      editing = undefined;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  };

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
    const parts = piecesOf(textOf(line));
    const only = parts.length === 1 ? parts[0] : undefined;
    return only?.kind === "variable" && only.type === "Table" ? only.key : undefined;
  };

  /* ---------------------------------------------------------------- stage ---- */

  /**
   * The body, placed on a stage.
   *
   * A line carrying an opening is drawn dashed and a fixed line solid, which is
   * `ScreenSlide`'s own distinction read across to a template: dashed is what
   * whatever uses this will fill in, solid is what the template keeps.
   */
  const objects = $derived([
    ...lines.slice(0, 6).map((line: PreviewLine, index: number) => ({
      id: line.id,
      frame: { x: 0.08, y: 0.06 + index * 0.13, w: 0.84, h: 0.11 },
      label: textOf(line) || "Empty line",
      outline: (line.variable ? "dashed" : "solid") as "dashed" | "solid"
    })),
    ...generated.map((variable: TemplateVariable, index: number) => ({
      id: variable.id,
      frame: { x: 0.08, y: 0.06 + (lines.slice(0, 6).length + index) * 0.13, w: 0.84, h: 0.11 },
      label: `Generated · ${variable.key}`,
      outline: "dashed" as const
    }))
  ]);

  const lineFor = (objectId: string): PreviewLine | undefined =>
    lines.find((line: PreviewLine) => line.id === objectId);

  /* ---------------------------------------------------------------- sheet ---- */

  let cursor = $state("A1");

  /** Column A is the body; a sheet's cells are the nearest thing a grid has to lines. */
  const lineAt = (row: number): PreviewLine | undefined => lines[row - 1];
  const blockAt = (row: number): TemplateVariable | undefined => generated[row - 1 - lines.length];
</script>

<!-- Running prose, with each opening rendered as the atom it will be replaced by. -->
{#snippet run(text: string)}
  {#each piecesOf(text) as piece, index (index)}
    {#if piece.kind === "text"}{piece.text}{:else}<span class="atom font-mono">{piece.key}</span
      >{/if}
  {/each}
{/snippet}

<!--
  One line, read or written.

  Idle it is prose with its openings tinted; typing it is the raw `{key}` text,
  because the braces are what you actually type and an atom is not editable. The
  width is a parameter because the grid's columns are a fixed measure and a page's
  are not — a field sized to a container the sheet does not have collapses.
-->
{#snippet editable(line: PreviewLine, width: string)}
  {#if editing === keyOf(line)}
    <Input
      bind:ref={control}
      bind:value={draft}
      onblur={commit}
      onkeydown={keys}
      aria-label="Template line"
      class="text-body-sm h-5 rounded-none border-0 bg-transparent px-0 {width}"
    />
  {:else}
    <!--
      The idle line wraps rather than truncating: a page is where a long sentence
      is supposed to run on, and clipping it here meant a line typed in full came
      back as an ellipsis the moment it was committed. The two surfaces that do
      have to clip already do — a grid cell truncates its own contents and a
      slide object hides its overflow.
    -->
    <button
      type="button"
      title="Change this line"
      class="hover:bg-surface-panel-hover rounded-control -mx-1 max-w-full cursor-text px-1 text-start"
      onclick={() => start(line)}
    >
      {#if textOf(line)}
        {@render run(textOf(line))}
      {:else}
        <span class="text-ink-muted italic">Empty line</span>
      {/if}
    </button>
  {/if}
{/snippet}

<!-- A generated variable is never a question at instantiation; it is a block. -->
{#snippet block(variable: TemplateVariable)}
  <div
    class="border-intelligence-border bg-intelligence-surface rounded-control flex flex-col gap-1 border p-3"
  >
    <span class="text-caption text-intelligence-text">
      Generated · <span class="font-mono">{variable.key}</span>
    </span>
    <span class="text-caption text-ink-secondary">
      {variable.becomes ?? "A prompt block in the result"}, which runs on first open.
    </span>
  </div>
{/snippet}

<ScreenSurface wide class="gap-0 p-0">
  <!-- Which template, whether it is saved, and the way back. -->
  <ScreenBar
    title={name}
    backLabel="All templates"
    onback={() => view.showContent("templates.library")}
  >
    {#snippet meta()}
      <PanelChip>{makes}</PanelChip>
      <PanelChip tone={saving ? "attention" : "success"}>
        {saving ? "Saving…" : "Saved"}
      </PanelChip>
      {#if !fresh}
        <span class="text-caption text-ink-muted">
          revision <span class="tabular-nums">{it.revision}</span>
        </span>
      {/if}
    {/snippet}
  </ScreenBar>

  <div class="px-4 pt-3">
    <ScreenNote tone="gap">
      The document, deck and spreadsheet editors are not wired in yet, so this is the shape of the
      one this template makes, filled from the body door. Lines can be typed; nothing else on the
      surface acts, and nothing is written back.
    </ScreenNote>
  </div>

  {#if makes === "Document"}
    <ScreenCanvas label="{name} — the page this template makes">
      <ScreenPage
        paper={PAPER[setup.paper]}
        orientation={TURN[setup.orientation]}
        caption="{makes} template"
      >
        <!--
          Furniture is carried into every copy made from this template, and none
          of it is on the model — so the running head is the project's name and
          the page setup rather than invented sample text. The count is the
          outline's, so the footer cannot disagree with the body above it.
        -->
        {#snippet header()}
          <span class="text-caption text-ink-muted">{projectName}</span>
          <span class="text-caption text-ink-muted">{setup.paper} · {setup.orientation}</span>
        {/snippet}
        {#snippet footer()}
          <span class="text-caption text-ink-muted">{name}</span>
          <span class="text-caption text-ink-muted tabular-nums">Page 1 of {pages}</span>
        {/snippet}

        {#each lines as line (line.id)}
          {@const table = placedTable(line)}
          {#if table}
            <!-- A table variable is a block, dashed and labelled with its key. -->
            <div
              class="border-border-strong rounded-control flex flex-col gap-1 border border-dashed p-3"
            >
              <span class="text-caption text-ink-muted">
                table variable · <span class="font-mono">{table}</span>
              </span>
              <span class="text-caption text-ink-muted">The supplied table, set as ordinary rows.</span>
            </div>
          {:else if line.style === "heading"}
            <h2 class="text-h3 text-ink-primary m-0 font-semibold">
              {@render editable(line, "w-full")}
            </h2>
          {:else}
            <p class="text-body-sm text-ink-primary m-0">{@render editable(line, "w-full")}</p>
          {/if}
        {/each}

        {#each generated as variable (variable.id)}
          {@render block(variable)}
        {/each}
      </ScreenPage>
    </ScreenCanvas>
  {:else if makes === "Spreadsheet"}
    <ScreenCanvas label="{name} — the sheet this template makes">
      <ScreenGrid label="{name} template" columns={4} rows={10} bind:address={cursor}>
        {#snippet cell(spot)}
          {@const line = spot.column === "A" ? lineAt(spot.row) : undefined}
          {@const generatedHere = spot.column === "A" ? blockAt(spot.row) : undefined}
          <ScreenGridCell
            address={spot.address}
            state={generatedHere ? "read-only" : undefined}
            note={generatedHere ? `Generated · ${generatedHere.key}` : undefined}
          >
            {#if line}
              {@render editable(line, "w-24")}
            {:else if generatedHere}
              <span class="font-mono">{generatedHere.key}</span>
            {/if}
          </ScreenGridCell>
        {/snippet}
      </ScreenGrid>
    </ScreenCanvas>
  {:else}
    <ScreenCanvas label="{name} — the slide this template makes">
      <!--
        No `onselect`: an object on a stage nobody is editing renders as a div,
        and that is the only arm that may hold a control. Selecting an object is
        the deck editor's job, and it does not exist yet.
      -->
      <ScreenSlide ratio="16:9" {objects} caption="{makes} template">
        {#snippet object(item)}
          {@const line = lineFor(item.id)}
          {#if line}
            <span class="text-body-sm text-ink-primary min-w-0">
              {@render editable(line, "w-full")}
            </span>
          {:else}
            <span class="text-caption text-intelligence-text truncate">{item.label}</span>
          {/if}
        {/snippet}
      </ScreenSlide>
    </ScreenCanvas>
  {/if}
</ScreenSurface>

<style>
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
</style>
