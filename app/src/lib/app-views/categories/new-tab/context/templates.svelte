<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";
  import { Panel, PanelBanner, PanelButton, PanelEmpty, PanelNote, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
  import { keepLauncherCurrent } from "$app-views/categories/new-tab/procedures/effects/launcher.svelte";
  import { availableTemplates, launcherTemplates } from "$app-views/categories/new-tab/procedures/read-templates";
  import { useTemplate } from "$app-views/categories/new-tab/procedures/use-template";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const launch = new LauncherState();
  keepLauncherCurrent(launch);
  const library = launcherTemplates();
  const selectedTemplateId = $derived(view.selection?.kind === "template" ? view.selection.id : undefined);
  const templates = $derived(availableTemplates(library.ready ? library.current : undefined, launch.now));
  const ICON = { Document: FileText, Presentation, Spreadsheet: Sheet };
  const inspect = (id: string) => {
    launch.error = undefined;
    launch.errorFocus = undefined;
    view.inspect("templates.template", { kind: "template", id });
  };
  const openLibrary = () => view.open({
    category: "templates",
    content: "templates.library",
    ...((selectedTemplateId ?? launch.errorFocus) === undefined
      ? {}
      : { focus: selectedTemplateId ?? launch.errorFocus })
  });
</script>

<Panel title="Templates">
  {#snippet actions()}
    <PanelButton label="Open template library" icon={LayoutTemplate} onclick={openLibrary} />
  {/snippet}
  {#if library.error}
    <PanelBanner title="Templates could not be loaded" tone="attention">
      <PanelButton label="Retry templates" onclick={() => library.refresh()} />
    </PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={4} />
  {:else if templates.length === 0}
    <PanelEmpty title="Start with a template of your own." action="Create template" onaction={openLibrary} />
  {:else}
    <PanelNote>Open a new resource with a template.</PanelNote>
    <div class="template-list">
      {#each templates as template (template.id)}
        {@const Icon = ICON[template.makes]}
        <Button
          variant="ghost"
          class={selectedTemplateId === template.id ? "template-choice bg-active-surface hover:bg-active-surface" : "template-choice"}
          aria-label={"Inspect " + template.name + " template"}
          aria-pressed={selectedTemplateId === template.id}
          title={template.name + ": click to inspect; double-click to open with this template"}
          disabled={launch.pending !== undefined}
          onclick={() => inspect(template.id)}
          ondblclick={() => void useTemplate(view, launch, template)}
        >
          <Icon aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{template.name}</span>
            <span class="text-caption text-ink-muted block truncate">
              {launch.pending === template.id ? "Creating…" : template.makes + " · " + template.scope}
            </span>
          </span>
        </Button>
      {/each}
    </div>
  {/if}
  {#if launch.error}
    <PanelBanner title="Template needs attention" tone="attention">{launch.error}</PanelBanner>
    <div class="px-3">
      <PanelButton label="Choose template inputs in the library" onclick={openLibrary} />
    </div>
  {/if}
</Panel>

<style>
  .template-list {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--token-spacing-unit);
    padding: calc(var(--token-spacing-unit) * 2);
  }

  :global(.template-choice) {
    justify-content: flex-start;
    height: auto;
    min-width: 0;
    padding: calc(var(--token-spacing-unit) * 2);
    text-align: start;
  }
</style>
