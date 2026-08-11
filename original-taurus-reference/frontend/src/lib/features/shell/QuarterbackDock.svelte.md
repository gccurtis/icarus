# src/lib/features/shell/QuarterbackDock.svelte — breakdown

Companion to [QuarterbackDock.svelte](QuarterbackDock.svelte). The floating AI Agent
composer bar anchored to the bottom of the work surface. It stays faded when idle and
becomes solid when either the composer is focused or the AI inspector is open, expands
upward without taking layout space, tracks the active resource tab so a sent prompt
pins its new chat to the open document, loads the project's personas for the bar's
picker, and forwards mode / persona / web / send events to the shared `QuarterbackBar`
component.

## Script — imports

### Import the bar component, the dock actions, and workspace helpers

```svelte
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

```

`QuarterbackBar` is the reusable composer from the component library. The `$data/ai-agent`
import pulls in the store plus every action this dock triggers. `cn` merges class
strings, and `setPanel`/`workspace` drive the inspector.

## Script — state and activation

### Local composer state and the derived active flag

```svelte
  let value = $state('');
  let focused = $state(false);
  const inspectorActive = $derived(
    $workspace?.inspector.section === 'ai' && !$workspace.inspector.collapsed
  );
  const active = $derived(focused || inspectorActive);

```

`value` binds the input text and `focused` tracks composer focus. `inspectorActive` is
true when the AI inspector section is open and not collapsed, and `active` is the union
of the two — either focusing the bar or opening the inspector lights up the surface,
because they are two faces of the same AI Agent experience.

## Script — activate the agent surface

### Open the AI inspector panel

```svelte
  // The composer and inspector are one AI Agent surface: either side activates
  // the other without taking the user away from the work.
  function activateAgent() {
    setPanel('inspector', { section: 'ai', collapsed: false });
  }

```

`activateAgent` opens the inspector to its `ai` section, uncollapsed. Because the
composer and inspector are one surface, focusing the bar or sending a prompt opens the
panel without pulling the user off the work they were doing.

## Script — active resource identity

### Read the active resource tab's id and kind from the workspace

```svelte
  // The active resource tab's id and kind — read from workspace directly since
  // it already tracks the active tab. The registry active() call confirms a
  // runtime is open, but workspace is the source of identity data.
  const activeResourceId = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId && t.kind === 'resource')?.resourceId ?? null
  );
  const activeResourceKind = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId && t.kind === 'resource')?.resourceKind ?? null
  );

```

`activeResourceId` and `activeResourceKind` locate the currently active tab in the
workspace and read its resource identity. The workspace — not the registry — is the
source of truth for identity data; the registry only confirms a runtime is mounted.
Both fall back to `null` when the active tab isn't a resource.

## Script — send

### Pin the resource, submit the prompt, and open the panel

```svelte
  function send(prompt: string, mode: AiMode) {
    setActiveResource(activeResourceId, activeResourceKind);
    void submitAiPrompt(prompt, mode);
    activateAgent();
  }

```

`send` is the bar's submit handler. It first records the active resource so a brand-new
chat pins to the open document, fires the prompt through `submitAiPrompt`, and opens the
inspector so the resulting conversation is visible.

## Script — persona loading effect

### Load personas once per project

```svelte
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

```

A guarded effect loads the persona list whenever the active project changes, remembering
the last-loaded project in `personaProject` so tab switches don't re-fetch. Because the
dock is always mounted, this seeds the bar's picker even while the inspector panel is
closed.

## Markup — the floating bar

### The bottom-anchored, opacity-fading composer wrapper

```svelte
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
```

The wrapper is absolutely positioned and centered at the bottom, with additional input
lines growing upward into the work above. It is `pointer-events-none` (so it doesn't
block the work behind it) while re-enabling pointer events on the bar itself, and fades
between 65% and full opacity based on `active`. `QuarterbackBar` receives the current
mode, personas, and web flag from the store and wires each of its events to the matching
dock action — with `onfocuschange` updating the local `focused` state and `onsend`
routing to `send`.
