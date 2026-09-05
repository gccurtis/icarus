<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as InputGroup from "$vendored-components/input-group";
  import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
  import type { ResourceKind } from "$app-views/categories/new-tab/procedures/cast";
  import {
    editorKinds,
    kindLabel,
    type EditorKind
  } from "$app-views/categories/new-tab/procedures/library";
  import { openingFor } from "$app-views/categories/new-tab/procedures/opening";
  import { createProjectResource } from "$app-views/categories/new-tab/procedures/resources";
  import {
    relativeTime,
    templateLibrary,
    templatesIn,
    type NewTabTemplate
  } from "$app-views/categories/new-tab/procedures/templates.svelte";
  import { workspaceState, type Category } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  /**
   * New Tab — the only state this category has.
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
   * **Only represented ids an editor consumes are launched.** Documents and
   * decks open their ordinary editors; unsupported kinds stay searchable and
   * explain the missing hand-off instead of opening a convincing mock. A
   * Template card opens the real library focused on that row, where inspection
   * and Use share the capability-backed boundary.
   */
  const kinds = $derived(editorKinds().current);
  const representedTemplates = templateLibrary();
  const representedResources = readProjectResourceIndex();
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const everything = $derived(
    (representedResources.ready ? representedResources.current.resources : []).map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      updated: relativeTime(row.updatedAt, now),
      updatedBy: row.updatedByName
    }))
  );
  const recent = $derived(
    (representedResources.ready ? representedResources.current.resources : [])
      .filter((row) => row.kind === "document" || row.kind === "slides")
      .toSorted((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        age: relativeTime(row.updatedAt, now),
        updatedBy: row.updatedByName
      }))
  );
  const all = $derived(
    templatesIn(representedTemplates.ready ? representedTemplates.current : undefined, now)
  );
  let query = $state("");
  const needle = $derived(query.trim().toLowerCase());
  const searchable = $derived([
    ...everything,
    ...all.map((row) => ({
      id: row.id,
      name: row.name,
      kind: "template" as const,
      updated: row.updated,
      updatedBy: row.createdBy
    }))
  ]);
  const results = $derived(
    needle === "" ? [] : searchable.filter((row) => row.name.toLowerCase().includes(needle))
  );

  /** Which editor a pill opens, and what the strip calls the blank thing there. */
  const BLANK = {
    Document: { category: "document-editor", target: "document" },
    "Slide deck": { category: "slide-deck-editor", target: "slides" },
    Spreadsheet: { category: "spreadsheet-editor" }
  } as const satisfies Record<
    EditorKind["name"],
    { category: Category; target?: "document" | "slides" }
  >;

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

  const MAKES_RATIO: Record<NewTabTemplate["makes"], string> = {
    Document: "4 / 3",
    "Slide deck": "16 / 9",
    Spreadsheet: "1 / 1"
  };

  const MAKES_ICON: Record<NewTabTemplate["makes"], typeof FileText> = {
    Document: FileText,
    "Slide deck": Presentation,
    Spreadsheet: TableIcon
  };

  /** The represented variable count is metadata; answers/defaults stay at the capability boundary. */
  const asks = (row: NewTabTemplate) =>
    row.variableCount === 0
      ? row.makes
      : `${row.makes} · ${row.variableCount} ${row.variableCount === 1 ? "variable" : "variables"}`;

  const withVariables = $derived(all.filter((row) => row.variableCount > 0).length);
  const SPREADSHEET_CREATION =
    "Spreadsheet creation is paused until its editor consumes represented resource ids.";
  const retryData = () => {
    void representedResources.refresh();
    void representedTemplates.refresh();
  };

  let creating = $state<EditorKind["name"]>();
  let creationError = $state<string>();
  let launchError = $state<string>();

  const create = async (kind: EditorKind) => {
    if (creating !== undefined) return;
    const blank = BLANK[kind.name];
    if (!("target" in blank)) {
      creationError = SPREADSHEET_CREATION;
      return;
    }
    const originTabId = view.activeId;
    creating = kind.name;
    creationError = undefined;
    try {
      const { resourceId } = await createProjectResource(view, { target: blank.target });
      if (live && view.activeId === originTabId) {
        view.open({ category: blank.category, resourceId });
      }
    } catch (error) {
      creationError = error instanceof Error ? error.message : String(error);
    } finally {
      creating = undefined;
    }
  };

  /**
   * A search hit and a recent card are two rows of different shapes over the
   * same three facts, so one function launches both rather than each holding
   * its own idea of what a document opens in.
   */
  type Entry = { readonly id: string; readonly name: string; readonly kind: ResourceKind };

  /**
   * What an entry opens. Where each kind goes is
   * [`openingFor`](../../mock-capabilities/opening.ts)'s to answer, because this
   * launcher is not the only surface that asks.
   *
   * Nothing means no category holds that kind, and saying so out loud is honest
   * where a click that appears to do nothing is not.
   */
  const launch = (row: Entry) => {
    const target = openingFor(row.kind, row.id);
    if (target) {
      launchError = undefined;
      view.open(target);
      return;
    }
    launchError = `${kindLabel(row.kind)} resources become launchable when their surface consumes represented resource ids.`;
  };

  const start = (id: string) => {
    view.open({ category: "templates", content: "templates.library", focus: id });
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
          placeholder="Search this project"
          aria-label="Search this project"
          class="text-body [&::-webkit-search-cancel-button]:hidden"
        />
      </InputGroup.Root>

      {#if representedResources.error || representedTemplates.error}
        <div class="remote-state">
          <ScreenNote tone="gap">
            Some represented project data could not be loaded. Search will not pretend the missing
            rows are an empty project; blank titles are still allocated from represented rows on the server.
          </ScreenNote>
          <Button variant="outline" size="sm" onclick={retryData}>Retry project data</Button>
        </div>
      {:else if representedResources.ready && representedResources.current.unavailable.length > 0}
        <ScreenNote tone="gap">
          {representedResources.current.unavailable.length} represented
          {representedResources.current.unavailable.length === 1 ? "resource is" : "resources are"}
          hidden from search because stored metadata is invalid.
        </ScreenNote>
      {/if}
      {#if launchError}
        <ScreenNote tone="gap">{launchError}</ScreenNote>
      {/if}

      <!--
        Results drop under the field. Replacing the bands below would be a mode
        change inside a tab whose whole job is one question, and the shelves being
        pushed down is the cheaper of the two costs.
      -->
      {#if needle !== "" &&
        (!representedResources.ready || !representedTemplates.ready) &&
        !representedResources.error &&
        !representedTemplates.error}
        <ScreenEmpty title="Loading project search">
          Reading represented resources and templates.
        </ScreenEmpty>
      {:else if needle !== "" && results.length === 0}
        <ScreenEmpty kind="no-matches" title="Nothing in the project matches" onclear={() => (query = "")}>
          Search covers represented documents, decks, spreadsheets, research, findings, and templates.
        </ScreenEmpty>
      {:else if needle !== ""}
        <div class="border-border-subtle rounded-panel flex flex-col overflow-hidden border">
          {#each results as row (row.id)}
            {@const Icon = KIND_ICON[row.kind]}
            <button
              type="button"
              class="border-border-subtle hover:bg-surface-panel-hover flex items-center gap-2 border-b px-3 py-2 text-start last:border-b-0"
              onclick={() => launch(row)}
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
      Three pills and nothing else. Overview, Analysis, Templates and Agents are
      permanent tabs, and offering to create one would imply they can be absent;
      a research thread is a tab like a document, but nothing in the model starts
      one, so an offer to make one would be an offer nothing can keep.
    -->
    <div class="area-editors flex flex-wrap items-center justify-center gap-2">
      {#each kinds as kind (kind.id)}
        {@const Icon = EDITOR_ICON[kind.name]}
        <Button
          variant="outline"
          size="lg"
          title={kind.name === "Spreadsheet" ? SPREADSHEET_CREATION : kind.detail}
          disabled={creating !== undefined || kind.name === "Spreadsheet"}
          onclick={() => create(kind)}
          class="rounded-control text-body-sm px-4"
        >
          <Icon aria-hidden="true" />
          {kind.name}
        </Button>
      {/each}
      {#if creationError}
        <div class="basis-full">
          <ScreenNote tone="gap">{creationError}</ScreenNote>
        </div>
      {/if}
    </div>

    <!--
      A shelf rather than a grid: a grid of twelve cards pushes the search field
      off the top of the screen, and this is a row you browse rather than search.
      Workspace open-history is not represented yet, so this is honestly up to
      ten of the most recently updated resources whose ordinary editor consumes
      the represented id today.
    -->
    <div class="area-recent">
      <ScreenGroup label="Recent" count={String(recent.length)}>
        <ScreenShelf label="Recent project resources">
          {#each recent as row (row.id)}
            {@const Icon = KIND_ICON[row.kind]}
            <ScreenShelfItem>
              <ScreenCard
                title={row.name}
                sub="{kindLabel(row.kind)} · {row.age}"
                icon={Icon}
                onselect={() => launch(row)}
              >
                {#snippet thumb()}
                  <ScreenThumb ratio={KIND_RATIO[row.kind]} lines={4} />
                {/snippet}
                <span class="text-caption text-ink-muted truncate">
                  Updated {row.age} — {row.updatedBy}
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
      <ScreenGroup label="Templates" count={String(all.length)}>
        {#if representedTemplates.error}
          <div class="remote-state">
            <ScreenEmpty title="Templates could not be loaded">
              The Template capability returned an error; no mock cards are substituted.
            </ScreenEmpty>
            <Button variant="outline" size="sm" onclick={() => representedTemplates.refresh()}>
              Retry templates
            </Button>
          </div>
        {:else if !representedTemplates.ready}
          <ScreenEmpty title="Loading templates">
            Reading the owner-visible Template library.
          </ScreenEmpty>
        {:else}
          <ScreenShelf label="Project templates">
            {#each all as row (row.id)}
              {@const Icon = MAKES_ICON[row.makes]}
              <ScreenShelfItem>
                <ScreenCard
                  title={row.name}
                  sub={asks(row)}
                  icon={Icon}
                  onselect={() => start(row.id)}
                >
                  {#snippet thumb()}
                    <ScreenThumb
                      ratio={MAKES_RATIO[row.makes]}
                      lines={5}
                      variables={Math.min(row.variableCount, 5)}
                    />
                  {/snippet}
                  <span class="text-caption text-ink-muted truncate">
                    {row.scope} · {row.updated}
                  </span>
                </ScreenCard>
              </ScreenShelfItem>
            {/each}
          </ScreenShelf>

          <ScreenNote meta="{withVariables} of {all.length} declare variables">
            These are the same represented rows as the Template library. A card opens that library
            for inspection and Use; represented defaults resolve there, while unbound answers refuse safely.
          </ScreenNote>
        {/if}
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

  .remote-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>
