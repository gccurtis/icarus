<script lang="ts">
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import PresentationIcon from "@lucide/svelte/icons/presentation";
  import SheetIcon from "@lucide/svelte/icons/sheet";
  import Upload from "@lucide/svelte/icons/upload";

  import { PanelFaces } from "$lib/unique-components/panel";
  import {
    ScreenAction,
    ScreenBanner,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import { mentionsForViewer } from "$mock-capabilities/collaboration";
  import { activity, health, people, project, resources } from "$mock-capabilities/project";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Project Overview — the only state this screen has.
   *
   * `docs/screen-panel-views/screens/project-overview/workspace.md` is the
   * specification. Three bands: identity across the top, then the two things you
   * came for side by side — what to make, and what is waiting on you — then
   * everything the project contains.
   *
   * **A row is a thing, not a health report.** There is no Status column on the
   * work table: what cannot proceed is in *Needs attention* and in the status bar,
   * and everything else is left to be what it is.
   */
  const it = $derived(project().current);
  const everyone = $derived(people().current);
  const mentions = $derived(mentionsForViewer().current);
  const events = $derived(activity().current);
  const problems = $derived(health().current);
  const work = $derived(resources().current);

  /** The feed holds either mentions or activity; the chips switch between them. */
  let feed = $state<"mentions" | "activity">("mentions");

  let search = $state("");
  let kind = $state("all");
  let actor = $state("all");
  let order = $state("updated");

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

  const CREATE = [
    { label: "New document", icon: FilePlus, key: "document" },
    { label: "New slide deck", icon: PresentationIcon, key: "slides" },
    { label: "New spreadsheet", icon: SheetIcon, key: "spreadsheet" },
    { label: "Upload file", icon: Upload, key: "upload" }
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

  const shown = $derived(
    work
      .filter((row) => kind === "all" || row.kind === kind)
      .filter((row) => actor === "all" || row.updatedBy === actor)
      .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const faces = $derived(
    everyone
      .filter((person) => person.at !== undefined)
      .map((person) => ({ id: person.id, name: person.name, kind: "person" as const }))
  );
</script>

<ScreenSurface wide>
  <div class="board">
    <!--
      Identity across the top: the project's name and description, who is in it
      right now, and the way to its settings.
    -->
    <div class="area-header">
      <ScreenHeader title={it.name} about={it.description}>
        {#snippet actions()}
          <PanelFaces
            actors={faces}
            label="Here now"
            onselect={(id) => mockWorkbench.inspect("actor.person", { kind: "person", id })}
            onoverflow={() => mockWorkbench.inspect("actor.people")}
          />
          <Button variant="outline" size="sm">Settings</Button>
        {/snippet}
      </ScreenHeader>
    </div>

    <!--
      Making a document is one line, not a poster: a card row here would give
      creation more visual weight than the work that already exists.
    -->
    <div class="area-create">
      <div class="flex flex-col gap-1">
        {#each CREATE as action (action.key)}
          <ScreenAction label={action.label} icon={action.icon} />
        {/each}
      </div>
    </div>

    <!--
      Directly under Create, and only present when something is wrong. The one
      place on the screen that uses the error role; empty is the normal state and
      the region collapses to nothing rather than saying "all well".
    -->
    {#if problems.length > 0}
      <div class="area-attention">
        <ScreenBanner title={problems[0].title} meta={problems[0].detail} tone="attention">
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              onclick={() => mockWorkbench.inspect("project.connector")}
            >
              Reconnect
            </Button>
          {/snippet}
        </ScreenBanner>
      </div>
    {/if}

    <div class="area-feed flex min-h-0 flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <Button
          variant={feed === "mentions" ? "default" : "outline"}
          size="sm"
          onclick={() => (feed = "mentions")}
        >
          Mentions
          <span class="tabular-nums opacity-70">{mentions.length}</span>
        </Button>
        <Button
          variant={feed === "activity" ? "default" : "outline"}
          size="sm"
          onclick={() => (feed = "activity")}
        >
          Activity
        </Button>
      </div>

      <div class="border-border-subtle rounded-panel flex min-h-0 flex-col overflow-y-auto border">
        {#if feed === "mentions"}
          {#each mentions as mention (mention.id)}
            <button
              type="button"
              class="border-border-subtle hover:bg-surface-hover flex flex-col gap-0.5 border-b px-3 py-2 text-start last:border-b-0"
              onclick={() =>
                mockWorkbench.inspect("comment.thread", { kind: "comment", id: mention.id })}
            >
              <span class="text-body-sm text-ink-primary">
                <strong>{mention.author === "mira" ? "Mira Jain" : "Tomas Kaur"}</strong>
                mentioned you on
                <strong>{mention.resource}</strong>
                {#if mention.location}<span class="text-ink-muted">· {mention.location}</span>{/if}
              </span>
              <span class="text-caption text-ink-secondary">"{mention.excerpt}"</span>
              <span class="text-caption text-ink-muted tabular-nums">{mention.age}</span>
            </button>
          {:else}
            <ScreenEmpty title="Nothing addressed to you">
              A mention is the one thing worth interrupting for. Machine noise is in Health.
            </ScreenEmpty>
          {/each}
        {:else}
          {#each events as event (event.id)}
            <button
              type="button"
              class="border-border-subtle hover:bg-surface-hover flex flex-col gap-0.5 border-b px-3 py-2 text-start last:border-b-0"
              onclick={() =>
                mockWorkbench.inspect("project.activity", { kind: "activity", id: event.id })}
            >
              <span class="text-body-sm text-ink-primary">
                <strong>{event.actor}</strong>
                {event.verb}
                <strong>{event.subject}</strong>
              </span>
              <span class="text-caption text-ink-muted tabular-nums">{event.at}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!--
      The count is matched-of-total, so a filtered view never looks like the whole
      project.
    -->
    <div class="area-filters">
      <ScreenFilters
        placeholder="Search this project"
        matched={shown.length}
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
          {#each everyone as person (person.id)}
            <option value={person.name}>{person.name}</option>
          {/each}
        </select>
      </ScreenFilters>
    </div>

    <!--
      Everything the project contains, as one table. Every kind is here, because
      "what is in this project" is one question.
    -->
    <div class="area-work min-h-0">
      <ScreenTable columns={["Name", "Kind", "Updated", "Updated by"]}>
        {#each shown as row (row.id)}
          <ScreenRow>
            <ScreenCell
              name={row.name}
              onselect={() =>
                mockWorkbench.inspect("project.resource", { kind: "resource", id: row.id })}
            />
            <ScreenCell>{KIND_LABEL[row.kind]}</ScreenCell>
            <ScreenCell num>{row.updated}</ScreenCell>
            <ScreenCell>{row.updatedBy}</ScreenCell>
          </ScreenRow>
        {/each}
      </ScreenTable>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. Two
   * tracks, 2fr and 3fr: what you can make is a short list and what is waiting on
   * you is prose, so the second gets the width.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 2fr 3fr;
    grid-template-areas:
      "header    header"
      "create    feed"
      "attention feed"
      "filters   filters"
      "work      work";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-create {
    grid-area: create;
  }
  .area-attention {
    grid-area: attention;
  }
  .area-feed {
    grid-area: feed;
    max-height: calc(var(--token-spacing-unit) * 90);
  }
  .area-filters {
    grid-area: filters;
  }
  .area-work {
    grid-area: work;
  }

  /* One column below the width where two 2fr/3fr tracks stop being readable. */
  @media (max-width: 60rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "header"
        "attention"
        "feed"
        "create"
        "filters"
        "work";
    }
  }
</style>
