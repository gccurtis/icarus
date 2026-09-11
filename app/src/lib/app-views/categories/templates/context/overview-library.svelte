<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { Panel, PanelBanner, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
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
  let nameDraft = $state("");
  let actionError = $state<string>();

  const create = async (target: TemplateTarget) => {
    if (creating !== undefined) return;

    const originTabId = view.activeId;
    const originSelectionId = view.selection?.id;
    const name = nameDraft.trim() || nextTemplateName(target, templates);
    creating = target;
    actionError = undefined;
    try {
      const result = await createTemplate(view, target, name);
      if (
        live &&
        view.activeId === originTabId &&
        view.selection?.id === originSelectionId
      ) {
        nameDraft = "";
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
      icon: FileText,
      tint:
        "border-interactive-border bg-interactive-surface text-interactive-text hover:border-interactive-fill hover:bg-interactive-surface-hover"
    },
    {
      value: "Presentation",
      label: "Presentation",
      icon: Presentation,
      tint:
        "border-slide-border bg-slide-surface text-slide-text hover:border-slide-fill hover:bg-slide-surface-hover"
    },
    {
      value: "Spreadsheet",
      label: "Spreadsheet",
      icon: Sheet,
      tint:
        "border-accent-2-border bg-accent-2-surface text-accent-2-text hover:border-accent-2-fill hover:bg-accent-2-surface-hover"
    }
  ] as const satisfies readonly {
    value: TemplateTarget;
    label: string;
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
        <Input
          class="template-name"
          bind:value={nameDraft}
          aria-label="Optional template name"
          placeholder="Optional name"
          maxlength={160}
          disabled={creating !== undefined}
        />
        <div class="target-actions" role="group" aria-label="Create a template">
          {#each TARGETS as target (target.value)}
            {@const Icon = target.icon}
            <Button
              variant="ghost"
              size="icon"
              class="target-action {target.tint}"
              aria-label={`Create ${target.label.toLocaleLowerCase()} template`}
              title={`Create ${target.label.toLocaleLowerCase()} template`}
              disabled={creating !== undefined}
              onclick={() => create(target.value)}
            >
              <Icon aria-hidden="true" />
            </Button>
          {/each}
        </div>
        {#if creating !== undefined}
          <span class="creation-status" aria-live="polite">
            Creating {creating.toLocaleLowerCase()} template…
          </span>
        {/if}
      </section>

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="template-total-heading">
        <h3 id="template-total-heading" class="summary-title">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </h3>

        <dl class="count-list">
          <dt>Project</dt>
          <dd>{summary.project}</dd>
          <dt>Personal</dt>
          <dd>{summary.personal}</dd>
        </dl>

        <h4 class="count-heading">Kind</h4>
        <dl class="count-list">
          <dt>Documents</dt>
          <dd>{summary.documents}</dd>
          <dt>Presentations</dt>
          <dd>{summary.presentations}</dd>
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

  :global(.template-name) {
    height: calc(var(--token-spacing-unit) * 7);
    margin-top: calc(var(--token-spacing-unit) * 2);
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .target-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    margin-top: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
  }

  :global(.target-action) {
    width: 100%;
    height: calc(var(--token-spacing-unit) * 9);
    border: 0;
    border-radius: 0;
  }

  :global(.target-action + .target-action) {
    border-left: 1px solid var(--token-border-subtle);
  }

  :global(.target-action svg) {
    width: calc(var(--token-spacing-unit) * 4);
    height: calc(var(--token-spacing-unit) * 4);
  }

  .creation-status {
    display: block;
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
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

  .summary-title {
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

  .summary-title strong {
    color: var(--token-ink-primary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
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
