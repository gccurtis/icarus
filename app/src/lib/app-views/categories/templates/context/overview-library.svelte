<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { Panel, PanelBanner, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { ToggleGroup, ToggleGroupItem } from "$vendored-components/toggle-group";
  import {
    createTemplate,
    inspectTemplate,
    nextTemplateName,
    templateLibrary,
    templateLibrarySummaryIn,
    templatesIn,
    type TemplateTarget
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = templateLibrary();
  let live = true;
  onDestroy(() => {
    live = false;
  });
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const templates = $derived(templatesIn(library.ready ? library.current : undefined, now));
  const summary = $derived(templateLibrarySummaryIn(templates));

  let creating = $state<TemplateTarget>();
  let selectedTarget = $state<TemplateTarget>("Document");
  let actionError = $state<string>();

  const create = async () => {
    if (creating !== undefined) return;

    const target = selectedTarget;
    const originTabId = view.activeId;
    const originSelectionId = view.selection?.id;
    creating = target;
    actionError = undefined;
    try {
      const result = await createTemplate(view, target, nextTemplateName(target, templates));
      if (
        live &&
        view.activeId === originTabId &&
        view.selection?.id === originSelectionId
      ) {
        inspectTemplate(view, result.templateId);
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      creating = undefined;
    }
  };

  const TARGETS = [
    {
      value: "Document",
      label: "Document",
      shortLabel: "Document",
      icon: FileText,
      tint:
        "border-interactive-border bg-interactive-surface text-interactive-text data-[state=on]:border-interactive-fill data-[state=on]:bg-interactive-surface-hover"
    },
    {
      value: "Slide deck",
      label: "Slide deck",
      shortLabel: "Slide",
      icon: Presentation,
      tint:
        "border-accent-1-border bg-accent-1-surface text-accent-1-text data-[state=on]:border-accent-1-fill data-[state=on]:bg-accent-1-surface-hover"
    },
    {
      value: "Spreadsheet",
      label: "Spreadsheet",
      shortLabel: "Sheet",
      icon: Sheet,
      tint:
        "border-accent-2-border bg-accent-2-surface text-accent-2-text data-[state=on]:border-accent-2-fill data-[state=on]:bg-accent-2-surface-hover"
    }
  ] as const satisfies readonly {
    value: TemplateTarget;
    label: string;
    shortLabel: string;
    icon: typeof FileText;
    tint: string;
  }[];
</script>

<Panel title="Overview">
  {#if library.error}
    <div class="load-error">
      <PanelBanner title="Library unavailable" tone="danger">
        {library.error instanceof Error ? library.error.message : String(library.error)}
      </PanelBanner>
      <Button variant="outline" size="sm" onclick={() => library.refresh()}>
        Retry library
      </Button>
    </div>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else}
    <div class="context-stack">
      {#if actionError}
        <PanelBanner title="Template was not created" tone="attention">
          {actionError}
        </PanelBanner>
      {/if}

      <section aria-labelledby="new-template-heading">
        <h3 id="new-template-heading" class="section-title">New template</h3>
        <ToggleGroup
          type="single"
          value={selectedTarget}
          onValueChange={(next: string) => {
            if (next) selectedTarget = next as TemplateTarget;
          }}
          class="target-choice"
          aria-label="Template kind"
        >
          {#each TARGETS as target (target.value)}
            {@const Icon = target.icon}
            <ToggleGroupItem
              value={target.value}
              class="target-option {target.tint}"
              aria-label={target.label}
              title={target.label}
              disabled={creating !== undefined}
            >
              <Icon aria-hidden="true" />
              <span>{target.shortLabel}</span>
            </ToggleGroupItem>
          {/each}
        </ToggleGroup>
        <Button
          variant="outline"
          size="sm"
          class="create-template"
          disabled={creating !== undefined}
          onclick={create}
        >
          <Plus aria-hidden="true" />
          {creating ? "Creating…" : `Create ${selectedTarget.toLocaleLowerCase()} template`}
        </Button>
      </section>

    <div class="divider" aria-hidden="true"></div>

    <section aria-labelledby="library-summary-heading">
        <h3 id="library-summary-heading" class="library-title">
          <span>Library</span>
          <span class="library-total">{summary.total} templates</span>
        </h3>

        <h4 class="count-heading">Availability</h4>
        <dl class="count-list">
          <dt>Project</dt>
          <dd>{summary.project}</dd>
          <dt>Shared</dt>
          <dd>{summary.shared}</dd>
          <dt>Personal</dt>
          <dd>{summary.personal}</dd>
        </dl>

        <h4 class="count-heading">Kind</h4>
        <dl class="count-list">
          <dt>Documents</dt>
          <dd>{summary.documents}</dd>
          <dt>Slide decks</dt>
          <dd>{summary.slideDecks}</dd>
          <dt>Spreadsheets</dt>
          <dd>{summary.spreadsheets}</dd>
        </dl>
      </section>
    </div>
  {/if}
</Panel>

<style>
  .load-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .context-stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .section-title {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 500;
  }

  :global(.target-choice) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 1);
    margin-top: calc(var(--token-spacing-unit) * 2);
  }

  :global(.target-option) {
    display: flex;
    height: auto;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 1);
    border-width: 1px;
    border-radius: var(--token-radius-control);
    font-size: 0.625rem;
    line-height: 1.2;
    font-weight: 500;
  }

  :global(.target-option svg) {
    width: calc(var(--token-spacing-unit) * 4);
    height: calc(var(--token-spacing-unit) * 4);
  }

  :global(.create-template) {
    width: 100%;
    margin-top: calc(var(--token-spacing-unit) * 1.5);
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .divider {
    border-top: 1px solid var(--token-border-subtle);
  }

  .count-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 3);
    margin: calc(var(--token-spacing-unit) * 1.5) 0 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .count-list dt,
  .count-list dd {
    margin: 0;
  }

  .count-list dd {
    color: var(--token-ink-primary);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .library-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 500;
  }

  .library-total {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }

  .count-heading {
    margin-top: calc(var(--token-spacing-unit) * 2.5);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
</style>
