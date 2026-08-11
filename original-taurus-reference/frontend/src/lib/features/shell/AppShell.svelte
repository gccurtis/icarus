<script lang="ts">
  import type { IconColor } from '$data/projects';
  import {
    workspace,
    enterProject,
    setPanel,
    CONTEXT_MIN,
    CONTEXT_MAX,
    INSPECTOR_MIN,
    INSPECTOR_MAX
  } from '$data/workspace';
  import { activeSurface } from '$lib/features/shared/surface';
  import { contextSectionsFor, inspectorSectionsFor, repairSection } from './shell-sections';
  import ShellTopBar from './ShellTopBar.svelte';
  import TabStrip from './TabStrip.svelte';
  import SidePanel from './SidePanel.svelte';
  import WorkSurface from './WorkSurface.svelte';
  import QuarterbackDock from './QuarterbackDock.svelte';
  import StatusBar from './StatusBar.svelte';

  let {
    projectId,
    projectName,
    projectIcon
  }: { projectId: string; projectName: string; projectIcon: IconColor } = $props();

  // Strict per-project isolation: (re)load this project's shell state.
  $effect(() => {
    enterProject(projectId);
  });

  // Which sections each rail shows — fallback sets, surface-merge rule, and
  // persisted-state repair — is shell-sections.ts's knowledge (catalog A4).
  // This component only composes.
  const contextSections = $derived(contextSectionsFor($activeSurface));
  const inspectorSections = $derived(inspectorSectionsFor($activeSurface));

  const activeTab = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId) ?? null
  );

  $effect(() => {
    const ws = $workspace;
    if (!ws) return;
    const context = repairSection(contextSections, ws.context.section);
    if (context) setPanel('context', { section: context });
    const inspector = repairSection(inspectorSections, ws.inspector.section);
    if (inspector) setPanel('inspector', { section: inspector });
  });
</script>

{#if $workspace}
  <div class="flex h-screen flex-col overflow-hidden bg-canvas text-primary">
    <ShellTopBar {projectName} {projectId} icon={projectIcon} />
    <TabStrip />

    <div class="flex min-h-0 flex-1">
      <SidePanel
        side="left"
        sections={contextSections}
        activeSection={$workspace.context.section}
        width={$workspace.context.width}
        collapsed={$workspace.context.collapsed}
        min={CONTEXT_MIN}
        max={CONTEXT_MAX}
        onresize={(w) => setPanel('context', { width: w })}
        ontoggle={(c) => setPanel('context', { collapsed: c })}
        onselect={(id) => setPanel('context', { section: id, collapsed: false })}
      >
        {#snippet content(active)}
          {@const section = contextSections.find((s) => s.id === active)}
          {@const Content = section?.content}
          {#if Content}
            <Content />
          {:else if section?.placeholder}
            <p class="text-body-sm text-muted">{section.placeholder}</p>
          {/if}
        {/snippet}
      </SidePanel>

      <!-- The center region between the panels: the AI Agent dock anchors to IT,
           so the bar centers with the work surface, tracks panel resizes live, and
           shrinks with the region rather than ever overlapping a panel. -->
      <div class="relative flex min-h-0 min-w-0 flex-1">
        <WorkSurface tab={activeTab} {projectId} {projectName} />
        <QuarterbackDock />
      </div>

      <SidePanel
        side="right"
        sections={inspectorSections}
        activeSection={$workspace.inspector.section}
        width={$workspace.inspector.width}
        collapsed={$workspace.inspector.collapsed}
        min={INSPECTOR_MIN}
        max={INSPECTOR_MAX}
        onresize={(w) => setPanel('inspector', { width: w })}
        ontoggle={(c) => setPanel('inspector', { collapsed: c })}
        onselect={(id) => setPanel('inspector', { section: id, collapsed: false })}
      >
        {#snippet content(active)}
          {@const Content = inspectorSections.find((s) => s.id === active)?.content}
          {#if Content}<Content />{/if}
        {/snippet}
      </SidePanel>
    </div>

    <StatusBar />
  </div>
{/if}
