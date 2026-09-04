<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { Panel, PanelButton } from "$authored-components/panel";
  import {
    createTemplate,
    templateLibrarySummaryIn,
    type LibraryTemplate,
    type TemplateTarget
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const summary = $derived(templateLibrarySummaryIn(view.project));

  const inspect = (template: LibraryTemplate) =>
    view.inspect("templates.template", { kind: "template", id: template.id });

  const create = (makes: TemplateTarget) => inspect(createTemplate(view.project, makes));
</script>

<Panel title="Template library">
  <div class="context-stack">
    <section aria-labelledby="new-template-heading">
      <h3 id="new-template-heading" class="section-title">New template</h3>
      <div class="create-actions">
        <PanelButton label="Document" icon={FileText} onclick={() => create("Document")} />
        <PanelButton
          label="Slide deck"
          icon={Presentation}
          onclick={() => create("Slide deck")}
        />
        <PanelButton
          label="Spreadsheet"
          icon={Sheet}
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
</Panel>

<style>
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
