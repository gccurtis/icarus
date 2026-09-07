<script lang="ts">
  import { onDestroy } from "svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSkeleton
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import {
    agentsLibrary,
    createPersona,
    inspectPersona,
    isSelected,
    messageOf,
    nextName,
    openPersona
  } from "$app-views/categories/agents/procedures/library.svelte";
  import type { PersonaItem } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });

  const personas = $derived(library.ready ? library.current.personas : []);

  let query = $state("");
  const needle = $derived(query.trim().toLocaleLowerCase());
  const shown = $derived(
    personas.filter(
      (persona) =>
        needle === "" ||
        persona.name.toLocaleLowerCase().includes(needle) ||
        (persona.description ?? "").toLocaleLowerCase().includes(needle)
    )
  );

  const chosen = $derived(view.selection?.kind === "persona" ? view.selection.id : undefined);

  const sub = (persona: PersonaItem): string => {
    const tasks = `${persona.counts.tasks} ${persona.counts.tasks === 1 ? "task" : "tasks"}`;
    const parts = [tasks];
    if (persona.counts.running > 0) parts.push(`${persona.counts.running} running`);
    if (persona.counts.review > 0) parts.push(`${persona.counts.review} to review`);
    return parts.join(" · ");
  };

  let pending = $state(false);
  let actionError = $state<string>();

  const make = async () => {
    if (pending) return;
    pending = true;
    actionError = undefined;
    try {
      const result = await createPersona(
        view,
        nextName("Untitled persona", personas.map((persona) => persona.name))
      );
      if (live) openPersona(view, result.id);
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = false;
    }
  };
</script>

<Panel title="Personas">
  {#snippet actions()}
    <PanelButton label="New" icon={Plus} tone="primary" disabled={pending} onclick={make} />
    <PanelButton
      label="Open"
      icon={FolderOpen}
      disabled={chosen === undefined}
      title={chosen === undefined ? "Choose a persona first" : "Open the persona"}
      onclick={() => chosen && openPersona(view, chosen)}
    />
  {/snippet}

  {#if library.error}
    <PanelBanner title="Personas unavailable" tone="danger">{messageOf(library.error)}</PanelBanner>
    <div class="px-3 pt-2">
      <Button variant="outline" size="sm" onclick={() => library.refresh()}>Retry</Button>
    </div>
  {:else if !library.ready}
    <PanelSkeleton shape="rows" count={4} />
  {:else}
    {#if actionError}
      <PanelBanner title="The persona was not created" tone="attention">{actionError}</PanelBanner>
    {/if}
    <PanelSearch
      placeholder="Search personas"
      matched={shown.length === 0 ? 0 : undefined}
      flush
      empty="No persona is named that way."
      bind:value={query}
    >
      {#each shown as persona (persona.id)}
        <div role="presentation" ondblclick={() => openPersona(view, persona.id)}>
          <PanelRow
            title={persona.name}
            sub={sub(persona)}
            icon={Bot}
            tone={persona.counts.running > 0 ? "active" : "default"}
            selected={isSelected(view, "persona", persona.id)}
            onselect={() => inspectPersona(view, persona.id)}
          />
        </div>
      {/each}
    </PanelSearch>
  {/if}
</Panel>
