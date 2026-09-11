<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileDiff from "@lucide/svelte/icons/file-diff";
  import ShieldAlert from "@lucide/svelte/icons/shield-alert";

  import auditSource from "$development-views/template-library-demo/components/branch-audit.diff?raw";

  const AREAS = {
    data: {
      label: "Seed data",
      reason:
        "Supplies represented Template bodies, versions, independent example resources, snapshots, and spreadsheet cells so the library and Use path do not depend on component mocks. Activity and resource-set edits remove retired connection/external-file references requested before this branch."
    },
    templates: {
      label: "Template product",
      reason:
        "Implements the requested library, overview context, inspector, singleton editor shell, and the one view-facing projection shared by those panes."
    },
    templateCapability: {
      label: "Template capability",
      reason:
        "Owns scoped Template reads and writes, validates represented bodies and variables, versions metadata mutations, quarantines malformed rows, and materializes independent resources for Use."
    },
    projectIntegration: {
      label: "Project integration",
      reason:
        "Does not put templates in Project Overview. It makes a document, presentation, or spreadsheet created by Template Use appear in the existing resource table immediately, through the same typed project-resource cache key. This area is required for end-to-end Use, not for library browsing, and can be separated if Use integration is deferred."
    },
    serverStore: {
      label: "Server Store model",
      reason:
        "Adds one-table batch operations used by spreadsheet materialization and Template deletion. It also changes all newly created row ids to opaque UUIDs and persists disk before memory through a next-file rename. The batch methods are directly required; identity and commit ordering are broader integrity hardening."
    },
    workspace: {
      label: "Workspace State",
      reason:
        "Coordinates identical pending mutations once across the Template context, content, inspector, and remounts. The small open, close, and inspect edits omit undefined optional fields so Template focus and selection remain valid when workspace operations are serialized."
    },
    shell: {
      label: "Shared UI and shell",
      reason:
        "Adds the inspector's editable heading slot, accurate selected-state accessibility, a label for the shelf scroll region, protected Template naming in the status bar, and the previously requested stable/transient tab divider. These components are shared, so their exact small diffs are exposed below."
    },
    reference: {
      label: "Development reference",
      reason:
        "Keeps the live product composition, architecture explanation, decision priorities, and this audit under development-views. The app-scoped route is a thin adapter required because real remote calls admit only an /app/[project] pathname."
    },
    styles: {
      label: "Style system",
      reason:
        "Adds the approved orange Slide identity role and teaches the style lint/Tailwind vocabulary about that public semantic token."
    }
  } as const;

  type Area = keyof typeof AREAS;
  type Filter = "all" | Area;
  type AuditFile = {
    readonly path: string;
    readonly patch: string;
    readonly area: Area;
    readonly additions: number;
    readonly deletions: number;
    readonly status: "added" | "modified" | "deleted";
  };

  /**
   * Intentionally exhaustive: this review explains each exact file rather than
   * asking its directory name to stand in for what changed.
   */
  const FILE_CHANGES: Readonly<Record<string, string>> = {
    "app/scripts/lint/shared/styles.mjs":
      "Extended the style-rule vocabulary with the public Slide identity role so its orange semantic tokens remain linted.",
    "app/seed/activity.json":
      "Replaced the retired external-file upload event with a connector event, connector target, and visible connector label.",
    "app/seed/documentSnapshots.json":
      "Added represented leader snapshots for seeded documents used as realistic project examples.",
    "app/seed/documents.json":
      "Kept seeded documents independent from templates; template recency is represented on the template itself.",
    "app/seed/resourceSets.json":
      "Replaced the remaining external-file reference with an existing finding because external files are no longer a resource kind.",
    "app/seed/sheetCells.json":
      "Added represented values, formatting, merges, and stable row and column identities for the seeded spreadsheet resources.",
    "app/seed/presentationSnapshots.json":
      "Added leader snapshots for the additional seeded presentations used by the library recency examples.",
    "app/seed/presentations.json":
      "Kept seeded presentations independent from templates; template recency is represented on the template itself.",
    "app/seed/spreadsheetSnapshots.json":
      "Added represented spreadsheet geometry, formatting, print settings, and leader-snapshot metadata.",
    "app/seed/spreadsheets.json":
      "Kept seeded spreadsheets independent from templates; template recency is represented on the template itself.",
    "app/seed/templateVersions.json":
      "Added the immutable current-version seed for every template, including body, variables, tags, revision, and timestamp.",
    "app/seed/templates.json":
      "Replaced skeletal mocks with ten viewer-owned represented templates containing complete bodies, metadata, tags, variables, and revisions.",
    "app/src/lib/app-views/categories/project-overview/content/overview.svelte":
      "Replaced browser aggregation and generic Store creation with scoped Project Resources reads and writes; added loading, quarantine, and failure states so resources made by Template Use appear after refresh. It does not display Templates.",
    "app/src/lib/app-views/categories/project-overview/procedures/opening.ts":
      "Limited editor routing to documents and presentations because the spreadsheet, research, and analysis surfaces do not consume represented ids yet.",
    "app/src/lib/app-views/categories/project-overview/procedures/resources.ts":
      "Replaced direct represented-row assembly with typed Project Resources projection and a single-flight wrapper for blank creation.",
    "app/src/lib/app-views/categories/project-overview/procedures/rows.ts":
      "Corrected singular relative-time labels and prevented zero-hour output while preserving the existing age buckets.",
    "app/src/lib/app-views/categories/templates/content/editor.svelte":
      "Removed the session-local authoring mock and left a quiet Template workspace boundary with a Library return action.",
    "app/src/lib/app-views/categories/templates/content/library.svelte":
      "Built the ten-item recent shelf, search, scope, kind, and tag filters, sorting, table selection, inspector selection, and singleton editor navigation.",
    "app/src/lib/app-views/categories/templates/context/overview-library.svelte":
      "Built represented totals and optional-name creation, then joined the colored Document, Presentation, and Spreadsheet actions into one segmented control.",
    "app/src/lib/app-views/categories/templates/inspector/template.svelte":
      "Built inline autosave, variable-description and tag controls, and joined Use, Duplicate, and Delete actions with permission and conflict states.",
    "app/src/lib/app-views/categories/templates/procedures/library.svelte.ts":
      "Replaced seed imports and local mutation mocks with one reactive remote projection plus view shaping and single-flight CRUD and Use coordinators.",
    "app/src/lib/app-views/categories/templates/templates.md":
      "Rewrote the surface contract for the implemented library, Overview, Inspector, Personal visibility, Use behavior, and deferred authoring session.",
    "app/src/lib/capabilities/project-resources/api/create-project-resource/create-project-resource.ts":
      "Added scoped collision-free blank naming and creation of an editor-ready document or presentation plus revision-zero leader snapshot.",
    "app/src/lib/capabilities/project-resources/api/create-project-resource/validate-create-project-resource.ts":
      "Added strict admission for the blank-resource target and optional bounded title.",
    "app/src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts":
      "Added a project-scoped closed metadata projection for documents, presentations, spreadsheets, research threads, and findings with malformed-row reporting.",
    "app/src/lib/capabilities/project-resources/index.remote.ts":
      "Registered the Project Resources read and create doors and their shared cache key.",
    "app/src/lib/capabilities/project-resources/project-resources.md":
      "Documented scoping, projected fields, quarantine, default names, editor handoffs, and the current role-authorization limitation.",
    "app/src/lib/capabilities/project-resources/test/unit/project-resources.test.ts":
      "Added tests for isolation, projection, quarantine, actor labels, title allocation, refusal, and blank resource persistence.",
    "app/src/lib/capabilities/project-resources/types/project-resources.ts":
      "Defined the closed resource-index projection and blank-resource command contracts.",
    "app/src/lib/capabilities/templates/api/create-template/create-template.ts":
      "Added viewer-owned creation with a valid empty body, revision one, and matching immutable version row.",
    "app/src/lib/capabilities/templates/api/create-template/validate-create-template.ts":
      "Added strict target and required-name validation for template creation.",
    "app/src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts":
      "Added duplication of an admitted visible template into viewer ownership with a new id and revision-one history.",
    "app/src/lib/capabilities/templates/api/duplicate-template/validate-duplicate-template.ts":
      "Added canonical template-id validation for duplicate requests.",
    "app/src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts":
      "Added Template Use: resolve defaults, clone a body, persist an independent resource without a template pointer plus its leader snapshot and any cells, or refuse before writing.",
    "app/src/lib/capabilities/templates/api/instantiate-template/validate-instantiate-template.ts":
      "Added canonical template-id validation for Template Use.",
    "app/src/lib/capabilities/templates/api/read-template-library/read-template-library.ts":
      "Added the scoped query returning current-viewer template metadata and explicit unavailable notices.",
    "app/src/lib/capabilities/templates/api/read-template/read-template.ts":
      "Added the body-bearing single-template query with found, unavailable, and absent results.",
    "app/src/lib/capabilities/templates/api/read-template/validate-read-template.ts":
      "Added canonical template-id validation for the direct read.",
    "app/src/lib/capabilities/templates/api/remove-template/remove-template.ts":
      "Added owner-only revision-checked deletion of versions, private hole rows, and any stage in one recoverable transaction; independent resources are untouched.",
    "app/src/lib/capabilities/templates/api/remove-template/validate-remove-template.ts":
      "Added canonical id and positive base-revision validation for deletion.",
    "app/src/lib/capabilities/templates/api/shared/bodies.ts":
      "Added valid empty bodies, recursive default resolution, deep cloning, and bounded spreadsheet materialization.",
    "app/src/lib/capabilities/templates/api/shared/projection.ts":
      "Added stored-row admission, Personal projection, creator names, resource-derived recency, permissions, lookup states, and duplicate-id quarantine.",
    "app/src/lib/capabilities/templates/api/shared/store.ts":
      "Added unknown-first Store readers, record admission, canonical row-id checks, and row lookup shared by Template procedures.",
    "app/src/lib/capabilities/templates/api/shared/template-rows.ts":
      "Added exact Template-to-version field copying and the one history-write helper.",
    "app/src/lib/capabilities/templates/api/shared/validation.ts":
      "Added bounded validation for every supported body, block, style, formula, variable, tag, actor, resource set, spreadsheet address, and stored field.",
    "app/src/lib/capabilities/templates/api/update-template/update-template.ts":
      "Added owner-only compare-and-swap updates for metadata and variable help, revision increments, and version snapshots.",
    "app/src/lib/capabilities/templates/api/update-template/validate-update-template.ts":
      "Added discriminated bounded validation for each supported update command.",
    "app/src/lib/capabilities/templates/index.remote.ts":
      "Registered the six Template doors, browser queries, and cache refresh relationships.",
    "app/src/lib/capabilities/templates/templates.md":
      "Documented Template procedure results, ownership, quarantines, conflicts, Use, persistence limits, and deferred work.",
    "app/src/lib/capabilities/templates/test/unit/templates.test.ts":
      "Added capability coverage for scope, validation, corruption, CRUD, revisions, defaults, three body kinds, independent copies, deletion, and failure boundaries.",
    "app/src/lib/capabilities/templates/types/templates.ts":
      "Defined the public library, detail, unavailable, mutation, conflict, permission, Use, target, availability, and request contracts.",
    "app/src/lib/components/authored/carousel-shelf/carousel-shelf.svelte":
      "Reworked the shelf into a labeled horizontal scrollport with drag, wheel, Shift-wheel, native horizontal scrolling, click suppression, and a quiet scrollbar.",
    "app/src/lib/components/authored/panel/panel.svelte":
      "Added an optional heading snippet so the Template inspector can render an editable h2 while every other panel keeps the title fallback.",
    "app/src/lib/components/authored/screen/screen-card.svelte":
      "Changed selectable-card accessibility from aria-current to aria-pressed.",
    "app/src/lib/components/authored/screen/screen-row.svelte":
      "Added aria-selected so table-row accessibility matches visual selection.",
    "app/src/lib/components/authored/screen/screen-shelf.svelte":
      "Added and forwarded a shelf label so Recently used has a specific accessible name.",
    "app/src/lib/development-views/demo/components/demo-index.svelte":
      "Added the Template reference card to the development index and generalized copy that assumed exactly four demos.",
    "app/src/lib/development-views/demo/components/roles.svelte":
      "Added the orange Slide identity role to the token catalogue.",
    "app/src/lib/development-views/template-library-demo/components/behavior-map.svelte":
      "Added the visual contract for seven library gestures and their visible and persisted outcomes.",
    "app/src/lib/development-views/template-library-demo/components/branch-audit.svelte":
      "Added this filterable exact-path audit with exhaustive file explanations, area rationale, line counts, and unified diffs.",
    "app/src/lib/development-views/template-library-demo/components/components.md":
      "Inventoried and documented every reference component and the audit's runtime boundary.",
    "app/src/lib/development-views/template-library-demo/components/data-flow.svelte":
      "Added implemented seed-to-view and Template-Use diagrams plus a separately marked durable-authoring proposal.",
    "app/src/lib/development-views/template-library-demo/components/library-stage.svelte":
      "Added an isolated live composition of the real Template Context, Content, and Inspector registries.",
    "app/src/lib/development-views/template-library-demo/template-library-demo.md":
      "Documented the reference purpose, persistence, scoped route, ownership, audit, dependencies, states, accessibility, layout, and invariants.",
    "app/src/lib/development-views/template-library-demo/template-library-demo.svelte":
      "Added the live review page, architecture, persistence facts, model, behaviors, flow, exact justifications, verification, five current decisions, and deferred editor proposal.",
    "app/src/lib/model/client/workspace-state/definition.svelte.ts":
      "Added the per-workspace pending-promise registry and exposed singleFlight without importing or executing a capability.",
    "app/src/lib/model/client/workspace-state/index.ts":
      "Re-exported the single-flight key type with the public Workspace State types.",
    "app/src/lib/model/client/workspace-state/methods/close.ts":
      "Changed persisted close operations to omit an absent optional resourceId instead of carrying undefined.",
    "app/src/lib/model/client/workspace-state/methods/inspect.ts":
      "Canonicalized selections so an absent optional location is omitted from persisted inspection operations.",
    "app/src/lib/model/client/workspace-state/methods/methods.md":
      "Documented single-flight outside the undoable tab log and updated the method inventory and concurrency wording.",
    "app/src/lib/model/client/workspace-state/methods/open.ts":
      "Changed persisted open operations to omit an absent optional resourceId instead of carrying undefined.",
    "app/src/lib/model/client/workspace-state/methods/single-flight.ts":
      "Added exact-key pending-command coalescing with pre-work registration, shared promises, and release for retry.",
    "app/src/lib/model/client/workspace-state/test/unit/persistence.test.ts":
      "Added regression tests that resource-less tabs and location-less selections omit optional wire fields.",
    "app/src/lib/model/client/workspace-state/test/unit/single-flight.test.ts":
      "Added tests for coalescing, distinct concurrency, settlement release, re-entry, synchronous throws, and retry.",
    "app/src/lib/model/client/workspace-state/types.ts":
      "Added the structured primitive key and generic singleFlight method to the public interface.",
    "app/src/lib/model/client/workspace-state/workspace-state.md":
      "Documented single-flight lifetime, boundary, concurrency, invariant, location, and tests.",
    "app/src/lib/model/server/store/definition.ts":
      "Added one-table create and removal batches needed by Template cells and cleanup; also changed ids to UUIDs and commits from memory-first to disk-first.",
    "app/src/lib/model/server/store/methods/shared/persist.server.ts":
      "Changed persistence to write and rename a sibling next-file and clean it after failure.",
    "app/src/lib/model/server/store/store.md":
      "Documented UUIDs, batch admission, and the Store's journaled cross-table transaction and recovery boundary.",
    "app/src/lib/model/server/store/test/unit/store.test.ts":
      "Updated id assertions and added non-reuse, all-before-write batch, removal, and disk tests.",
    "app/src/lib/model/server/store/types.ts":
      "Added createMany, removeRows, and removeFieldFromRows to the Store contract.",
    "app/src/lib/styles/semantic-tokens/color.css":
      "Added orange Slide surface, border, fill, hover, text, and on-fill semantic tokens.",
    "app/src/lib/styles/semantic-tokens/semantic-tokens.md":
      "Added Slide to the documented identity roles and updated their counts.",
    "app/src/lib/styles/x-integrations/tailwind/tailwind.css":
      "Exposed Slide semantic tokens through Tailwind names used by Template creation.",
    "app/src/lib/surfaces/status-bar/procedures/resource-name.ts":
      "Removed external-file naming, stopped naming Template Version history, updated the opaque-id note, and routed Template names through the scoped Template capability.",
    "app/src/lib/surfaces/tab-bar/procedures/resource-name.ts":
      "Removed external-file naming, made Template and Template Version ids intentionally unnamed in the generic resolver, and updated the opaque-id note.",
    "app/src/lib/surfaces/tab-bar/tab-bar.svelte":
      "Made the existing stable-to-transient divider non-shrinking, taller, spaced, and visually stronger.",
    "app/src/routes/app/[project]/reference/templates/+page.svelte":
      "Added the five-line project-scoped adapter that renders the development reference without moving its implementation into app views.",
    "app/src/routes/demo/templates/+page.server.ts":
      "Added the memorable demo redirect into the configured project scope required by Template remote procedures."
  };

  const areaOf = (path: string): Area => {
    if (path.startsWith("app/seed/")) return "data";
    if (path.startsWith("app/src/lib/app-views/categories/templates/")) return "templates";
    if (path.startsWith("app/src/lib/capabilities/templates/")) return "templateCapability";
    if (
      path.startsWith("app/src/lib/app-views/categories/project-overview/") ||
      path.startsWith("app/src/lib/capabilities/project-resources/")
    ) return "projectIntegration";
    if (path.startsWith("app/src/lib/model/server/store/")) return "serverStore";
    if (path.startsWith("app/src/lib/model/client/workspace-state/")) return "workspace";
    if (
      path.startsWith("app/src/lib/components/authored/") ||
      path.startsWith("app/src/lib/surfaces/")
    ) return "shell";
    if (
      path.startsWith("app/src/lib/development-views/") ||
      path.startsWith("app/src/routes/")
    ) return "reference";
    return "styles";
  };

  const parseAudit = (source: string): readonly AuditFile[] =>
    source
      .split(/^diff --git /m)
      .slice(1)
      .map((body) => `diff --git ${body}`)
      .map((patch) => {
        const first = patch.slice(0, patch.indexOf("\n"));
        const match = /^diff --git a\/(.+) b\/(.+)$/.exec(first);
        if (match === null) throw new Error(`unreadable audit header: ${first}`);
        const path = match[2];
        const lines = patch.split("\n");
        return {
          path,
          patch: patch.trimEnd(),
          area: areaOf(path),
          additions: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
          deletions: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
          status: patch.includes("\nnew file mode ")
            ? "added"
            : patch.includes("\ndeleted file mode ")
              ? "deleted"
              : "modified"
        } satisfies AuditFile;
      })
      .toSorted((left, right) => left.path.localeCompare(right.path));

  const files = parseAudit(auditSource);
  const unexplained = files.filter((file) => !Object.hasOwn(FILE_CHANGES, file.path));
  if (unexplained.length > 0) {
    throw new Error(
      "unexplained audit files: " + unexplained.map((file) => file.path).join(", ")
    );
  }
  const changeIn = (path: string): string => FILE_CHANGES[path] as string;
  const additionTotal = files.reduce((total, file) => total + file.additions, 0);
  const deletionTotal = files.reduce((total, file) => total + file.deletions, 0);
  const FILTERS: readonly Filter[] = ["all", ...(Object.keys(AREAS) as Area[])];
  const labelFor = (option: Filter) => option === "all" ? "All files" : AREAS[option].label;
  const countFor = (option: Filter) =>
    option === "all" ? files.length : files.filter((file) => file.area === option).length;
  let filter = $state<Filter>("all");
  const visible = $derived(filter === "all" ? files : files.filter((file) => file.area === filter));
</script>

<div class="audit">
  <div class="audit-proof">
    <Check size={16} aria-hidden="true" />
    <p>
      <strong>New Tab is clean:</strong> there are no differences under
      <code>app/src/lib/app-views/categories/new-tab</code> relative to <code>main@98d9cd0</code>.
    </p>
  </div>

  <div class="audit-warning">
    <ShieldAlert size={16} aria-hidden="true" />
    <p>
      <strong>Review boundary:</strong> this is the complete diff from <code>main@98d9cd0</code> to
      this replayed branch snapshot. Every changed path is written in full. The generated
      <code>app/src/lib/development-views/template-library-demo/components/branch-audit.diff</code> file excludes
      only itself, because embedding its own diff would be recursive.
    </p>
  </div>

  <div class="audit-toolbar">
    <div class="filters" role="group" aria-label="Filter exact changed files">
      {#each FILTERS as option (option)}
        <button
          type="button"
          class:active={filter === option}
          aria-pressed={filter === option}
          onclick={() => (filter = option)}
        >
          {labelFor(option)}
          <span>{countFor(option)}</span>
        </button>
      {/each}
    </div>
    <span class="totals">{files.length} files · +{additionTotal} · −{deletionTotal}</span>
  </div>

  <div class="area-reasons">
    {#each Object.entries(AREAS) as [key, area] (key)}
      {#if filter === "all" || filter === key}
        <article>
          <span>{area.label}</span>
          <p>{area.reason}</p>
        </article>
      {/if}
    {/each}
  </div>

  <div class="file-list">
    {#each visible as file (file.path)}
      <details>
        <summary>
          <span class="file-icon"><FileDiff size={15} aria-hidden="true" /></span>
          <code>{file.path}</code>
          <span class="file-area">{AREAS[file.area].label}</span>
          <span class="status">{file.status}</span>
          <span class="line-count">+{file.additions} −{file.deletions}</span>
          <ChevronDown class="chevron" size={15} aria-hidden="true" />
        </summary>
        <div class="file-reason">
          <strong>What changed in this file</strong>
          <p>{changeIn(file.path)}</p>
          <strong>Why this area is in the branch</strong>
          <p>{AREAS[file.area].reason}</p>
        </div>
        <div class="patch-heading">Exact changed lines</div>
        <pre><code>{file.patch}</code></pre>
      </details>
    {/each}
  </div>
</div>

<style>
  .audit {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .audit-proof,
  .audit-warning {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-color-success-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .audit-warning {
    border-color: var(--token-color-attention-border);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .audit-proof :global(svg),
  .audit-warning :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }

  .audit-proof p,
  .audit-warning p,
  .area-reasons p,
  .file-reason p {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .audit-proof code,
  .audit-warning code {
    font-family: var(--token-font-mono);
  }

  .audit-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .filters button {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 1.25) calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-size: 0.7rem;
  }

  .filters button:hover,
  .filters button.active {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .filters span,
  .totals,
  .status,
  .line-count,
  .file-area,
  .patch-heading {
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
  }

  .totals {
    flex: none;
    color: var(--token-ink-muted);
  }

  .area-reasons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .area-reasons article {
    padding: calc(var(--token-spacing-unit) * 3);
    border-right: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .area-reasons article:nth-child(2n) {
    border-right: 0;
  }

  .area-reasons article > span {
    display: block;
    margin-bottom: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-primary);
    font-size: 0.76rem;
    font-weight: 600;
  }

  .file-list {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .file-list details + details {
    border-top: 1px solid var(--token-border-subtle);
  }

  .file-list summary {
    display: grid;
    grid-template-columns: auto minmax(16rem, 1fr) auto auto auto auto;
    gap: calc(var(--token-spacing-unit) * 2);
    align-items: center;
    min-height: calc(var(--token-spacing-unit) * 11);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    cursor: pointer;
    list-style: none;
  }

  .file-list summary::-webkit-details-marker {
    display: none;
  }

  .file-list summary:hover,
  .file-list details[open] > summary {
    background: var(--token-surface-panel-hover);
  }

  .file-list summary > code {
    overflow-wrap: anywhere;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.72rem;
  }

  .file-icon,
  :global(.chevron) {
    color: var(--token-ink-muted);
  }

  .file-area,
  .status,
  .line-count {
    color: var(--token-ink-muted);
    white-space: nowrap;
  }

  :global(.chevron) {
    transition: transform var(--token-motion-small) var(--token-ease-standard);
  }

  details[open] :global(.chevron) {
    transform: rotate(180deg);
  }

  .file-reason {
    padding: calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid var(--token-border-subtle);
    background: var(--token-color-active-surface);
  }

  .file-reason strong {
    display: block;
    margin-bottom: calc(var(--token-spacing-unit) * 1);
    color: var(--token-color-active-text);
    font-size: 0.72rem;
  }

  .file-reason p + strong {
    margin-top: calc(var(--token-spacing-unit) * 2);
  }

  .patch-heading {
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  pre {
    max-height: 38rem;
    margin: 0;
    overflow: auto;
    padding: calc(var(--token-spacing-unit) * 3);
    background: var(--token-surface-work);
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    line-height: 1.55;
    tab-size: 2;
  }

  @media (max-width: 58rem) {
    .audit-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .area-reasons {
      grid-template-columns: 1fr;
    }

    .area-reasons article {
      border-right: 0;
    }

    .file-list summary {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .file-area,
    .status,
    .line-count {
      display: none;
    }
  }
</style>
