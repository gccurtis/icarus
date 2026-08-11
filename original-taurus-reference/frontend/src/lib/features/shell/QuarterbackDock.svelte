<script lang="ts">
  import { QuarterbackBar } from '$lib/components';
  import {
    aiAgent,
    loadPersonas,
    setActiveResource,
    setAiMode,
    setAiPersona,
    setWebEnabled,
    submitAiPrompt,
    type AiMode
  } from '$data/ai-agent';
  import { cn } from '$lib/utils';
  import { setPanel, workspace } from '$data/workspace';

  let value = $state('');
  let focused = $state(false);
  const inspectorActive = $derived(
    $workspace?.inspector.section === 'ai' && !$workspace.inspector.collapsed
  );
  const active = $derived(focused || inspectorActive);

  // The composer and inspector are one AI Agent surface: either side activates
  // the other without taking the user away from the work.
  function activateAgent() {
    setPanel('inspector', { section: 'ai', collapsed: false });
  }

  // The active resource tab's id and kind — read from workspace directly since
  // it already tracks the active tab. The registry active() call confirms a
  // runtime is open, but workspace is the source of identity data.
  const activeResourceId = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId && t.kind === 'resource')?.resourceId ?? null
  );
  const activeResourceKind = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId && t.kind === 'resource')?.resourceKind ?? null
  );

  function send(prompt: string, mode: AiMode) {
    setActiveResource(activeResourceId, activeResourceKind);
    void submitAiPrompt(prompt, mode);
    activateAgent();
  }

  // Personas power the composer's picker; load them once per project. The dock is
  // always mounted, so this seeds the picker even when the inspector panel is shut.
  let personaProject = $state<string | null>(null);
  $effect(() => {
    const project = $workspace?.projectId ?? null;
    if (project && project !== personaProject) {
      personaProject = project;
      void loadPersonas();
    }
  });
</script>

<!-- Bottom-anchored: additional input lines expand toward the work above. -->
<div
  class={cn(
    'pointer-events-none absolute bottom-4 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 px-4 transition-opacity duration-200',
    active ? 'opacity-100' : 'opacity-65 hover:opacity-100'
  )}
>
  <QuarterbackBar
    bind:value
    mode={$aiAgent.mode}
    {active}
    personas={$aiAgent.personas}
    personaId={$aiAgent.personaId}
    web={$aiAgent.webEnabled}
    class="pointer-events-auto"
    onmodechange={setAiMode}
    onactivate={activateAgent}
    onfocuschange={(next) => (focused = next)}
    onpersonachange={setAiPersona}
    onwebchange={setWebEnabled}
    onsend={send}
  />
</div>
