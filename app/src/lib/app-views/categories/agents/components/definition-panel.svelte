<script lang="ts">
  import { ScreenNote } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as Tabs from "$vendored-components/tabs";
  import { Textarea } from "$vendored-components/textarea";
  import { personaDetail } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { updatePersona } from "$app-views/categories/agents/procedures/update-persona";
  import type { PersonaSectionName } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    personaId,
    section = "focus",
    withSave = false,
    disabled = false,
    onsection
  }: {
    personaId: string;
    section?: string;
    withSave?: boolean;
    disabled?: boolean;
    onsection?: (next: string) => void;
  } = $props();

  const view = workspaceState();
  const detail = $derived(personaDetail(personaId));
  const persona = $derived(detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined);

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

  const SECTIONS: readonly { name: PersonaSectionName; label: string; purpose: string }[] = [
    {
      name: "focus",
      label: "Focus",
      purpose: "What to concentrate on, and what to leave to someone else."
    },
    {
      name: "background",
      label: "Background",
      purpose: "What it is expected to already know before the first call."
    },
    {
      name: "approach",
      label: "Approach",
      purpose: "How to go about the work: the order, the method, and where to stop."
    },
    {
      name: "outputPreferences",
      label: "Output",
      purpose: "The shape of what comes back, so it can be read without being reformatted."
    },
    {
      name: "verification",
      label: "Verification",
      purpose: "What has to be true before it answers at all."
    }
  ];

  let picked = $state<string>();
  const chosen = $derived(picked ?? section);
  const shown = $derived(SECTIONS.find((entry) => entry.name === chosen) ?? SECTIONS[0]);
  const saved = $derived(persona?.definition[shown.name] ?? "");

  let drafts = $state<Record<string, string>>({});
  const draft = $derived(drafts[shown.name] ?? saved);
  const dirty = $derived(draft.trim() !== saved.trim());

  const save = () => {
    if (persona === undefined || !dirty) return;
    const held = persona;
    const name = shown.name;
    const text = drafts[name] ?? "";
    void run(
      surface,
      "save",
      () => updatePersona(view, held, { section: { name, text } }),
      () => (drafts = { ...drafts, [name]: undefined as unknown as string })
    );
  };
</script>

<div class="definition">
  <Tabs.Root
    value={chosen}
    onValueChange={(next: string) => {
      picked = next;
      onsection?.(next);
    }}
    class="section-stack"
  >
    <Tabs.List variant="line">
      {#each SECTIONS as entry (entry.name)}
        <Tabs.Trigger value={entry.name}>{entry.label}</Tabs.Trigger>
      {/each}
    </Tabs.List>

    {#each SECTIONS as entry (entry.name)}
      <Tabs.Content value={entry.name} class="section-pane">
        <p class="purpose">{entry.purpose}</p>
        <Textarea
          value={drafts[entry.name] ?? (persona?.definition[entry.name] ?? "")}
          placeholder="Nothing written. This section is left out of the prompt."
          aria-label="{entry.label} text"
          disabled={disabled || surface.busy !== undefined}
          class="h-full resize-none"
          oninput={(event) => (drafts = { ...drafts, [entry.name]: event.currentTarget.value })}
          onblur={save}
        />
      </Tabs.Content>
    {/each}
  </Tabs.Root>

  {#if surface.failure}
    <ScreenNote tone="gap">{surface.failure}</ScreenNote>
  {/if}

  {#if withSave}
    <div class="foot">
      <span class="text-caption text-ink-muted">
        {surface.busy !== undefined ? "Saving…" : dirty ? "Not saved yet" : "Saved"}
      </span>
      <Button
        size="sm"
        disabled={disabled || surface.busy !== undefined || !dirty}
        onclick={save}
      >Save</Button>
    </div>
  {/if}
</div>

<style>
  .definition {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .definition :global(.section-stack) {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .definition :global(.section-pane) {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .purpose {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: calc(var(--token-spacing-unit) * 3);
  }
</style>
