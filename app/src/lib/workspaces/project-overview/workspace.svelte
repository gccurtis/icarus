<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import FileText from "@lucide/svelte/icons/file-text";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Upload from "@lucide/svelte/icons/upload";

  import { PanelFaces } from "$lib/unique-components/panel";
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
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import { actorName, type Resource } from "$mock-capabilities/cast";
  import { mentionsForViewer } from "$mock-capabilities/collaboration";
  import { threads } from "$mock-capabilities/library";
  import { openingFor } from "$mock-capabilities/opening";
  import { activity, people, project, resources } from "$mock-capabilities/project";
  import { viewState, type Screen } from "$model/client/view-state";

  const view = viewState();

  /**
   * Project Overview — the grounding zone. Reset, re-align, launch.
   *
   * Three bands: who and what this project is, then the two things you came for
   * side by side — what to make, and what is waiting on you — then everything the
   * project contains.
   *
   * **Nothing on this board scrolls.** The board is a grid of bounded rows rather
   * than content-height ones, so a long activity feed or a forty-row project
   * cannot push the table off the bottom. Where a region holds more than it has
   * height for, the region gives in — the feed scrolls inside its own frame and
   * the table stops at five rows — because a screen you have to scroll is a
   * screen you cannot take in at a glance, which is the only thing this one is
   * for.
   *
   * **A row is a thing, not a health report.** There is no Status column on the
   * work table, and no connector band above it: what cannot proceed belongs in
   * the status bar rather than in the place a person comes to re-orient.
   *
   * **The header carries no Settings.** Settings is a property of the project
   * rather than of this screen, so it lives in the top bar.
   */
  const it = $derived(project().current);
  const everyone = $derived(people().current);
  const mentions = $derived(mentionsForViewer().current);
  const events = $derived(activity().current);
  const work = $derived(resources().current);
  const everyThread = $derived(threads().current);

  /** The feed holds either mentions or activity; the two buttons switch between them. */
  let feed = $state<"mentions" | "activity">("mentions");

  let search = $state("");
  let kind = $state("all");
  let actor = $state("all");
  let order = $state("updated");
  let direction = $state<"asc" | "desc">("asc");

  /** Five rows, so the table's height is a constant the board can be laid out around. */
  const LIMIT = 5;

  const KINDS = [
    { value: "all", label: "All kinds" },
    { value: "document", label: "Documents" },
    { value: "slides", label: "Slide decks" },
    { value: "spreadsheet", label: "Spreadsheets" },
    { value: "research", label: "Research" },
    { value: "file", label: "Files" },
    { value: "finding", label: "Findings" }
  ] as const;

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "kind", label: "Kind" }
  ] as const;

  const KIND_LABEL: Record<string, string> = {
    document: "Document",
    slides: "Slide deck",
    spreadsheet: "Spreadsheet",
    research: "Research",
    analysis: "Analysis",
    file: "External file",
    finding: "Finding",
    connector: "Connector",
    context: "Context",
    template: "Template"
  };

  /**
   * What you can make, one hue each.
   *
   * The palette assigns exactly five hues to no meaning at all — blue, cyan,
   * violet, pink and teal — and those are the five here. Green, red, amber and
   * grey are excluded on purpose: a pill is an offer, and an offer wearing the
   * success or danger role reads as a verdict on something.
   *
   * Cyan is taken through its `secondary` name rather than its `active` one. The
   * two are the same hue, but `active` means "currently engaged" everywhere else
   * on the plane, and a permanently cyan Upload pill would look selected.
   *
   * Document keeps `interactive` because it is the commonest thing anyone makes
   * here, and blue is the hue the rest of the application already spends on the
   * thing it wants you to press.
   */
  const CREATE = [
    {
      key: "document",
      label: "Document",
      icon: FileText,
      tint:
        "border-interactive-border bg-interactive-surface text-interactive-text hover:bg-interactive-surface-hover"
    },
    {
      key: "slides",
      label: "Slide deck",
      icon: Presentation,
      tint: "border-accent-1-border bg-accent-1-surface text-accent-1-text hover:bg-accent-1-surface-hover"
    },
    {
      key: "spreadsheet",
      label: "Spreadsheet",
      icon: Sheet,
      tint: "border-accent-2-border bg-accent-2-surface text-accent-2-text hover:bg-accent-2-surface-hover"
    },
    {
      /** The flask, because that is what a research tab wears — and that is what this opens. */
      key: "research",
      label: "Research chat",
      icon: FlaskConical,
      tint:
        "border-intelligence-border bg-intelligence-surface text-intelligence-text hover:bg-intelligence-surface-hover"
    },
    {
      key: "upload",
      label: "Upload file",
      icon: Upload,
      tint:
        "border-secondary-border bg-secondary-surface text-secondary-text hover:bg-secondary-surface-hover"
    }
  ] as const;

  /** Which editor a blank thing opens in, and what the strip calls it there. */
  const BLANK = {
    document: { screen: "document-editor", noun: "document" },
    slides: { screen: "slide-deck-editor", noun: "deck" },
    spreadsheet: { screen: "spreadsheet-editor", noun: "spreadsheet" }
  } as const satisfies Record<string, { screen: Screen; noun: string }>;

  /**
   * The tab strip labels an editor tab by its `resourceId`, so a minted id has to
   * read as a name rather than as a key. The number steps past whatever that
   * screen already holds, because `open` is keyed by the id: two blank documents
   * are two things, and two that share a name are one tab.
   */
  const untitled = (screen: Screen, noun: string): string => {
    const taken = new Set(
      view.tabs.filter((tab) => tab.screen === screen).map((tab) => tab.resourceId)
    );
    let count = 1;
    while (taken.has(`Untitled ${noun} ${count}`)) count += 1;
    return `Untitled ${noun} ${count}`;
  };

  const make = (key: (typeof CREATE)[number]["key"]) => {
    if (key === "document" || key === "slides" || key === "spreadsheet") {
      const { screen, noun } = BLANK[key];
      view.open({ screen, resourceId: untitled(screen, noun) });
    } else if (key === "research") {
      // A thread is a tab keyed by the thread, and nothing here creates one, so
      // this lands on the first thread the strip is not already holding.
      // Inventing an id would put a tab in the strip that no door can answer for.
      const held = new Set(
        view.tabs.filter((tab) => tab.screen === "research").map((tab) => tab.resourceId)
      );
      const fresh = everyThread.find((row) => !held.has(row.id));
      if (fresh) view.open({ screen: "research", resourceId: fresh.id });
    } else {
      // Upload opens the lens that holds the picker and the ingestion state, which
      // is where Bring in sends it too — a second way in must not be a second place.
      view.inspect("library.upload");
    }
  };

  /**
   * What a row opens, by what it is.
   *
   * A body and a thread each earn a tab of their own, keyed by the thing rather
   * than by the screen. An analysis and a template are places you return to, so
   * those move the permanent tab onto the row instead of minting one. The
   * remaining kinds have no screen at all, and saying so out loud is honest
   * where a click that appears to do nothing is not.
   */
  const launch = (row: Resource) => {
    const target = openingFor(row.kind, row.id, row.name);
    if (target) view.open(target);
    else console.log(`No screen opens a ${KIND_LABEL[row.kind].toLowerCase()}`);
  };

  /**
   * `updated` is prose — "4 minutes ago", "Yesterday" — so ordering by it means
   * reading it. Minutes-ago rather than a date because that is all the data
   * carries; anything it cannot parse sorts to the far end rather than to the
   * top, where an unreadable date would look like the freshest row.
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

  const ago = (updated: string): number => {
    if (updated === "Today") return 0;
    if (updated === "Yesterday") return AGO.day;
    const match = /^(\d+) (\w+) ago$/.exec(updated);
    const unit = match ? AGO[match[2]] : undefined;
    return match && unit !== undefined ? Number(match[1]) * unit : Number.MAX_SAFE_INTEGER;
  };

  const compare = (a: Resource, b: Resource): number => {
    if (order === "name") return a.name.localeCompare(b.name);
    if (order === "kind")
      return (
        KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]) || a.name.localeCompare(b.name)
      );
    return ago(a.updated) - ago(b.updated);
  };

  /**
   * What the arrow means depends on what is being ordered. "Ascending" over a
   * relative age is the opposite way round from "ascending" over a name, and a
   * control labelled only `asc` would leave the reader working that out from the
   * result.
   */
  const DIRECTION: Record<string, { asc: string; desc: string }> = {
    updated: { asc: "Newest first", desc: "Oldest first" },
    name: { asc: "A to Z", desc: "Z to A" },
    kind: { asc: "A to Z", desc: "Z to A" }
  };

  const matched = $derived(
    work
      .filter((row) => kind === "all" || row.kind === kind)
      .filter((row) => actor === "all" || row.updatedBy === actor)
      .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const ordered = $derived(
    [...matched].sort((a, b) => (direction === "asc" ? 1 : -1) * compare(a, b))
  );

  const rows = $derived(ordered.slice(0, LIMIT));
  const hidden = $derived(ordered.length - rows.length);

  /**
   * Who last touched something, taken from the work rather than from the roster.
   * An agent and a connector both update resources and neither is a member, so a
   * list of people would leave five of the twelve rows unreachable by this filter.
   */
  const actors = $derived(
    [...new Set(work.map((row) => row.updatedBy))].sort((a, b) => a.localeCompare(b))
  );

  const faces = $derived(
    everyone
      .filter((person) => person.at !== undefined)
      .map((person) => ({ id: person.id, name: person.name, kind: "person" as const }))
  );

  const clear = () => {
    search = "";
    kind = "all";
    actor = "all";
  };
</script>

<ScreenSurface wide>
  <div class="board">
    <!-- Identity across the top: what this project is, and who is in it right now. -->
    <div class="area-header">
      <ScreenHeader title={it.name} about={it.description}>
        {#snippet actions()}
          <PanelFaces
            actors={faces}
            label="Here now"
            onselect={(id) => view.inspect("collaboration.person", { kind: "person", id })}
            onoverflow={() => view.inspect("collaboration.people")}
          />
        {/snippet}
      </ScreenHeader>
    </div>

    <!--
      Create. Five pills, stacked, each in its own hue — the colour is the thing
      you aim at, so the labels can stay plain nouns rather than "New document".
    -->
    <div class="area-create min-h-0">
      <ScreenGroup label="Create">
        <div class="flex flex-col gap-2">
          {#each CREATE as pill (pill.key)}
            {@const Icon = pill.icon}
            <button
              type="button"
              onclick={() => make(pill.key)}
              class="rounded-control text-body-sm flex h-9 w-full cursor-pointer items-center gap-2 border px-3 text-start {pill.tint}"
            >
              <Icon size={16} aria-hidden="true" />
              {pill.label}
            </button>
          {/each}
        </div>
      </ScreenGroup>
    </div>

    <!--
      Review. No band label: the two buttons already say what is below them, and a
      "Review" caption over a control that reads "Mentions" is the same word twice.

      The frame is exactly three entries tall in both states, so switching feeds
      never moves the table underneath. A fourth entry scrolls inside the frame
      rather than growing it — the band has a height and the list gives in to it.
    -->
    <div class="area-review flex min-h-0 flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <Button
          variant={feed === "mentions" ? "default" : "outline"}
          size="sm"
          aria-pressed={feed === "mentions"}
          onclick={() => (feed = "mentions")}
        >
          Mentions
          <span class="tabular-nums opacity-70">{mentions.length}</span>
        </Button>
        <Button
          variant={feed === "activity" ? "default" : "outline"}
          size="sm"
          aria-pressed={feed === "activity"}
          onclick={() => (feed = "activity")}
        >
          Activity
          <span class="tabular-nums opacity-70">{events.length}</span>
        </Button>
      </div>

      <div class="feed">
        {#if feed === "mentions"}
          <ScreenList label="Mentions of you" scroll>
            {#each mentions as mention (mention.id)}
              <ScreenItem
                meta={mention.age}
                onselect={() =>
                  view.inspect("collaboration.comment", { kind: "comment", id: mention.id })}
              >
                <!--
                  Two lines and no third. `excerpt` is not used here: it clamps to
                  two lines of its own, which makes an entry three lines tall the
                  moment somebody writes a long comment, and the whole point of
                  this band is that every entry is the same height.
                -->
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
                onselect={() => view.inspect("project.activity", { kind: "activity", id: event.id })}
              >
                <span class="block truncate">
                  <strong>{event.actor}</strong>
                  {event.verb}
                </span>
                <!-- The name gets its own line, because the name is what truncates. -->
                <span class="text-caption text-ink-secondary block truncate" title={event.subject}>
                  {event.subject}
                </span>
              </ScreenItem>
            {/each}
          </ScreenList>
        {/if}
      </div>
    </div>

    <!--
      The count is matched-of-total, so a filtered view never looks like the whole
      project.

      The direction toggle rides in `children` because that is the only slot
      `ScreenFilters` opens, which puts it immediately left of the order — still
      adjacent, which is all it needs to be read as the order's other half.
    -->
    <div class="area-filters">
      <ScreenFilters
        placeholder="Search this project"
        matched={matched.length}
        total={work.length}
        sorts={SORTS}
        bind:sort={order}
        bind:value={search}
      >
        <select
          class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
          bind:value={kind}
          aria-label="Kind"
        >
          {#each KINDS as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <select
          class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
          bind:value={actor}
          aria-label="Updated by"
        >
          <option value="all">Anyone</option>
          {#each actors as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={DIRECTION[order][direction]}
          title={DIRECTION[order][direction]}
          onclick={() => (direction = direction === "asc" ? "desc" : "asc")}
        >
          {#if direction === "asc"}
            <ArrowUpNarrowWide aria-hidden="true" />
          {:else}
            <ArrowDownNarrowWide aria-hidden="true" />
          {/if}
        </Button>
      </ScreenFilters>
    </div>

    <!--
      Everything the project contains, as one table — every kind, because "what is
      in this project" is one question. Five rows and a line saying so: a table
      that quietly stops is worse than a short one that admits it.
    -->
    <div class="area-work flex min-h-0 flex-col gap-2">
      {#if rows.length === 0}
        <ScreenEmpty kind="no-matches" title="Nothing in this project matches" onclear={clear}>
          The search reaches every kind — documents, decks, grids, threads, findings and connector
          files alike.
        </ScreenEmpty>
      {:else}
        <ScreenTable columns={["Name", "Kind", "Updated", "Updated by"]}>
          {#each rows as row (row.id)}
            <ScreenRow
              selected={view.selection?.kind === "resource" && view.selection?.id === row.id}
            >
              <ScreenCell>
                <!--
                  Double-click opens the row; a single click selects and
                  inspects. Two acts, and conflating them would mean you could
                  not look at anything without leaving the board you came to.
                -->
                <span role="presentation" ondblclick={() => launch(row)} class="flex items-center">
                  <button
                    type="button"
                    class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
                    onclick={() =>
                      view.inspect("project.resource", { kind: "resource", id: row.id })}
                  >
                    {row.name}
                  </button>
                </span>
              </ScreenCell>
              <ScreenCell>{KIND_LABEL[row.kind]}</ScreenCell>
              <ScreenCell num>{row.updated}</ScreenCell>
              <ScreenCell>{row.updatedBy}</ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>

        {#if hidden > 0}
          <ScreenNote meta="{rows.length} of {ordered.length} shown">
            The board stops at five so it never scrolls. Narrow the search or the filters to reach
            the other {hidden}; Overview in the context panel counts the whole project.
          </ScreenNote>
        {/if}
      {/if}
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * Two tracks in the middle band, 2fr and 3fr, and full width above and below.
   *
   * The halves are not equal because what they hold is not: Create is five pills
   * of one word each and Review is prose, so the width goes to the side that has
   * sentences to break.
   *
   * **Every row is bounded and the grid packs to the top.** The brief's one hard
   * requirement is that this screen never scrolls, and content-height rows cannot
   * promise that — a project with forty resources or a busy week of activity
   * would each grow a row until the table left the viewport. So the middle band
   * is capped at what its taller half needs, the table is capped at five rows,
   * and whatever height is left over falls below the last band rather than being
   * distributed into rows that would stretch a table's frame past its last row.
   *
   * At 1440x900 less the 44px top bar, the 36px tab strip and the 32px status
   * bar, the plane is 788px and the surface's padding takes 48 of it. The bands
   * come to roughly 610, which is the slack the cap is chosen to keep.
   */
  .board {
    display: grid;
    flex: 1;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    grid-template-rows:
      auto
      minmax(0, calc(var(--token-spacing-unit) * 60))
      auto
      auto;
    grid-template-areas:
      "header  header"
      "create  review"
      "filters filters"
      "work    work";
    align-content: start;
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
  .area-filters {
    grid-area: filters;
  }
  .area-work {
    grid-area: work;
  }

  /**
   * Three entries exactly, derived from what an entry is made of rather than
   * from a measured pixel count — a title line, a caption line, the gap between
   * them and the entry's own padding — plus the 4px of the two seams and the
   * frame's own edges. A hard-coded height here would drift the day the type
   * scale moves, and every term counts: leave out the inter-line gap and the
   * third entry sits six pixels below the frame.
   */
  .feed {
    --entry: calc(
      var(--token-text-body-sm-leading) + var(--token-text-caption-leading) +
        var(--token-spacing-unit) * 5.5
    );
    /* Grid rather than flex, so the list stretches to the band on both axes
       without this file reaching into another component's classes to do it. */
    display: grid;
    min-height: 0;
    height: calc(var(--entry) * 3 + 4px);
  }

  /*
    One column below the width where two tracks stop being tracks worth having,
    and Review goes above Create: stacked, the top band is the one you see first,
    and what is waiting on you outranks what you might start.
  */
  @media (max-width: 60rem) {
    .board {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto auto auto;
      grid-template-areas:
        "header"
        "review"
        "create"
        "filters"
        "work";
    }
  }
</style>
