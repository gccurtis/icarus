<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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
  import { inspectionFor } from "$app-views/categories/project-overview/procedures/inspecting";
  import { mentions as mentionsForViewer } from "$app-views/categories/project-overview/procedures/mentions";
  import { openingFor } from "$app-views/categories/project-overview/procedures/opening";
  import { people } from "$app-views/categories/project-overview/procedures/people";
  import { project } from "$app-views/categories/project-overview/procedures/project";
  import { projectId, viewerId } from "$app-views/categories/project-overview/procedures/scope";
  import { createsResource } from "$app-views/categories/project-overview/procedures/creating";
  import { resourcesIn, type Resource, type ResourceKind } from "$app-views/categories/project-overview/procedures/resources";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  const id = $derived(projectId());
  const viewer = $derived(viewerId());
  const resourceIndex = readProjectResourceIndex();

  const it = $derived(project(id));
  const everyone = $derived(people(id));
  const mentions = $derived(mentionsForViewer(id, viewer, now));
  const events = $derived(activity(id, now));
  const work = $derived(
    resourcesIn(resourceIndex.ready ? resourceIndex.current : undefined, now)
  );

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

  let creating = $state<"document" | "slides" | "spreadsheet">();
  let creationError = $state<string>();

  const make = (key: (typeof CREATE)[number]["key"]) => {
    if (key === "document" || key === "slides" || key === "spreadsheet") {
      if (creating !== undefined) return;

      creating = key;
      void createsResource({
        view,
        target: key,
        live: () => live,
        refused: (message) => {
          creationError = message;
        },
        ended: () => {
          creating = undefined;
        }
      });
      return;
    }

    if (key === "research") {
      alert("Starting a represented research chat is not wired up yet.");
      return;
    }

    alert("Creating a represented analysis graph is not wired up yet.");
  };

  const launch = (row: Resource) => {
    const target = openingFor(row);
    if (target) {
      view.open(target);
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
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "kind")
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
    kind === "all" || (kind === WITHOUT_FILES ? of !== "file" : of === kind);

  const matched = $derived(
    work
      .filter((row) => ofKind(row.kind))
      .filter((row) => actor === "all" || row.updatedBy === actor)
      .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const ordered = $derived(
    [...matched].sort((a, b) => (direction === "asc" ? 1 : -1) * compare(a, b))
  );

  const listed = $derived(
    ordered.map((row) => ({ row, ...inspectionFor(row) }))
  );

  const kinds = $derived(
    [...new Set(work.map((row) => row.kind))].sort((a, b) =>
      KIND_PLURAL[a].localeCompare(KIND_PLURAL[b])
    )
  );

  const actors = $derived(
    [...new Set(work.map((row) => row.updatedBy))].sort((a, b) => a.localeCompare(b))
  );

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
        {#if creationError}
          <ScreenNote tone="gap">Could not create the resource: {creationError}</ScreenNote>
        {/if}
        <div class="create" role="group" aria-label="What you can make">
          {#each CREATE as pill (pill.key)}
            {@const Icon = pill.icon}
            <button
              type="button"
              disabled={(pill.key === "document" ||
                pill.key === "slides" ||
                pill.key === "spreadsheet") &&
                creating !== undefined}
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
                    view.inspect("general.comment", { kind: "comment", id: mention.id })}
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

    <div class="area-resources">
      <ScreenGroup label="Resources" fill>
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
            {#if kinds.includes("file")}
              <option value={WITHOUT_FILES}>Less external</option>
            {/if}
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

  .area-create,
  .area-review,
  .area-resources {
    display: flex;
    min-height: 0;
    flex-direction: column;
  }

  .feed {
    display: grid;
    min-height: 0;
    height: var(--band);
  }

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
