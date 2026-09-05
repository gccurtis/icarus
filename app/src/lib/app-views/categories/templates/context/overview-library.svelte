<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { Panel, PanelBanner, PanelButton, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import {
    createTemplate,
    inspectTemplate,
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
  let nameDraft = $state("");
  let actionError = $state<string>();

  const create = async (target: TemplateTarget) => {
    if (creating !== undefined) return;

    const originTabId = view.activeId;
    const originSelectionId = view.selection?.id;
    creating = target;
    actionError = undefined;
    try {
      const result = await createTemplate(view, target, nameDraft);
      nameDraft = "";
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
</script>

<Panel title="Template library">
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
      <Input
        class="template-name"
        bind:value={nameDraft}
        aria-label="New template name"
        placeholder="Name (optional)"
        maxlength={160}
        disabled={creating !== undefined}
      />
      <div class="create-actions">
        <PanelButton
          label="Document"
          icon={FileText}
          disabled={creating !== undefined}
          onclick={() => create("Document")}
        />
        <PanelButton
          label="Slide deck"
          icon={Presentation}
          disabled={creating !== undefined}
          onclick={() => create("Slide deck")}
        />
        <PanelButton
          label="Spreadsheet"
          icon={Sheet}
          disabled={creating !== undefined}
          onclick={() => create("Spreadsheet")}
        />
      </div>
    </section>

    <div class="divider" aria-hidden="true"></div>

    <section aria-labelledby="library-summary-heading">
      <h3 id="library-summary-heading" class="section-title">Library</h3>

      <dl class="count-list total-count">
        <dt>Total templates</dt>
        <dd>{summary.total}</dd>
      </dl>

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

  .section-title,
  .count-heading {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .create-actions {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-top: calc(var(--token-spacing-unit) * 2);
  }

  :global(.template-name) {
    margin-top: calc(var(--token-spacing-unit) * 2);
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .create-actions :global(button) {
    width: 100%;
    justify-content: flex-start;
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

  .total-count {
    padding-bottom: calc(var(--token-spacing-unit) * 2.5);
  }

  .count-heading {
    margin-top: calc(var(--token-spacing-unit) * 2.5);
    color: var(--token-ink-muted);
    letter-spacing: 0;
    text-transform: none;
  }
</style>
