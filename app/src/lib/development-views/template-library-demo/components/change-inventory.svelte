<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import Database from "@lucide/svelte/icons/database";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import PanelsTopLeft from "@lucide/svelte/icons/panels-top-left";

  type Area = "all" | "data" | "server" | "views" | "reference";

  const CHANGES = [
    {
      area: "data",
      path: "seed/templates.json",
      title: "Representative template bodies",
      detail: "Ten document, slide-deck and spreadsheet templates carry real portable bodies, tags, variables, owners and revisions.",
      icon: Database
    },
    {
      area: "data",
      path: "seed/documents.json · seed/slideDecks.json · seed/spreadsheets.json",
      title: "Usage provenance",
      detail: "Ten represented resources point back to templates so the recent shelf is derived rather than mocked.",
      icon: Database
    },
    {
      area: "data",
      path: "seed/templateVersions.json · seed/*Snapshots.json · seed/sheetCells.json",
      title: "Version, body and cell baselines",
      detail: "Every template has one exact current-version snapshot; every seeded resource has a leader body, and both spreadsheet examples have materialized visible cells. No fictional older history is invented.",
      icon: Database
    },
    {
      area: "data",
      path: "seed/activity.json · seed/resourceSets.json",
      title: "Connector-era references",
      detail: "Activity targets the represented connector, while the evidence set and Template defaults use resources that actually exist; retired external-file and connection references are absent.",
      icon: Database
    },
    {
      area: "server",
      path: "capabilities/templates/…",
      title: "Template boundary",
      detail: "Seven procedures cover library read, detail read, create, update, duplicate, remove and instantiate. Visibility is owner-only; defaults, portable bodies, path-safe ids, safe revisions and refusals are validated at the boundary. Invalid legacy rows are quarantined instead of crashing or propagating.",
      icon: Braces
    },
    {
      area: "server",
      path: "capabilities/project-resources/…",
      title: "Scoped resource index and creation",
      detail: "Two procedures expose one closed, corrupt-row-quarantining metadata projection with project-authorized actor names, and create editor-ready blank documents/decks with server-derived project, actor, and Untitled suffix. Template Use refreshes this same Project Overview cache key.",
      icon: Braces
    },
    {
      area: "server",
      path: "capabilities/store/…",
      title: "Fail-closed compatibility Store",
      detail: "Generic writes are disabled. Remaining reads use an honest projected-result type, an explicit table/field allowlist, project filtering, membership-limited users, and no credentials, provenance, template bodies or history.",
      icon: Braces
    },
    {
      area: "server",
      path: "model/server/store/{definition,types,methods/shared/persist,test}/…",
      title: "Stable identity and bounded table writes",
      detail: "Opaque UUID row ids eliminate delete-and-reuse ABA targeting. Collection changes admit first and persist once; each table swaps through a sibling next-file before live memory changes. Cross-table transactions remain unresolved.",
      icon: Braces
    },
    {
      area: "views",
      path: "app-views/categories/new-tab/{content/launcher,procedures/{library,opening,resources,templates}}/…",
      title: "Capability-backed Template launcher",
      detail: "New Tab template cards, recent document/deck resources, and project search use represented indexes instead of disconnected mocks, then hand focus to the singleton library. Document/deck pills create real scoped resources with server-owned blank names; unsupported id hand-offs explain their limitation instead of opening a mock.",
      icon: FilePenLine
    },
    {
      area: "views",
      path: "app-views/categories/templates/procedures/…",
      title: "View-facing read model",
      detail: "Turns capability answers into library filters, recency, counts and inspector facts, while workspace-wide single-flight shares matching pending writes across content, context, inspector, and remounts.",
      icon: FilePenLine
    },
    {
      area: "views",
      path: "app-views/categories/templates/content/library.svelte",
      title: "Library centre",
      detail: "Ten-item recent shelf, filterable table, sort direction, synchronized selection and empty states.",
      icon: PanelsTopLeft
    },
    {
      area: "views",
      path: "app-views/categories/templates/context/overview-library.svelte",
      title: "Library context",
      detail: "A light New template section uses a colored type toggle and required generated working names; Library carries its total and compact availability counts. Project and Shared remain zero until their schema authority is approved.",
      icon: PanelsTopLeft
    },
    {
      area: "views",
      path: "app-views/categories/templates/inspector/template.svelte",
      title: "Template inspector",
      detail: "Name, fixed-height description, and variable help text autosave in place; stable keys and explicit default selections remain readable. Use, Duplicate, and Delete form one compact action group, and tag creation stays above the tags it changes.",
      icon: PanelsTopLeft
    },
    {
      area: "views",
      path: "components/authored/{carousel-shelf,panel/panel-button,screen/{screen-card,screen-row,screen-shelf}}/…",
      title: "Shared shelf, selection and focus semantics",
      detail: "Wheel, Shift-wheel, trackpad, touch, keyboard, scrollbar, and pointer dragging all move the recessed shelf. Edge shadows reveal overflow, hover changes only the border, and selected cards retain their active surface.",
      icon: PanelsTopLeft
    },
    {
      area: "views",
      path: "app-views/categories/project-overview/{content,procedures}/…",
      title: "Project resource integration",
      detail: "Project Overview preserves loading and error states from the closed resource index, advances relative time, serializes blank creation, writes valid leaders, and refreshes immediately after template use without generic Store cache calls.",
      icon: FilePenLine
    },
    {
      area: "views",
      path: "model/client/workspace-state/{definition,types,index,methods,test,workspace-state.md}/…",
      title: "Safe workspace persistence and command lifetime",
      detail: "Open, close, and inspect omit absent optional fields, while WorkspaceState owns and tests a structured single-flight registry so one pending durable intent runs once across every pane and remount in that workspace.",
      icon: FilePenLine
    },
    {
      area: "views",
      path: "surfaces/{status-bar,tab-bar}/procedures/resource-name.ts",
      title: "Subject-capability template naming",
      detail: "Focused templates are named through the Template detail procedure; generic Store naming no longer attempts to cross the protected template or version boundary.",
      icon: FilePenLine
    },
    {
      area: "views",
      path: "app-views/categories/templates/content/editor.svelte · templates/templates.md",
      title: "Retired bespoke editor and updated contract",
      detail: "The obsolete mock authoring surface now points back to the library; the category documentation records the real library and deferred authoring boundary.",
      icon: FilePenLine
    },
    {
      area: "reference",
      path: "development-views/template-library-demo/…",
      title: "Future-state reference",
      detail: "Live product stage plus behavior, lifecycle, data-model, change and decision documentation.",
      icon: FilePlus2
    },
    {
      area: "reference",
      path: "routes/app/[project]/reference/templates + routes/demo/templates",
      title: "Scoped and discoverable routes",
      detail: "The friendly demo URL redirects into app scope; the reference itself remains a thin route.",
      icon: FilePlus2
    },
    {
      area: "reference",
      path: "development-views/demo/components/demo-index.svelte · template-library-demo/**/*.md",
      title: "Reference discovery and maintenance notes",
      detail: "The demo index links the working reference, while colocated notes explain its live composition, safe owner-only fallback and deferred decisions.",
      icon: FilePlus2
    }
  ] as const;

  const FILTERS: readonly Area[] = ["all", "data", "server", "views", "reference"];
  let filter = $state<Area>("all");
  const visible = $derived(
    filter === "all" ? CHANGES : CHANGES.filter((change) => change.area === filter)
  );
</script>

<div class="inventory">
  <div class="toolbar">
    <div class="filters" role="group" aria-label="Filter change inventory">
      {#each FILTERS as option (option)}
        <button
          type="button"
          class:active={filter === option}
          aria-pressed={filter === option}
          onclick={() => (filter = option)}
        >
          {option}
          <span>{option === "all" ? CHANGES.length : CHANGES.filter((item) => item.area === option).length}</span>
        </button>
      {/each}
    </div>
    <span class="root"><Database size={13} aria-hidden="true" /> app/ unless noted</span>
  </div>

  <div class="rows">
    {#each visible as change (change.path)}
      {@const Icon = change.icon}
      <article class="row-{change.area}">
        <span class="kind"><Icon size={15} aria-hidden="true" />{change.area}</span>
        <code>{change.path}</code>
        <div><strong>{change.title}</strong><p>{change.detail}</p></div>
      </article>
    {/each}
  </div>
</div>

<style>
  .inventory {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .toolbar {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 13);
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: calc(var(--token-spacing-unit) * 2.5) calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .filters button {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    background: var(--token-surface-elevated);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .filters button:hover {
    border-color: var(--token-color-interactive-border);
  }

  .filters button.active {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .filters button span {
    display: grid;
    min-width: calc(var(--token-spacing-unit) * 4);
    height: calc(var(--token-spacing-unit) * 4);
    place-items: center;
    border-radius: 999px;
    background: var(--token-surface-work);
    font-size: 0.75rem;
  }

  .root,
  .kind {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
  }

  .rows article {
    display: grid;
    grid-template-columns: 6rem minmax(15rem, 0.95fr) minmax(18rem, 1.2fr);
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: center;
    min-height: calc(var(--token-spacing-unit) * 21);
    padding: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 4);
    border-left: 3px solid var(--area-color);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .rows article:last-child {
    border-bottom: 0;
  }

  .row-data {
    --area-color: var(--token-color-success-border);
  }

  .row-server {
    --area-color: var(--token-color-intelligence-border);
  }

  .row-views {
    --area-color: var(--token-color-active-border);
  }

  .row-reference {
    --area-color: var(--token-color-attention-border);
  }

  .kind {
    color: var(--area-color);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  code {
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--token-ink-primary);
    font-size: 0.75rem;
    font-weight: 550;
  }

  p {
    margin: calc(var(--token-spacing-unit) * 1) 0 0;
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  @media (max-width: 55rem) {
    .toolbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .rows article {
      grid-template-columns: 5rem 1fr;
    }

    .rows article > div {
      grid-column: 2;
    }
  }

  @media (max-width: 36rem) {
    .rows article {
      grid-template-columns: 1fr;
    }

    .rows article > div {
      grid-column: 1;
    }
  }
</style>
