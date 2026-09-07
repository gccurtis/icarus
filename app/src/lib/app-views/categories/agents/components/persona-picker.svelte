<script lang="ts">
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";

  import { PanelActor } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import * as Command from "$vendored-components/command";
  import * as Popover from "$vendored-components/popover";
  import { agentsLibrary } from "$app-views/categories/agents/procedures/library.svelte";

  let {
    value,
    disabled = false,
    onchange
  }: {
    value?: string;
    disabled?: boolean;
    onchange: (personaId: string) => void;
  } = $props();

  const library = agentsLibrary();
  const personas = $derived(library.ready ? library.current.personas : []);

  let open = $state(false);

  const chosen = $derived(personas.find((persona) => persona.id === value));
</script>

<Popover.Root bind:open>
  <Popover.Trigger {disabled}>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-label="Persona"
        class="picker h-auto w-full justify-between py-2"
      >
        <span class="chosen">
          {#if chosen}
            <PanelActor name={chosen.name} kind="agent" role={chosen.description ?? undefined} />
          {:else}
            <span class="text-ink-muted">Choose a persona</span>
          {/if}
        </span>
        <ChevronsUpDown aria-hidden="true" class="text-ink-muted shrink-0" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-80 p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search personas" />
      <Command.List>
        <Command.Empty>No persona is named that way.</Command.Empty>
        <Command.Group>
          {#each personas as persona (persona.id)}
            <Command.Item
              value={persona.name}
              onSelect={() => {
                onchange(persona.id);
                open = false;
              }}
            >
              <PanelActor name={persona.name} kind="agent" role={persona.description ?? undefined} />
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>

<style>
  :global(.picker) {
    text-align: start;
  }

  .chosen {
    display: flex;
    min-width: 0;
    flex: 1;
  }

  .chosen > :global(*) {
    min-width: 0;
    flex: 1;
  }

  .chosen :global(.text-caption) {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
