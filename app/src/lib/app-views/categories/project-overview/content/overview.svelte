<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import FileText from "@lucide/svelte/icons/file-text";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { PanelFaces } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import { ToggleGroup, ToggleGroupItem } from "$vendored-components/toggle-group";
  import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
  import { actorName } from "$app-views/categories/project-overview/procedures/actor-name";
  import { activity } from "$app-views/categories/project-overview/procedures/activity";
  import { OverviewState } from "$app-views/categories/project-overview/content/overview.state.svelte";
  import { keepBoardCurrent } from "$app-views/categories/project-overview/procedures/effects/board.svelte";
  import { inspectionFor } from "$app-views/categories/project-overview/procedures/inspecting";
  import { makeResource } from "$app-views/categories/project-overview/procedures/make-resource";
  import { mentions as mentionsForViewer } from "$app-views/categories/project-overview/procedures/mentions";
  import { openingFor } from "$app-views/categories/project-overview/procedures/opening";
  import { people } from "$app-views/categories/project-overview/procedures/people";
  import { project } from "$app-views/categories/project-overview/procedures/project";
  import { projectId, viewerId } from "$app-views/categories/project-overview/procedures/scope";
  import {
    resourcesIn,
    type Resource,
    type ResourceKind
  } from "$app-views/categories/project-overview/procedures/resources";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const board = new OverviewState();
  const clock = keepBoardCurrent(board);

  /**
   * Project Overview — the grounding zone. Reset, re-align, launch.
   *
   * Three bands: who and what this project is, then the two things you came for
   * side by side — what to make, and what is waiting on you — then everything the
   * project contains.
   *
   * **Nothing on this board scrolls; two of its bands do.** The board is a grid
   * of bounded rows rather than content-height ones, so a long activity feed or a
   * forty-row project cannot push the table off the bottom. Where a region holds
   * more than it has height for, the region gives in — the feed scrolls inside
   * its own frame and so does the table — because a screen you have to scroll is
   * a screen you cannot take in at a glance, which is the only thing this one is
   * for. A band that scrolls is a promise that everything is reachable; a table
   * silently cut to five rows is a project that looks smaller than it is.
   *
   * **A row is a thing, not a health report.** There is no Status column on the
   * Resources table, and no connector band above it: what cannot proceed belongs
   * in the status bar rather than in the place a person comes to re-orient.
   *
   * **The header carries no Settings.** Settings is a property of the project
   * rather than of this category, so it lives in the top bar.
   */
  /**
   * One project, one viewer, one clock.
   *
   * `now` is read once per render rather than per row: a table that asked the
   * clock ten times would draw ten rows against ten different moments, and the
   * two that straddled a minute boundary would disagree about how long ago the
   * same edit was.
   *
   * The project is not `view.project` — that is the token from the route, and
   * what scopes a row is the id it resolves to. Both come from `scope`, which
   * says there why it has to work them out.
   */

  const id = $derived(projectId());
  const viewer = $derived(viewerId());
  const resourceIndex = readProjectResourceIndex();

  const it = $derived(project(id));
  const everyone = $derived(people(id));
  const mentions = $derived(mentionsForViewer(id, viewer, clock.now));
  const events = $derived(activity(id, clock.now));
  const work = $derived(
    resourcesIn(resourceIndex.ready ? resourceIndex.current : undefined, clock.now)
  );

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "kind", label: "Kind" }
  ] as const;

  /**
   * What a kind is called in the table, and in the filter that narrows to it.
   *
   * Total rather than partial, both of them: a kind added to the vocabulary
   * without a name here is a build error rather than a blank cell and an option
   * nobody can read.
   */
  const KIND_LABEL: Record<ResourceKind, string> = {
    document: "Document",
    slides: "Slide deck",
    spreadsheet: "Spreadsheet",
    research: "Research",
    analysis: "Analysis",
    file: "External",
    finding: "Finding"
  };

  const KIND_PLURAL: Record<ResourceKind, string> = {
    document: "Documents",
    slides: "Slide decks",
    spreadsheet: "Spreadsheets",
    research: "Research",
    analysis: "Analyses",
    file: "External",
    finding: "Findings"
  };

  const WITHOUT_FILES = "all-but-file";

  const CREATE = [
    {
      key: "document",
      label: "Document",
      icon: FileText,
      tint:
        "border-interactive-border bg-interactive-surface text-interactive-text hover:border-interactive-fill hover:bg-interactive-surface-hover"
    },
    {
      key: "slides",
      label: "Slide deck",
      icon: Presentation,
      tint:
        "border-accent-1-border bg-accent-1-surface text-accent-1-text hover:border-accent-1-fill hover:bg-accent-1-surface-hover"
    },
    {
      key: "spreadsheet",
      label: "Spreadsheet",
      icon: Sheet,
      tint:
        "border-accent-2-border bg-accent-2-surface text-accent-2-text hover:border-accent-2-fill hover:bg-accent-2-surface-hover"
    },
    {
      key: "research",
      label: "Research chat",
      icon: FlaskConical,
      tint:
        "border-intelligence-border bg-intelligence-surface text-intelligence-text hover:border-intelligence-fill hover:bg-intelligence-surface-hover"
    },
    {
      key: "analysis",
      label: "Analysis graph",
      icon: ChartColumn,
      tint:
        "border-secondary-border bg-secondary-surface text-secondary-text hover:border-secondary-fill hover:bg-secondary-surface-hover"
    }
  ] as const;

  /**
   * A default title belongs to represented project state, not this cached view.
   * Omitting it asks Project Resources to allocate the first free suffix on the
   * server immediately before the row is created.
   */
  const make = (key: (typeof CREATE)[number]["key"]) => {
    if (
      key === "document" ||
      key === "slides" ||
      key === "spreadsheet" ||
      key === "research"
    ) {
      void makeResource(view, board.creation, key);
      return;
    }
    alert("Creating a represented analysis graph is not wired up yet.");
  };

  const launch = (row: Resource) => {
    const target = openingFor(row);
    if (target) {
      view.open(target);
      if (row.kind === "file") {
        view.inspect("external.file", { kind: "external-file", id: row.id });
      }
      return;
    }

    if (["research", "analysis"].includes(row.kind)) {
      alert(`Opening "${row.name}" is not wired up yet.`);
      return;
    }
    const { key, selection } = inspectionFor(row);
    view.inspect(key, selection);
  };

  const compare = (a: Resource, b: Resource): number => {
    if (board.sortBy === "name") return a.name.localeCompare(b.name);
    if (board.sortBy === "kind")
      return (
        KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]) || a.name.localeCompare(b.name)
      );
    return b.updatedAt - a.updatedAt;
  };

  const DIRECTION: Record<string, { asc: string; desc: string }> = {
    updated: { asc: "Newest first", desc: "Oldest first" },
    name: { asc: "A to Z", desc: "Z to A" },
    kind: { asc: "A to Z", desc: "Z to A" }
  };

  const ofKind = (of: ResourceKind): boolean =>
    board.kind === "all" || (board.kind === WITHOUT_FILES ? of !== "file" : of === board.kind);

  const matched = $derived(
    work
      .filter((row) => ofKind(row.kind))
      .filter((row) => board.actor === "all" || row.updatedBy === board.actor)
      .filter((row) => row.name.toLowerCase().includes(board.search.trim().toLowerCase()))
  );

  const ordered = $derived(
    [...matched].sort((a, b) => (board.direction === "asc" ? 1 : -1) * compare(a, b))
  );

  const listed = $derived(
    ordered.map((row) => ({ row, ...inspectionFor(row) }))
  );

  /**
   * Both filters offer what the work contains rather than what the vocabulary
   * allows, for the same reason. The kind list and the actor list are derived from
   * the rows already in the project, so they stay in step with what is on the
   * board and never widen past the table they are narrowing. The visible task label
   * uses the driving persona name and task id (for example, Generalist (e344csd))
   * rather than a generic agent label.
   */
  const kinds = $derived(
    [...new Set(work.map((row) => row.kind))].sort((a, b) =>
      KIND_PLURAL[a].localeCompare(KIND_PLURAL[b])
    )
  );

  const actors = $derived(
    [...new Set(work.map((row) => row.updatedBy))].sort((a, b) => a.localeCompare(b))
  );

  /**
   * Everyone in the project, those who are here now first.
   *
   * The faces are a strip with a chip on the end, and the chip is what the rest
   * are behind — so an ordering that could put a present person there would hide
   * the one fact the strip exists to show. Within each half nothing is ranked.
   */
  const faces = $derived(
    [...everyone]
      .sort((a, b) => Number(b.at !== undefined) - Number(a.at !== undefined))
      .map((person) => ({
        id: person.id,
        name: person.name,
        kind: "person" as const,
        present: person.at !== undefined
      }))
  );

  const clear = () => {
    board.search = "";
    board.kind = "all";
    board.actor = "all";
  };
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-header">
      <ScreenHeader title={it.name} about={it.description}>
        {#snippet actions()}
          <PanelFaces
            actors={faces}
            limit={3}
            label="People in this project"
            onselect={(id) => view.inspect("general.person", { kind: "person", id })}
          >
            {#snippet overflow()}
              <DropdownMenu.Group>
                <DropdownMenu.GroupHeading>In this project</DropdownMenu.GroupHeading>
                {#each faces as face (face.id)}
                  {@const person = everyone.find((row) => row.id === face.id)}
                  <DropdownMenu.Item
                    onSelect={() =>
                      view.inspect("general.person", { kind: "person", id: face.id })}
                  >
                    <span class="min-w-0 flex-1 truncate">{face.name}</span>
                    <span class="text-caption text-ink-muted shrink-0">
                      {face.present ? "Here now" : (person?.role ?? "")}
                    </span>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Group>
            {/snippet}
          </PanelFaces>
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-create">
      <ScreenGroup label="Create">
        {#if resourceIndex.error}
          <ScreenNote tone="gap">
            The resource list could not be loaded. Blank titles are still allocated from represented
            rows on the server.
          </ScreenNote>
        {:else if !resourceIndex.ready}
          <ScreenNote>Loading the resource list; server-side blank creation remains available.</ScreenNote>
        {/if}
        {#if board.creation.failure}
          <ScreenNote tone="gap">Could not create the resource: {board.creation.failure}</ScreenNote>
        {/if}
        <div class="create" role="group" aria-label="What you can make">
          {#each CREATE as pill (pill.key)}
            {@const Icon = pill.icon}
            <button
              type="button"
              disabled={(pill.key === "document" ||
                pill.key === "slides" ||
                pill.key === "spreadsheet" ||
                pill.key === "research") &&
                board.creation.making !== undefined}
              onclick={() => make(pill.key)}
              class="rounded-control text-body-sm flex w-full cursor-pointer items-center gap-2 border px-3 text-start {pill.tint}"
            >
              <Icon size={16} aria-hidden="true" />
              {pill.label}
            </button>
          {/each}
        </div>
      </ScreenGroup>
    </div>

    <div class="area-review">
      <ScreenGroup label="Review">
        {#snippet actions()}
          <!--
            A single-choice group, because the two are alternatives: one is
            showing and the other is not, and two independent buttons could be
            pressed into a state the feed below has no way to draw.
          -->
          <!--
            Bound rather than set, because a single-choice group clears itself
            when the pressed item is the one already chosen. Reading back through
            the binding puts it straight again: there is no state in which
            neither half is showing, so there must be none in which neither
            reads as pressed.
          -->
          <ToggleGroup
            type="single"
            bind:value={
              () => board.feed,
              (next: string) => {
                if (next === "mentions" || next === "activity") board.feed = next;
              }
            }
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="mentions" aria-label="Mentions of you">
              Mentions
              <span class="tabular-nums opacity-70">{mentions.length}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="activity" aria-label="Activity in this project">
              Activity
              <span class="tabular-nums opacity-70">{events.length}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        {/snippet}

        <div class="feed">
          {#if board.feed === "mentions"}
            <ScreenList label="Mentions of you" scroll>
              {#each mentions as mention (mention.id)}
                <ScreenItem
                  meta={mention.age}
                  onselect={() =>
                    view.inspect("project-overview.comment", { kind: "comment", id: mention.id })}
                >
                  <span class="block truncate" title={mention.resource}>
                    <strong>{actorName(mention.author)}</strong>
                    mentioned you on
                    <strong>{mention.resource}</strong>
                    {#if mention.location}<span class="text-ink-muted">· {mention.location}</span>{/if}
                  </span>
                  <span class="text-caption text-ink-secondary block truncate" title={mention.excerpt}>
                    "{mention.excerpt}"
                  </span>
                </ScreenItem>
              {:else}
                <ScreenEmpty title="Nothing addressed to you">
                  A mention is the one thing worth interrupting for.
                </ScreenEmpty>
              {/each}
            </ScreenList>
          {:else}
            <ScreenList label="Activity in this project" scroll>
              {#each events as event (event.id)}
                <ScreenItem
                  meta={event.at}
                  onselect={() => view.inspect("project-overview.activity", { kind: "activity", id: event.id })}
                >
                  <span class="block truncate">
                    <strong>{event.actor}</strong>
                    {event.verb}
                  </span>
                  <span class="text-caption text-ink-secondary block truncate" title={event.subject}>
                    {event.subject}
                  </span>
                </ScreenItem>
              {/each}
            </ScreenList>
          {/if}
        </div>
      </ScreenGroup>
    </div>

    <!--
      Everything the project contains, as one table — every kind, because "what is
      in this project" is one question. The band takes whatever height the two
      above leave and the rows scroll inside it, so the count over the table is
      the whole answer rather than the part that fitted.
    -->
    <div class="area-resources">
      <ScreenGroup label="Resources" fill>
        <!--
          The count is matched-of-total, so a filtered view never looks like the
          whole project. The direction rides in `order`, which draws it inside the
          order's own frame: which way a sort runs is half of one decision.
        -->
        <ScreenFilters
          placeholder="Search this project"
          matched={matched.length}
          total={work.length}
          sorts={SORTS}
          bind:sort={board.sortBy}
          bind:value={board.search}
        >
          <select
            class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
            bind:value={board.kind}
            aria-label="Kind"
          >
            <option value="all">All kinds</option>
            {#if kinds.includes("file")}
              <option value={WITHOUT_FILES}>Less external</option>
            {/if}
            {#each kinds as option (option)}
              <option value={option}>{KIND_PLURAL[option]}</option>
            {/each}
          </select>
          <select
            class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
            bind:value={board.actor}
            aria-label="Updated by"
          >
            <option value="all">Anyone</option>
            {#each actors as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </select>

          {#snippet order()}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={DIRECTION[board.sortBy][board.direction]}
              title={DIRECTION[board.sortBy][board.direction]}
              onclick={() => (board.direction = board.direction === "asc" ? "desc" : "asc")}
            >
              {#if board.direction === "asc"}
                <ArrowUpNarrowWide aria-hidden="true" />
              {:else}
                <ArrowDownNarrowWide aria-hidden="true" />
              {/if}
            </Button>
          {/snippet}
        </ScreenFilters>

        {#if resourceIndex.ready && resourceIndex.current.unavailable.length > 0}
          <ScreenNote tone="gap">
            {resourceIndex.current.unavailable.length} represented
            {resourceIndex.current.unavailable.length === 1 ? "resource is" : "resources are"}
            hidden because stored metadata is invalid.
          </ScreenNote>
        {/if}

        {#if resourceIndex.error}
          <div class="resource-state">
            <ScreenEmpty title="Project resources could not be loaded">
              The represented resource index returned an error. Retry without treating the project as empty.
            </ScreenEmpty>
            <Button variant="outline" size="sm" onclick={() => resourceIndex.refresh()}>
              Retry resource index
            </Button>
          </div>
        {:else if !resourceIndex.ready}
          <ScreenEmpty title="Loading project resources">
            Reading the project-scoped resource index.
          </ScreenEmpty>
        {:else if listed.length === 0}
          <ScreenEmpty kind="no-matches" title="Nothing in this project matches" onclear={clear}>
            Search covers represented documents, decks, spreadsheets, research, and findings.
          </ScreenEmpty>
        {:else}
          <ScreenTable scroll columns={["Name", "Kind", "Updated", "Updated by"]}>
            {#each listed as entry (entry.row.id)}
              <ScreenRow
                selected={view.selection?.id === entry.selection.id}
                onselect={() => view.inspect(entry.key, entry.selection)}
                onopen={() => launch(entry.row)}
              >
                <ScreenCell>
                  <button
                    type="button"
                    class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
                    onclick={() => view.inspect(entry.key, entry.selection)}
                    ondblclick={() => launch(entry.row)}
                    onkeydown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      launch(entry.row);
                    }}
                  >
                    {entry.row.name}
                  </button>
                </ScreenCell>
                <ScreenCell>{KIND_LABEL[entry.row.kind]}</ScreenCell>
                <ScreenCell num>{entry.row.updated}</ScreenCell>
                <ScreenCell>{entry.row.updatedBy}</ScreenCell>
              </ScreenRow>
            {/each}
          </ScreenTable>
        {/if}
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  .resource-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /**
   * Two tracks in the middle band, 2fr and 3fr, and full width above and below.
   *
   * The halves are not equal because what they hold is not: Create is five pills
   * of one word each and Review is prose, so the width goes to the side that has
   * sentences to break.
   *
   * **Every row is bounded, and the last one takes what is left.** The brief's
   * one hard requirement is that this screen never scrolls, and content-height
   * rows cannot promise that — a project with forty resources or a busy week of
   * activity would each grow a row until the table left the viewport. So the
   * middle band is capped at what its taller half needs and Resources is given
   * the remainder, which is also what makes the table inside it scrollable: a
   * band with no height of its own has nothing for a table to give in to.
   *
   * **The middle row is one measurement, taken once.** Create and Review are two
   * halves of one row and have to end level, so rather than each being sized and
   * the pair checked, the band is defined as *four Review entries tall* and
   * everything else is derived from it: the feed takes it, Create divides it by
   * five, and the row is it plus the label above.
   *
   * An entry is what an entry is made of — a title line, a caption line and its
   * own padding — rather than a measured pixel count, which would drift the day
   * the type scale moves. There is no term for a gap between the two lines,
   * because both feeds hand them to `ScreenItem` as one block.
   *
   * At 1440x900 less the 44px top bar, the 36px tab strip and the 32px status
   * bar, the plane is 788px and the surface's padding takes 48 of it. Header and
   * the middle row come to roughly 370, and Resources is the other 370.
   */
  .board {
    --entry: calc(
      var(--token-text-body-sm-leading) + var(--token-text-caption-leading) +
        var(--token-spacing-unit) * 5
    );
    --band: calc(var(--entry) * 4 + 5px);

    display: grid;
    flex: 1;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    grid-template-rows:
      auto
      minmax(0, calc(var(--token-spacing-unit) * 9 + var(--band)))
      minmax(0, 1fr);
    grid-template-areas:
      "header    header"
      "create    review"
      "resources resources";
  }

  .area-header {
    grid-area: header;
  }
  .area-create {
    grid-area: create;
  }
  .area-review {
    grid-area: review;
  }
  .area-resources {
    grid-area: resources;
  }

  /**
   * Each band is a column its own contents can shrink inside.
   *
   * A grid item is as tall as its row, but a block child of one is as tall as
   * *its* contents and spills — so a bounded row alone does not bound what is in
   * it. These three make the band a flex column with no floor under it, which is
   * what lets the feed and the table give in to the height they were given
   * instead of deciding it.
   */
  .area-create,
  .area-review,
  .area-resources {
    display: flex;
    min-height: 0;
    flex-direction: column;
  }

  /**
   * Four entries exactly, and the same four whichever feed is showing: the two
   * are alternatives, so a frame that resized as you switched would move the
   * table below it every time.
   *
   * Grid rather than flex, so the list stretches to the band on both axes
   * without this file reaching into another component's classes to do it.
   */
  .feed {
    display: grid;
    min-height: 0;
    height: var(--band);
  }

  /**
   * The same height, cut five ways.
   *
   * Five pills where the feed beside it spends the height on four entries, so
   * each is a little shorter than an entry and the two bands end exactly level.
   * The rows are `1fr` rather than a fixed height, so the four gaps come out of
   * the band rather than being added to it.
   */
  .create {
    display: grid;
    min-height: 0;
    height: var(--band);
    gap: calc(var(--token-spacing-unit) * 2);
    grid-template-rows: repeat(5, minmax(0, 1fr));
  }

  @media (max-width: 60rem) {
    .board {
      flex: none;
      min-height: auto;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto auto;
      grid-template-areas:
        "header"
        "review"
        "create"
        "resources";
      align-content: start;
    }
  }

  @media (max-height: 46rem) {
    .board {
      flex: none;
      min-height: auto;
      grid-template-rows: auto auto auto;
      align-content: start;
    }
  }
</style>
