<script lang="ts">
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Folder from "@lucide/svelte/icons/folder";

  import {
    ScreenCard,
    ScreenCards,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenSurface,
    ScreenThumb
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import {
    templateKinds,
    templates,
    type LibraryTemplate,
    type TemplateScope,
    type TemplateTarget
  } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Templates — the library: a place rather than a list.
   *
   * The one screen that keeps a library-and-editor pair, and this half is why:
   * the library has folders and holds templates that were never made here, so it
   * is somewhere you navigate rather than a table you read down.
   *
   * **Whose a template is, is a folder and not a filter.** Project, Personal and
   * Shared decide who may edit one, which is the first thing that changes what
   * you can do about it — and a chip row would put that on the same footing as
   * "makes a deck". Searching flattens the folders, exactly as the Agents library
   * does: a search is a question about all of them, and making someone open three
   * folders to answer it is the folder winning over the question.
   *
   * **Scope is then said again on the card, in colour.** A card lifted out of its
   * folder by a search has lost the one thing the folder was telling it, so the
   * subtext leads with the scope and the type comes second.
   *
   * **Every card is the same height.** A grid you scan for a shape is unreadable
   * when the shapes set the heights — the eye reads the ragged bottom edge before
   * it reads any of them — so the thumb gets a fixed band and keeps its aspect
   * ratio inside it.
   */
  const all = $derived(templates().current);
  const kinds = $derived(templateKinds().current);

  const SCOPES: readonly TemplateScope[] = ["Project", "Shared", "Personal"];

  /** The folder that is open, or none. Searching ignores it entirely. */
  let folder = $state<TemplateScope | undefined>(undefined);
  let search = $state("");
  let makes = $state("all");
  let sortBy = $state("updated");
  let ascending = $state(true);

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "makes", label: "Makes" },
    { value: "variables", label: "Variables" }
  ] as const;

  /** The kinds are the four things a template can make, from the door that names them. */
  const kindOptions = $derived([
    { value: "all", label: "All kinds" },
    ...kinds.map((kind) => ({ value: kind.makes, label: kind.makes }))
  ]);

  /** A page, a slide and a grid are different shapes, and the preview is the shape. */
  const RATIO: Record<TemplateTarget, string> = {
    Document: "4 / 3",
    "Slide deck": "16 / 9",
    Slide: "16 / 9",
    Spreadsheet: "1 / 1"
  };

  /**
   * The three scopes, in three hues that mean nothing else.
   *
   * accent-1 and accent-2 exist for exactly this — categorical work claimed by no
   * meaning role — and the project's own templates take `primary`, because the
   * project is the ground everything else on this screen is measured against. No
   * meaning role is borrowed: whose a template is, is not a success or a warning.
   */
  const SCOPE_TONE: Record<TemplateScope, string> = {
    Project: "text-primary-text",
    Shared: "text-accent-2-text",
    Personal: "text-accent-1-text"
  };

  const searching = $derived(search.trim() !== "");

  const matching = $derived(
    all
      .filter((row: LibraryTemplate) => makes === "all" || row.makes === makes)
      .filter((row: LibraryTemplate) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      )
  );

  /**
   * `updated` is prose — "2 weeks ago", "6 months ago" — so ordering by it means
   * reading it, exactly as the project overview does. The door's own order is not
   * recency, so trusting the array would put a five-week-old template above a
   * three-week-old one and call the result *Updated*.
   */
  const AGO: Record<string, number> = {
    minute: 1,
    minutes: 1,
    hour: 60,
    hours: 60,
    day: 1440,
    days: 1440,
    week: 10080,
    weeks: 10080,
    month: 43800,
    months: 43800
  };

  /** Anything unreadable sorts to the far end, never to the top where it would look freshest. */
  const ago = (updated: string): number => {
    if (updated === "Today") return 0;
    if (updated === "Yesterday") return AGO.day;
    const match = /^(\d+) (\w+) ago$/.exec(updated);
    const unit = match ? AGO[match[2]] : undefined;
    return match && unit !== undefined ? Number(match[1]) * unit : Number.MAX_SAFE_INTEGER;
  };

  /**
   * Ordered, and the direction is a control rather than a property of the order.
   *
   * Newest-first is what anybody wants of *Updated* and A–Z is what anybody wants
   * of a name, and ascending is both of those at once: the smallest age is the
   * newest, so the arrow starts pointed the way either order is usually read.
   */
  const compare = (a: LibraryTemplate, b: LibraryTemplate): number => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "makes") return a.makes.localeCompare(b.makes);
    if (sortBy === "variables") return a.variables - b.variables;
    return ago(a.updated) - ago(b.updated);
  };

  const shown = $derived(
    [...(searching ? matching : matching.filter((row: LibraryTemplate) => row.scope === folder))]
      .sort((a, b) => (ascending ? compare(a, b) : -compare(a, b)))
  );

  /** Counted against what the filter leaves, so a folder never promises more than it holds. */
  const countIn = (scope: TemplateScope): number =>
    matching.filter((row: LibraryTemplate) => row.scope === scope).length;

  const onFolders = $derived(!searching && folder === undefined);

  /**
   * One figure, said in three places, and it counts what is on screen.
   *
   * Inside a folder, counting every match in the library would have the filter
   * row report one number while the grid under it shows one folder's worth — the
   * row, the band and the note each claiming a different figure for one view.
   */
  const counted = $derived(onFolders ? matching.length : shown.length);

  const isSelected = (id: string): boolean =>
    view.selection?.kind === "template" && view.selection.id === id;

  const clear = () => {
    search = "";
    makes = "all";
  };
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <!-- No New template here: making one is an act of the rail, not of the title. -->
      <ScreenHeader
        title="Templates"
        about="A real body with variables left open. Using one makes an independent copy — later edits to the template never reach it."
      />
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search every template"
        matched={counted}
        total={all.length}
        sorts={SORTS}
        bind:sort={sortBy}
        bind:value={search}
      >
        {#if folder !== undefined && !searching}
          <Button variant="outline" size="sm" onclick={() => (folder = undefined)}>
            <ChevronLeft size={14} aria-hidden="true" />
            All templates
          </Button>
        {/if}

        <select
          class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
          bind:value={makes}
          aria-label="Makes"
        >
          {#each kindOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>

        <!--
          Inside the order's own frame: which way a sort runs is half of that one
          decision, and two separately bordered controls beside each other read
          as two.
        -->
        {#snippet order()}
          <Button
            variant="ghost"
            size="sm"
            onclick={() => (ascending = !ascending)}
            title={ascending ? "Sorted ascending" : "Sorted descending"}
          >
            {#if ascending}
              <ArrowUpNarrowWide size={14} aria-hidden="true" />
            {:else}
              <ArrowDownWideNarrow size={14} aria-hidden="true" />
            {/if}
            {ascending ? "Ascending" : "Descending"}
          </Button>
        {/snippet}
      </ScreenFilters>
    </div>

    <div class="area-templates min-h-0">
      <ScreenGroup
        label={searching ? "Matching templates" : (folder ?? "Folders")}
        count="{counted} of {all.length}"
      >
        {#if onFolders && matching.length === 0}
          <ScreenEmpty kind="no-matches" title="No template matches" onclear={clear}>
            Nothing in any folder is named that, or makes that.
          </ScreenEmpty>
        {:else if onFolders}
          <!--
            Folders, one per scope. Who may edit a template is the question the
            library is organised by, so it is the division you walk through rather
            than one more chip above the grid.
          -->
          <ScreenCards min="14rem">
            {#each SCOPES as scope (scope)}
              <ScreenCard
                title={scope}
                sub="{countIn(scope)} {countIn(scope) === 1 ? 'template' : 'templates'}"
                icon={Folder}
                onselect={() => (folder = scope)}
              />
            {/each}
          </ScreenCards>
        {:else if shown.length === 0}
          <ScreenEmpty
            kind={searching ? "no-matches" : "nothing-yet"}
            title={searching ? "No template matches" : "Nothing in this folder"}
            onclear={searching ? clear : undefined}
          >
            {searching
              ? "Nothing here is named that, or makes that."
              : "Templates you keep here will show up in this folder."}
          </ScreenEmpty>
        {:else}
          <ScreenCards min="14rem">
            {#each shown as row (row.id)}
              <!--
                Double-click opens the editor; a single click selects and inspects.
                Two acts, and conflating them would mean you could not look at a
                template without leaving the grid you were comparing it against.
              -->
              <div ondblclick={() => view.showSubscreen("editor", row.id)} role="presentation">
                <ScreenCard
                  title={row.name}
                  selected={isSelected(row.id)}
                  onselect={() =>
                    view.inspect("library.template", { kind: "template", id: row.id })}
                >
                  {#snippet thumb()}
                    <!--
                      The bars stand for the body and the tinted ones for its
                      openings. How many, not where: nothing in a body records
                      which variable it stands for, so a preview can count the
                      openings and cannot place them.
                    -->
                    <span class="shape">
                      <ScreenThumb
                        ratio={RATIO[row.makes]}
                        lines={6}
                        variables={Math.min(row.variables, 6)}
                      />
                    </span>
                  {/snippet}
                  <span class="text-caption truncate">
                    <span class={SCOPE_TONE[row.scope]}>{row.scope}</span>
                    <span class="text-ink-muted">· {row.makes}</span>
                  </span>
                </ScreenCard>
              </div>
            {/each}
          </ScreenCards>
        {/if}
      </ScreenGroup>
    </div>

    <div class="area-note">
      <ScreenNote meta="{counted} of {all.length}">
        Previews are rendered from the real body. The model has no thumbnail, tag, category,
        favourite or usage count, so the library does not pretend those exist.
      </ScreenNote>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * One track: a card grid already wraps to the width it is given, so there is
   * nothing for a second column to hold. `templates` is written twice because
   * that is how the grid takes its height off the bands around it.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "templates"
      "templates"
      "note";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-templates {
    grid-area: templates;
  }
  .area-note {
    grid-area: note;
  }

  /**
   * The standard card size, imposed here rather than by the thumb.
   *
   * A thumb left to size itself off its line count and its aspect ratio makes a
   * 16:9 deck and a 1:1 sheet two different heights, and every card under them
   * with them. The band fixes the height and the ratio then decides the width,
   * which keeps the one thing the shape is there to say.
   */
  .shape {
    display: flex;
    height: calc(var(--token-spacing-unit) * 22);
    align-items: center;
    justify-content: center;
  }

  .shape > :global(*) {
    height: 100%;
    width: auto;
    flex: none;
  }

  /*
    Already one column, so the narrow case only closes the gaps: the cards drop
    to a single column on their own, which is `ScreenCards`' decision to make.
  */
  @media (max-width: 60rem) {
    .board {
      gap: calc(var(--token-spacing-unit) * 3);
    }
  }
</style>
