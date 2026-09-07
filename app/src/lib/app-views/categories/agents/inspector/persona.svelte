<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Target from "@lucide/svelte/icons/target";
  import Wrench from "@lucide/svelte/icons/wrench";

  import {
    Panel,
    PanelBanner,
    PanelEmpty,
    PanelRow,
    PanelSection,
    PanelSkeleton
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import DefinitionModal from "$app-views/categories/agents/components/definition-modal.svelte";
  import {
    agentsLibrary,
    inspectTask,
    inspectTool,
    isSelected,
    messageOf,
    openPersona,
    openTask,
    personaDetail,
    taskRowsIn,
    updatePersona,
    type TaskRow
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { scopeRows } from "$app-views/categories/agents/procedures/scope";
  import { toolOf } from "$app-views/categories/agents/procedures/vocabulary";
  import type { PersonaSectionName, UpdatePersonaPatch } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const personaId = $derived(view.selection?.kind === "persona" ? view.selection.id : undefined);
  const detail = $derived(personaDetail(personaId));
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const persona = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );
  const answer = $derived(library.ready ? library.current : undefined);
  const work = $derived(taskRowsIn(answer, now).filter((row) => row.personaId === persona?.id));
  const running = $derived(work.filter((row) => row.state === "running"));
  const review = $derived(work.filter((row) => row.state === "review"));
  const reach = $derived(
    scopeRows(persona?.scope ?? null, answer?.resourceSets ?? [], answer?.resources ?? [])
  );

  const SECTIONS: readonly { name: PersonaSectionName; label: string }[] = [
    { name: "focus", label: "Focus" },
    { name: "background", label: "Background" },
    { name: "approach", label: "Approach" },
    { name: "outputPreferences", label: "Output" },
    { name: "verification", label: "Verification" }
  ];

  let editing = $state<string>();

  let pending = $state<string>();
  let actionError = $state<string>();

  const save = async (label: string, patch: UpdatePersonaPatch) => {
    if (persona === undefined) return;
    pending = label;
    actionError = undefined;
    try {
      const result = await updatePersona(view, persona, patch);
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const rename = (element: HTMLInputElement) => {
    if (persona === undefined) return;
    const next = element.value.trim();
    if (next === "") {
      element.value = persona.name;
      return;
    }
    if (next !== persona.name) void save("name", { name: next });
  };

  const describe = (next: string) => {
    if (persona === undefined) return;
    const text = next.trim();
    if (text === (persona.description ?? "")) return;
    void save("description", { description: text === "" ? null : text });
  };

  const progressOf = (row: TaskRow): string =>
    row.progress.total === 0
      ? "no plan yet"
      : row.progress.percent === null
        ? "—"
        : `${row.progress.percent}%`;
</script>

{#snippet taskRows(rows: readonly TaskRow[], tone: "active" | "intelligence")}
  {#each rows as row (row.id)}
    <div role="presentation" ondblclick={() => openTask(view, row.id)}>
      <PanelRow
        title={row.title}
        sub="{row.started} · {progressOf(row)}"
        icon={Sparkles}
        {tone}
        titleTone={row.openQuestions > 0 ? "attention" : undefined}
        selected={isSelected(view, "task", row.id)}
        onselect={() => inspectTask(view, row.id)}
      />
    </div>
  {/each}
{/snippet}

{#if detail === undefined}
  <Panel title="Persona">
    <PanelEmpty title="Select a persona to inspect it." />
  </Panel>
{:else if detail.error}
  <Panel title="Persona">
    <PanelBanner title="Persona unavailable" tone="danger">{messageOf(detail.error)}</PanelBanner>
  </Panel>
{:else if !detail.ready}
  <Panel title="Persona">
    <PanelSkeleton shape="fields" count={6} />
  </Panel>
{:else if persona === undefined}
  <Panel title="Persona">
    <PanelEmpty title="That persona is not in this project." />
  </Panel>
{:else}
  <Panel title="Persona">
    {#if actionError}
      <PanelBanner title="That did not save" tone="attention">{actionError}</PanelBanner>
    {/if}

    <div class="head">
      <Input
        value={persona.name}
        placeholder="Name the persona"
        aria-label="Persona name"
        disabled={pending !== undefined}
        class="text-body font-medium"
        onchange={(event) => rename(event.currentTarget)}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <Textarea
        value={persona.description ?? ""}
        rows={3}
        placeholder="What it is for"
        aria-label="Persona description"
        disabled={pending !== undefined}
        class="text-body-sm max-h-28 resize-none overflow-y-auto"
        onchange={(event) => describe(event.currentTarget.value)}
      />
      <Button variant="default" size="sm" class="w-full" onclick={() => openPersona(view, persona.id)}>
        <FolderOpen aria-hidden="true" />
        Open
      </Button>
    </div>

    {#if running.length > 0}
      <PanelSection title="Running" flush>
        {@render taskRows(running, "active")}
      </PanelSection>
    {/if}
    {#if review.length > 0}
      <PanelSection title="Pending review" flush>
        {@render taskRows(review, "intelligence")}
      </PanelSection>
    {/if}
    {#if running.length + review.length === 0}
      <PanelSection title="Tasks" flush>
        <PanelEmpty title="Nothing running or waiting for review." flush />
      </PanelSection>
    {/if}

    <div class="rule"></div>

    <PanelSection title="Definition" flush open={false}>
      {#each SECTIONS as section (section.name)}
        <PanelRow
          title={section.label}
          sub={persona.definition[section.name].trim() === "" ? "Not written" : undefined}
          onselect={() => (editing = section.name)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Default scope" count={reach.length} flush open={false}>
      {#each reach as row (row.key)}
        <PanelRow title={row.title} sub={row.detail} icon={Target} tone="intelligence" />
      {:else}
        <PanelEmpty title="Nothing chosen; it reads nothing." flush />
      {/each}
    </PanelSection>

    <PanelSection title="Default tools" count={persona.tools.length} flush open={false}>
      {#each persona.tools as toolId (toolId)}
        {@const tool = toolOf(toolId)}
        <PanelRow
          title={tool?.name ?? toolId}
          sub={tool?.does}
          icon={Wrench}
          selected={isSelected(view, "tool", toolId) && view.selection?.at === persona.id}
          onselect={() => inspectTool(view, toolId, persona.id)}
        />
      {:else}
        <PanelEmpty title="No tool is allowed by default." flush />
      {/each}
    </PanelSection>

    <DefinitionModal
      personaId={persona.id}
      name={persona.name}
      section={editing ?? "focus"}
      open={editing !== undefined}
      onclose={() => (editing = undefined)}
    />
  </Panel>
{/if}

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 3);
  }

  .rule {
    height: 1px;
    margin: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    background: var(--token-border-subtle);
  }
</style>
