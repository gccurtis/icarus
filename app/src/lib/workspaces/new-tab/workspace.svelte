<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import File from "@lucide/svelte/icons/file";
  import FileText from "@lucide/svelte/icons/file-text";
  import Layers from "@lucide/svelte/icons/layers";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import MessageCircleQuestionMark from "@lucide/svelte/icons/message-circle-question-mark";
  import Plug from "@lucide/svelte/icons/plug";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Search from "@lucide/svelte/icons/search";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    ScreenCard,
    ScreenEmpty,
    ScreenGroup,
    ScreenNote,
    ScreenShelf,
    ScreenShelfItem,
    ScreenSurface,
    ScreenThumb
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import * as InputGroup from "$lib/simple-components/input-group";
  import type { ResourceKind } from "$mock-capabilities/cast";
  import {
    editorKinds,
    kindLabel,
    recents,
    templates,
    type EditorKind,
    type LibraryTemplate
  } from "$mock-capabilities/library";
  import { resources } from "$mock-capabilities/project";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * New Tab — the only state this screen has.
   *
   * `docs/screen-panel-views/screens/new-tab/workspace.md` is the specification.
   * A funnel, top to bottom, answering one question: which editor do you need?
   * Find the thing you meant, or make one of three, or start from something that
   * already exists.
   *
   * **The tracks are the specification's table exactly.** One column, and six
   * bands of which Recent and Templates take two each — twice the weight of the
   * search and the pills, because two shelves of cards are what the reader
   * actually spends time in. The bands stay content-sized rather than
   * proportional: the surface scrolls, and a shelf stretched to fill a tall plane
   * is a shelf with a stripe of empty well under its cards.
   *
   * **Results drop under the field rather than replacing the bands below.** The
   * specification leaves that open; replacing them is a mode change inside a tab
   * whose whole job is one question, and a mode change nobody asked for is worse
   * than a list that pushes the shelves down.
   *
   * **Nothing here makes anything.** A pill only changes the inspector — the
   * Create button lives in that lens — which is why the three are ordinary
   * controls and not the screen's one interactive action.
   */
  const kinds = $derived(editorKinds().current);
  const recent = $derived(recents().current);
  const everything = $derived(resources().current);
  const all = $derived(templates().current);

  /** What the pill, the card or the row last handed the inspector. */
  let chosen = $state<string | undefined>(undefined);

  let query = $state("");
  const needle = $derived(query.trim().toLowerCase());
  const results = $derived(
    needle === "" ? [] : everything.filter((row) => row.name.toLowerCase().includes(needle))
  );

  const LENS: Record<EditorKind["name"], string> = {
    Document: "library.new-document",
    "Slide deck": "library.new-deck",
    Spreadsheet: "library.new-spreadsheet"
  };

  const EDITOR_ICON: Record<EditorKind["name"], typeof FileText> = {
    Document: FileText,
    "Slide deck": Presentation,
    Spreadsheet: TableIcon
  };

  /** The same icon a kind wears in the Recent panel, so one thing looks like itself. */
  const KIND_ICON: Record<ResourceKind, typeof FileText> = {
    document: FileText,
    slides: Presentation,
    spreadsheet: TableIcon,
    research: MessageCircleQuestionMark,
    analysis: ChartColumn,
    file: File,
    finding: Lightbulb,
    connector: Plug,
    context: Layers,
    template: LayoutTemplate
  };

  /** A thumbnail stands for the shape of the thing, so the ratio has to be its own. */
  const KIND_RATIO: Record<ResourceKind, string> = {
    document: "4 / 3",
    slides: "16 / 9",
    spreadsheet: "1 / 1",
    research: "4 / 3",
    analysis: "4 / 3",
    file: "4 / 3",
    finding: "4 / 3",
    connector: "4 / 3",
    context: "4 / 3",
    template: "4 / 3"
  };

  const MAKES_RATIO: Record<LibraryTemplate["makes"], string> = {
    Document: "4 / 3",
    "Slide deck": "16 / 9",
    Slide: "16 / 9",
    Spreadsheet: "1 / 1"
  };

  const MAKES_ICON: Record<LibraryTemplate["makes"], typeof FileText> = {
    Document: FileText,
    "Slide deck": Presentation,
    Slide: Presentation,
    Spreadsheet: TableIcon
  };

  /**
   * Slide templates are left out. One makes a single slide, which is not an
   * editor this tab can open, so it would be a card that cannot answer the only
   * question the screen asks.
   */
  const startable = $derived(all.filter((row) => row.makes !== "Slide"));

  /** What decides whether a template can be taken, on the card rather than behind it. */
  const asks = (row: LibraryTemplate) =>
    row.variables === 0
      ? row.makes
      : `${row.makes} · ${row.variables} ${row.variables === 1 ? "variable" : "variables"}`;

  const blocked = $derived(startable.filter((row) => row.variables > 0).length);

  const choose = (kind: EditorKind) => {
    chosen = kind.id;
    mockWorkbench.inspect(LENS[kind.name], { kind: "editor", id: kind.id });
  };

  const open = (id: string) => {
    chosen = id;
    mockWorkbench.inspect("library.recent-item", { kind: "resource", id });
  };

  const start = (id: string) => {
    chosen = id;
    mockWorkbench.inspect("library.start-from-template", { kind: "template", id });
  };
</script>

<ScreenSurface wide>
  <div class="board">
    <!--
      First, because "open the thing I was working on" is a commoner errand than
      "make a new one". One field over every kind in the project, capped at a
      measure a person can read across in one movement.

      `InputGroup` rather than `ScreenFilters`: that word is the row above a table
      — a field pinned at 300px, an order and a matched-of-total — and this is a
      launcher's one question, not a way of narrowing a list that is already here.
    -->
    <div class="area-search flex flex-col gap-2">
      <InputGroup.Root class="h-10">
        <InputGroup.Addon class="text-ink-muted">
          <Search aria-hidden="true" />
        </InputGroup.Addon>
        <InputGroup.Input
          type="search"
          bind:value={query}
          placeholder="Search {mockWorkbench.project.name}"
          aria-label="Search this project"
          class="text-body [&::-webkit-search-cancel-button]:hidden"
        />
      </InputGroup.Root>

      <!--
        Results drop under the field. Replacing the bands below would be a mode
        change inside a tab whose whole job is one question, and the shelves being
        pushed down is the cheaper of the two costs.
      -->
      {#if needle !== "" && results.length === 0}
        <ScreenEmpty kind="no-matches" title="Nothing in the project matches" onclear={() => (query = "")}>
          The search reaches every kind — documents, decks, grids, threads, findings and connector
          files alike.
        </ScreenEmpty>
      {:else if needle !== ""}
        <div class="border-border-subtle rounded-panel flex flex-col overflow-hidden border">
          {#each results as row (row.id)}
            {@const Icon = KIND_ICON[row.kind]}
            <button
              type="button"
              class="border-border-subtle hover:bg-surface-panel-hover flex items-center gap-2 border-b px-3 py-2 text-start last:border-b-0"
              class:bg-active-surface={chosen === row.id}
              onclick={() => open(row.id)}
            >
              <span class="text-ink-muted flex shrink-0"><Icon size={14} aria-hidden="true" /></span>
              <span class="text-body-sm text-ink-primary min-w-0 flex-1 truncate">{row.name}</span>
              <span class="text-caption text-ink-muted shrink-0">{kindLabel(row.kind)}</span>
              <span class="text-caption text-ink-muted shrink-0 tabular-nums">{row.updated}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!--
      Three pills and nothing else. Research, Analysis, Context, Templates,
      Personas and Automations are permanent tabs; offering to create one would
      imply they can be absent.
    -->
    <div class="area-editors flex flex-wrap items-center justify-center gap-2">
      {#each kinds as kind (kind.id)}
        {@const Icon = EDITOR_ICON[kind.name]}
        <Button
          variant={chosen === kind.id ? "default" : "outline"}
          size="lg"
          title={kind.detail}
          onclick={() => choose(kind)}
          class="rounded-control text-body-sm px-4"
        >
          <Icon aria-hidden="true" />
          {kind.name}
        </Button>
      {/each}
    </div>

    <!--
      A shelf rather than a grid: a grid of twelve cards pushes the search field
      off the top of the screen, and this is a row you browse rather than search.
      Every row says which of the two lists put it here — what you opened, and
      what changed — because a document you have never opened can appear in it.
    -->
    <div class="area-recent">
      <ScreenGroup label="Recent" count={String(recent.length)}>
        <ScreenShelf>
          {#each recent as row (row.id)}
            {@const Icon = KIND_ICON[row.kind]}
            <ScreenShelfItem>
              <ScreenCard
                title={row.name}
                sub="{kindLabel(row.kind)} · {row.age}"
                icon={Icon}
                selected={chosen === row.id}
                onselect={() => open(row.id)}
              >
                {#snippet thumb()}
                  <ScreenThumb ratio={KIND_RATIO[row.kind]} lines={4} />
                {/snippet}
                <span class="text-caption text-ink-muted truncate">
                  {row.why === "You opened it" ? row.why : `${row.why} — ${row.updatedBy}`}
                </span>
              </ScreenCard>
            </ScreenShelfItem>
          {/each}
        </ScreenShelf>
      </ScreenGroup>
    </div>

    <!--
      The same shelf, for starting from something. The variable count is on the
      card because it is what decides whether the template can be taken at all.
      The thumbnail's tinted bars are the openings the body leaves.
    -->
    <div class="area-templates">
      <ScreenGroup label="Templates" count="{startable.length} of {all.length}">
        <ScreenShelf>
          {#each startable as row (row.id)}
            {@const Icon = MAKES_ICON[row.makes]}
            <ScreenShelfItem>
              <ScreenCard
                title={row.name}
                sub={asks(row)}
                icon={Icon}
                selected={chosen === row.id}
                onselect={() => start(row.id)}
              >
                {#snippet thumb()}
                  <ScreenThumb
                    ratio={MAKES_RATIO[row.makes]}
                    lines={5}
                    variables={Math.min(row.variables, 5)}
                  />
                {/snippet}
                <span class="text-caption text-ink-muted truncate">
                  {row.scope === "Project" ? "This project" : "Everywhere"} · {row.updated}
                </span>
              </ScreenCard>
            </ScreenShelfItem>
          {/each}
        </ScreenShelf>

        <!--
          The shelf offers things that cannot be taken, and says so rather than
          letting a reader discover it at the Create button.
        -->
        <ScreenNote tone="gap" meta="{blocked} of {startable.length} ask for one">
          No body entity can carry a variable key yet, so a supplied value has nowhere to go and
          every template with variables is unusable until one can.
        </ScreenNote>
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. Its header
   * row is one track — `1fr` — so the funnel is a single column at every width,
   * and Recent and Templates each claim two of the six bands.
   *
   * There is no narrow fallback, because there is nothing for one to change: the
   * board is already the single column a fallback would produce, in the order a
   * fallback would put it — search, then the three editors, then what exists.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 6);
    grid-template-columns: 1fr;
    grid-template-areas:
      "search"
      "editors"
      "recent"
      "recent"
      "templates"
      "templates";
    align-content: start;
  }

  /* Centred and capped at about 640px: the field is wide, not the plane's width. */
  .area-search {
    grid-area: search;
    justify-self: center;
    width: 100%;
    max-width: calc(var(--token-spacing-unit) * 160);
  }

  .area-editors {
    grid-area: editors;
    justify-self: center;
  }

  .area-recent {
    grid-area: recent;
    min-width: 0;
  }

  .area-templates {
    grid-area: templates;
    min-width: 0;
  }
</style>
