<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileText from "@lucide/svelte/icons/file-text";
  import Folder from "@lucide/svelte/icons/folder";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Quote from "@lucide/svelte/icons/quote";
  import Search from "@lucide/svelte/icons/search";
  import Settings from "@lucide/svelte/icons/settings";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Upload from "@lucide/svelte/icons/upload";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";

  import { clientModel, type Tab, type TabTarget } from "$model/client";

  /**
   * The project overview — the permanent first tab, and what the work surface
   * shows on a first load and whenever every closable tab has been closed.
   *
   * Three bands, exactly as
   * `docs/screen-panel-views/project-overview/workspace.md` draws them: identity
   * across the top, then the two things you came for side by side — what to make,
   * and what is waiting on you — then everything the project contains.
   *
   * **There is no Status column.** A row is a thing, not a health report. What
   * cannot proceed appears in Needs attention and in the status bar, and
   * everything else is left to be what it is.
   *
   * **Fixture content.** Every list here stands in for a project-scoped query
   * that no capability can answer yet. What is real is the wiring: selecting
   * anything sets the tab's inspection key, so the inspector follows this
   * surface, and opening a resource mints a tab or activates the one already
   * holding it.
   */
  let { tab }: { tab: Tab } = $props();

  const { workbench } = clientModel();

  // A singleton screen has nothing about it that varies, but every screen root
  // takes the same prop — that sameness is what lets the workspace hold one
  // total map.
  // svelte-ignore state_referenced_locally
  void tab;

  const inspected = $derived(workbench.inspectedNode);

  const PROJECT = {
    name: "Northwind Grid Resilience",
    about: "Winter-storm hardening case for the 2026 rate filing."
  };

  const HERE_NOW = [
    { initials: "AR", name: "Ana Reyes — you" },
    { initials: "TK", name: "Tomas Kaur" },
    { initials: "MJ", name: "Mira Jain" }
  ];

  const CREATE = [
    { label: "New document", icon: FileText, resourceType: "document" },
    { label: "New slide deck", icon: Presentation, resourceType: "slides" },
    { label: "New spreadsheet", icon: Sheet, resourceType: "spreadsheet" }
  ] as const;

  const MENTIONS = [
    {
      initials: "MJ",
      from: "Mira Jain",
      what: "mentioned you in a comment on Q3 Resilience Memo",
      quote: "“@ana can you confirm 1,842,000 against the relay log?”",
      when: "2h"
    },
    {
      initials: "TK",
      from: "Tomas Kaur",
      what: "mentioned you on Board Update — October, slide 4",
      quote: "“@ana is this the chart you wanted on the scale from slide 3?”",
      when: "4h"
    },
    {
      initials: "MJ",
      from: "Mira Jain",
      what: "mentioned you in Outage Cost Model, C2",
      quote: "“@ana corrected total or the old one?”",
      when: "1d"
    },
    {
      initials: "GA",
      from: "Grid Analyst",
      what: "replied in a thread you follow on Feeder 12",
      quote: "Both failures trace to the same relay pair.",
      when: "1d"
    }
  ];

  /**
   * Every kind the project holds, in one table, because "what is in this
   * project" is one question. A Research thread is here and is not a resource —
   * the row dispatches by what it is, which is why the inspection key varies.
   */
  const WORK = [
    {
      name: "Q3 Resilience Memo",
      icon: FileText,
      kind: "Document",
      updated: "4 minutes ago",
      by: "Ana Reyes",
      inspect: "project.resource"
    },
    {
      name: "Board Update — October",
      icon: Presentation,
      kind: "Slide deck",
      updated: "2 hours ago",
      by: "Tomas Kaur",
      inspect: "project.resource"
    },
    {
      name: "Outage Cost Model",
      icon: Sheet,
      kind: "Spreadsheet",
      updated: "Yesterday",
      by: "Nightly filing digest",
      inspect: "project.resource"
    },
    {
      name: "Why did Feeder 12 fail twice?",
      icon: FlaskConical,
      kind: "Research",
      updated: "Yesterday",
      by: "Ana Reyes",
      inspect: "project.research-thread"
    },
    {
      name: "Outage minutes by substation",
      icon: ChartColumn,
      kind: "Analysis",
      updated: "3 days ago",
      by: "Mira Jain",
      inspect: "project.resource"
    },
    {
      name: "NERC-2025-winter-review.pdf",
      icon: Folder,
      kind: "External file",
      updated: "4 days ago",
      by: "SharePoint — Ops Reports",
      inspect: "project.file"
    },
    {
      name: "Undergrounding cut SAIDI 38% in Ward 3",
      icon: Quote,
      kind: "Finding",
      updated: "5 days ago",
      by: "Grid Analyst",
      inspect: "project.resource"
    },
    {
      name: "SharePoint — Ops Reports",
      icon: Link2,
      kind: "Connector",
      updated: "6 days ago",
      by: "—",
      inspect: "project.connector"
    }
  ];

  /**
   * The resource kinds a tab can hold, taken from `TabTarget` rather than
   * restated. Adding an editor to the model adds it here, and a `CREATE` entry
   * naming one that does not exist fails to compile.
   */
  type ResourceType = Extract<TabTarget, { kind: "resource" }>["resourceType"];

  const newTarget = (resourceType: ResourceType): TabTarget => ({
    kind: "resource",
    resourceType,
    resourceId: `untitled-${resourceType}`
  });
</script>

<div class="overview">
  <header class="header">
    <div class="identity">
      <h1 class="name">{PROJECT.name}</h1>
      <p class="about">{PROJECT.about}</p>
    </div>
    <div class="who">
      {#each HERE_NOW as person (person.initials)}
        <button
          type="button"
          class="avatar"
          title={person.name}
          aria-label={person.name}
          onclick={() => workbench.inspect("actor.person")}
        >
          {person.initials}
        </button>
      {/each}
      <button
        type="button"
        class="avatar more"
        title="4 more members"
        aria-label="4 more members"
        onclick={() => workbench.inspect("project.people")}
      >
        +4
      </button>
      <button type="button" class="settings" onclick={() => workbench.inspect("project.self")}>
        <Settings size={14} aria-hidden="true" />
        Settings
      </button>
    </div>
  </header>

  <!--
    Create is a compact vertical list rather than a row of cards. Making a
    document is one line, not a poster — a card row here would give creation
    more visual weight than the work that already exists.
  -->
  <section class="create" aria-label="Create">
    <span class="eyebrow">Create</span>
    <div class="stack">
      {#each CREATE as entry (entry.label)}
        {@const Icon = entry.icon}
        <button
          type="button"
          class="entry"
          onclick={() => workbench.open(newTarget(entry.resourceType))}
        >
          <Icon size={15} aria-hidden="true" />
          {entry.label}
        </button>
      {/each}
      <button
        type="button"
        class="entry"
        onclick={() => workbench.inspect("project.file")}
      >
        <Upload size={15} aria-hidden="true" />
        Upload file
      </button>
    </div>
  </section>

  <!--
    Only present when something is genuinely wrong, and the one place on this
    screen that uses the danger role. Empty is the normal state, and the region
    collapses to nothing rather than announcing that all is well.
  -->
  <section class="attention" aria-label="Needs attention">
    <button
      type="button"
      class="broken"
      onclick={() => workbench.inspect("project.connector")}
    >
      <Link2 size={15} aria-hidden="true" />
      <span class="broken-text">
        <span class="broken-title">SharePoint can't sync</span>
        <span class="broken-sub">Authentication expired — reconnect</span>
      </span>
    </button>
  </section>

  <section class="feed" aria-label="Mentions">
    <div class="feed-head">
      <span class="tab-chip is-on">Mentions</span>
      <span class="tab-chip">Activity</span>
      <span class="count">4 new</span>
    </div>
    <div class="cards">
      {#each MENTIONS as mention (mention.quote)}
        <button
          type="button"
          class="mention"
          class:selected={inspected === "project.mention"}
          onclick={() => workbench.inspect("project.mention")}
        >
          <span class="avatar" aria-hidden="true">{mention.initials}</span>
          <span class="mention-text">
            <span class="mention-what"><b>{mention.from}</b> {mention.what}</span>
            <span class="mention-quote">{mention.quote}</span>
          </span>
          <span class="when">{mention.when}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="filters" aria-label="Filter project work">
    <span class="search">
      <Search size={14} aria-hidden="true" />
      Search project work
    </span>
    <button type="button" class="filter">All kinds <ChevronDown size={12} aria-hidden="true" /></button>
    <button type="button" class="filter">Anyone <ChevronDown size={12} aria-hidden="true" /></button>
    <button type="button" class="filter">Updated <ChevronDown size={12} aria-hidden="true" /></button>
    <span class="count">24 of 24</span>
  </section>

  <section class="work" aria-label="Project work">
    <table>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Kind</th>
          <th scope="col">Updated</th>
          <th scope="col">Updated by</th>
        </tr>
      </thead>
      <tbody>
        {#each WORK as item (item.name)}
          {@const Icon = item.icon}
          <tr>
            <td>
              <button type="button" class="cell-name" onclick={() => workbench.inspect(item.inspect)}>
                <Icon size={14} aria-hidden="true" />
                {item.name}
              </button>
            </td>
            <td>{item.kind}</td>
            <td class="num">{item.updated}</td>
            <td>
              {#if item.by === "—"}
                <span class="unattributed">—</span>
              {:else}
                <button type="button" class="who-link" onclick={() => workbench.inspect("actor.person")}>
                  {item.by}
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>

<style>
  /*
   * The grid is a transcription of the Layout table in
   * docs/screen-panel-views/project-overview/workspace.md. Named areas rather
   * than placement rules, so the CSS and the document can be read against each
   * other line for line.
   */
  .overview {
    display: grid;
    grid-template-columns: 2fr 3fr;
    grid-template-areas:
      "header header"
      "create feed"
      "attention feed"
      "filters filters"
      "work work";
    align-content: start;
    gap: calc(var(--token-spacing-unit) * 5) calc(var(--token-spacing-unit) * 6);
    height: 100%;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 6);
    /* Every surface scrolls; none spends width saying so. */
    scrollbar-width: none;
  }

  .overview::-webkit-scrollbar {
    display: none;
  }

  .header {
    grid-area: header;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 4);
    flex-wrap: wrap;
  }

  .name {
    font-size: var(--token-text-h3);
    line-height: var(--token-text-h3-leading);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }

  .about {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: calc(var(--token-spacing-unit) * 1) 0 0;
  }

  .who {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .avatar {
    width: calc(var(--token-spacing-unit) * 7);
    height: calc(var(--token-spacing-unit) * 7);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--token-color-interactive-border);
    border-radius: 999px;
    background-color: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
    font-size: var(--token-text-caption);
    font-weight: 600;
    cursor: pointer;
  }

  .more {
    border-color: var(--token-color-inactive-border);
    background-color: var(--token-color-inactive-surface);
    color: var(--token-color-inactive-text);
  }

  .settings,
  .filter,
  .entry {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: calc(var(--token-spacing-unit) * 7);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-panel);
    font: inherit;
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-primary);
    cursor: pointer;
  }

  .settings:hover,
  .filter:hover,
  .entry:hover {
    background-color: var(--token-surface-panel-hover);
    border-color: var(--token-color-interactive-border);
  }

  .eyebrow {
    font-size: var(--token-text-caption);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--token-ink-muted);
  }

  .create {
    grid-area: create;
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .entry {
    justify-content: flex-start;
    min-height: calc(var(--token-spacing-unit) * 9);
    text-align: start;
  }

  .attention {
    grid-area: attention;
  }

  .broken {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    width: 100%;
    padding: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-color-danger-border);
    border-radius: var(--token-radius-control);
    background-color: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .broken-text {
    display: flex;
    flex-direction: column;
  }

  .broken-title {
    font-size: var(--token-text-body-sm);
    font-weight: 500;
  }

  .broken-sub {
    font-size: var(--token-text-caption);
  }

  .feed {
    grid-area: feed;
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    min-width: 0;
  }

  .feed-head {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .tab-chip {
    font-size: var(--token-text-caption);
    padding: calc(var(--token-spacing-unit) * 0.5) calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    color: var(--token-ink-secondary);
  }

  .is-on {
    border-color: var(--token-color-active-border);
    background-color: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .count {
    margin-inline-start: auto;
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  .cards {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background-color: var(--token-surface-panel);
    overflow: hidden;
  }

  .mention {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2.5);
    padding: calc(var(--token-spacing-unit) * 2.5) calc(var(--token-spacing-unit) * 3);
    border: none;
    border-bottom: 1px solid var(--token-border-subtle);
    background: none;
    font: inherit;
    text-align: start;
    color: var(--token-ink-primary);
    cursor: pointer;
  }

  .mention:last-child {
    border-bottom: none;
  }

  .mention:hover {
    background-color: var(--token-surface-panel-hover);
  }

  .selected {
    background-color: var(--token-color-active-surface);
  }

  .mention .avatar {
    cursor: inherit;
  }

  .mention-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .mention-what {
    font-size: var(--token-text-body-sm);
  }

  .mention-quote {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .when {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .filters {
    grid-area: filters;
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    flex-wrap: wrap;
  }

  .search {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    flex: 1;
    min-width: 180px;
    max-width: 300px;
    min-height: calc(var(--token-spacing-unit) * 7);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-panel);
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }

  .work {
    grid-area: work;
    min-width: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    overflow: hidden;
  }

  th {
    font-size: var(--token-text-caption);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--token-ink-muted);
    text-align: start;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  td {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-secondary);
    padding: 0 calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background-color: var(--token-surface-panel-hover);
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .cell-name,
  .who-link {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: calc(var(--token-spacing-unit) * 9);
    border: none;
    background: none;
    font: inherit;
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-primary);
    text-align: start;
    cursor: pointer;
  }

  .who-link {
    color: var(--token-color-interactive-text);
  }

  .who-link:hover {
    text-decoration: underline;
  }

  .unattributed {
    color: var(--token-ink-muted);
  }
</style>
