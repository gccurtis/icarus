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
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import { ToggleGroup, ToggleGroupItem } from "$vendored-components/toggle-group";
  import { actorName, type Resource, type ResourceKind } from "$capabilities/cast";
  import { mentionsForViewer } from "$capabilities/collaboration";
  import { inspectionFor } from "$capabilities/inspecting";
  import { analyses, threads } from "$capabilities/library";
  import { openingFor } from "$capabilities/opening";
  import { activity, people, project, resources } from "$capabilities/project";
  import { workspaceState, type Category } from "$model/client/workspace-state";

  const view = workspaceState();

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
  const it = $derived(project().current);
  const everyone = $derived(people().current);
  const mentions = $derived(mentionsForViewer().current);
  const events = $derived(activity().current);
  const work = $derived(resources().current);
  const everyThread = $derived(threads().current);
  const everyAnalysis = $derived(analyses().current);

  /** The feed holds either mentions or activity; the toggle switches between them. */
  let feed = $state<"mentions" | "activity">("mentions");

  let search = $state("");
  let kind = $state("all");
  let actor = $state("all");
  let sortBy = $state("updated");
  let direction = $state<"asc" | "desc">("asc");

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
    file: "External file",
    finding: "Finding",
    connector: "Connector",
    context: "Context",
    template: "Template"
  };

  const KIND_PLURAL: Record<ResourceKind, string> = {
    document: "Documents",
    slides: "Slide decks",
    spreadsheet: "Spreadsheets",
    research: "Research",
    analysis: "Analyses",
    file: "External files",
    finding: "Findings",
    connector: "Connectors",
    context: "Contexts",
    template: "Templates"
  };

  /**
   * What you can make, one hue each.
   *
   * The palette assigns exactly five hues to no meaning at all — blue, cyan,
   * violet, pink and teal — and those are the five here. Green, red, amber and
   * grey are excluded on purpose: a row is an offer, and an offer wearing the
   * success or danger role reads as a verdict on something.
   *
   * Cyan is taken through its `secondary` name rather than its `active` one. The
   * two are the same hue, but `active` means "currently engaged" everywhere else
   * on the plane, and a permanently cyan row would look selected.
   *
   * Document keeps `interactive` because it is the commonest thing anyone makes
   * here, and blue is the hue the rest of the application already spends on the
   * thing it wants you to press.
   *
   * **Each hue is named twice: a resting edge and a hovered one.** The stack has
   * no gaps, so the seam between two rows is the only thing telling them apart —
   * and a seam that strengthens under the pointer is how a row says it is the
   * one being aimed at without moving, growing or changing colour family.
   */
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
      /** The flask, because that is what a research tab wears — and that is what this opens. */
      key: "research",
      label: "Research chat",
      icon: FlaskConical,
      tint:
        "border-intelligence-border bg-intelligence-surface text-intelligence-text hover:border-intelligence-fill hover:bg-intelligence-surface-hover"
    },
    {
      /** Bars, because that is what an analysis tab wears and what this opens onto. */
      key: "analysis",
      label: "Analysis graph",
      icon: ChartColumn,
      tint:
        "border-secondary-border bg-secondary-surface text-secondary-text hover:border-secondary-fill hover:bg-secondary-surface-hover"
    }
  ] as const;

  /** Which editor a blank thing opens in, and what the strip calls it there. */
  const BLANK = {
    document: { category: "document-editor", noun: "document" },
    slides: { category: "slide-deck-editor", noun: "deck" },
    spreadsheet: { category: "spreadsheet-editor", noun: "spreadsheet" }
  } as const satisfies Record<string, { category: Category; noun: string }>;

  /**
   * The tab strip labels an editor tab by its `resourceId`, so a minted id has to
   * read as a name rather than as a key. The number steps past whatever that
   * category already holds, because `open` is keyed by the id: two blank documents
   * are two things, and two that share a name are one tab.
   */
  const untitled = (category: Category, noun: string): string => {
    const taken = new Set(
      view.tabs.filter((tab) => tab.category === category).map((tab) => tab.resourceId)
    );
    let count = 1;
    while (taken.has(`Untitled ${noun} ${count}`)) count += 1;
    return `Untitled ${noun} ${count}`;
  };

  /**
   * A thread and a chart are each a tab keyed by the thing, and nothing here
   * creates either — so both land on the first one the strip is not already
   * holding, and on the first one there is when it is holding all of them.
   *
   * Inventing an id would put a tab in the strip that no door can answer for;
   * doing nothing would be a control that appears broken.
   */
  const landOnFree = (category: Category, rows: readonly { id: string }[]) => {
    const held = new Set(
      view.tabs.filter((tab) => tab.category === category).map((tab) => tab.resourceId)
    );
    const landing = rows.find((row) => !held.has(row.id)) ?? rows[0];
    if (landing) view.open({ category, resourceId: landing.id });
  };

  const make = (key: (typeof CREATE)[number]["key"]) => {
    if (key === "document" || key === "slides" || key === "spreadsheet") {
      const { category, noun } = BLANK[key];
      view.open({ category, resourceId: untitled(category, noun) });
    } else if (key === "research") {
      landOnFree("research", everyThread);
    } else {
      landOnFree("analysis", everyAnalysis);
    }
  };

  /**
   * What a row opens, by what it is.
   *
   * A body and a thread each earn a tab of their own, keyed by the thing rather
   * than by the category. An analysis and a template are places you return to, so
   * those move the permanent tab onto the row instead of minting one. The
   * remaining kinds have no category at all — a file, a finding, a connector and a
   * Context are things you look at rather than places you go — so opening one
   * means opening its lens, which is the same thing the resource lens does.
   */
  const launch = (row: Resource) => {
    const target = openingFor(row.kind, row.id, row.name);
    if (target) {
      view.open(target);
      return;
    }
    const { key, selection } = inspectionFor(row.kind, row.id, row.name);
    view.inspect(key, selection);
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
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "kind")
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

  /**
   * Each row with the lens that answers for it, resolved once rather than at
   * every click and again at every render.
   *
   * The selection a row would set is also how the row knows it is the selected
   * one: a finding row sends `f-saidi` and a thread row sends `th-feeder`, so
   * comparing the selection against the row's own id would light nothing up.
   */
  const listed = $derived(
    ordered.map((row) => ({ row, ...inspectionFor(row.kind, row.id, row.name) }))
  );

  /**
   * Both filters offer what the work contains rather than what the vocabulary
   * allows, for the same reason.
   *
   * An agent and a connector both update resources and neither is a member, so a
   * roster would leave five of the twelve rows unreachable. A hand-written list
   * of kinds fails the other way round: it is a second record of what a project
   * can hold, and the first row it falls behind on is a row you can see in the
   * table and cannot select in the control offered for selecting it.
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
    search = "";
    kind = "all";
    actor = "all";
  };
</script>

<ScreenSurface wide>
  <div class="board">
    <!-- Identity across the top: what this project is, and who is in it. -->
    <div class="area-header">
      <ScreenHeader title={it.name} about={it.description}>
        {#snippet actions()}
          <PanelFaces
            actors={faces}
            limit={3}
            label="People in this project"
            onselect={(id) => view.inspect("collaboration.person", { kind: "person", id })}
          >
            {#snippet overflow()}
              <!--
                The rest of the roster, under the chip that hid them. A menu
                rather than a lens: "who else is in this project" is a list of
                names, and sending someone to a panel to read four of them is a
                journey for an answer that fits where the question was asked.
              -->
              <DropdownMenu.Group>
                <DropdownMenu.GroupHeading>In this project</DropdownMenu.GroupHeading>
                {#each faces as face (face.id)}
                  {@const person = everyone.find((row) => row.id === face.id)}
                  <DropdownMenu.Item
                    onSelect={() =>
                      view.inspect("collaboration.person", { kind: "person", id: face.id })}
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

    <!--
      Create. Five pills, stacked, each in its own hue — the colour is the thing
      you aim at, so the labels can stay plain nouns rather than "New document"
      five times.
    -->
    <div class="area-create">
      <ScreenGroup label="Create">
        <div class="create" role="group" aria-label="What you can make">
          {#each CREATE as pill (pill.key)}
            {@const Icon = pill.icon}
            <button
              type="button"
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

    <!--
      Review. The band is named like Create's, and the switch between its two
      faces rides at the far end of the label row rather than over the list —
      which puts every control on this board in the same place relative to what
      it acts on.

      The frame is exactly three entries tall in both states, so switching feeds
      never moves the table underneath. A fourth entry scrolls inside the frame
      rather than growing it — the band has a height and the list gives in to it.
    -->
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
              () => feed,
              (next: string) => {
                if (next === "mentions" || next === "activity") feed = next;
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
          bind:sort={sortBy}
          bind:value={search}
        >
          <select
            class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
            bind:value={kind}
            aria-label="Kind"
          >
            <option value="all">All kinds</option>
            {#each kinds as option (option)}
              <option value={option}>{KIND_PLURAL[option]}</option>
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

          {#snippet order()}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={DIRECTION[sortBy][direction]}
              title={DIRECTION[sortBy][direction]}
              onclick={() => (direction = direction === "asc" ? "desc" : "asc")}
            >
              {#if direction === "asc"}
                <ArrowUpNarrowWide aria-hidden="true" />
              {:else}
                <ArrowDownNarrowWide aria-hidden="true" />
              {/if}
            </Button>
          {/snippet}
        </ScreenFilters>

        {#if listed.length === 0}
          <ScreenEmpty kind="no-matches" title="Nothing in this project matches" onclear={clear}>
            The search reaches every kind — documents, decks, grids, threads, findings and connector
            files alike.
          </ScreenEmpty>
        {:else}
          <ScreenTable scroll columns={["Name", "Kind", "Updated", "Updated by"]}>
            {#each listed as entry (entry.row.id)}
              <ScreenRow selected={view.selection?.id === entry.selection.id}>
                <ScreenCell>
                  <!--
                    Double-click opens the row; a single click selects and
                    inspects. Two acts, and conflating them would mean you could
                    not look at anything without leaving the board you came to.
                  -->
                  <span
                    role="presentation"
                    ondblclick={() => launch(entry.row)}
                    class="flex items-center"
                  >
                    <button
                      type="button"
                      class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
                      onclick={() => view.inspect(entry.key, entry.selection)}
                    >
                      {entry.row.name}
                    </button>
                  </span>
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
    /* Four entries, the three seams between them, and the frame's two edges. */
    --band: calc(var(--entry) * 4 + 5px);

    display: grid;
    flex: 1;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    grid-template-rows:
      auto
      /* the band, plus `ScreenGroup`'s 28px label row and its 8px gap */
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

  /*
    One column below the width where two tracks stop being tracks worth having,
    and Review goes above Create: stacked, the top band is the one you see first,
    and what is waiting on you outranks what you might start.

    Stacked, the promise changes and says so. Four bands cannot all keep their
    height in one column, so every row goes back to its content and the surface
    takes the scrolling — a table squeezed into whatever three other bands left
    over is a table showing two rows, which is worse than a page that scrolls.
  */
  @media (max-width: 60rem) {
    .board {
      /* Content height, so the bands keep theirs and the surface does the
         scrolling. Left as a flexed, bounded box the rows would be squeezed
         evenly instead, which shortens every band to make room for the one
         that could not fit. */
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

  /*
    Too short for three bands, and the elastic one is the only one that can give
    — so below this the board stops being a fixed plane rather than shrinking
    Resources to a heading and two rows. The cap is what Header, Create and
    Review need plus enough of the table to be worth calling a table.
  */
  @media (max-height: 46rem) {
    .board {
      flex: none;
      min-height: auto;
      grid-template-rows: auto auto auto;
      align-content: start;
    }
  }
</style>
