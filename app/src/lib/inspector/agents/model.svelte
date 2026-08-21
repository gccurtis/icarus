<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$lib/unique-components/panel";
  import { modelBindingOf, persona } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Which binding runs this agent.
   *
   * `docs/screen-panel-views/inspector/agents/model.md` is the specification, and
   * this is the shortest lens on the screen on purpose.
   *
   * **A binding name, and nothing else.** Providers, credentials, endpoints and
   * deployment setup belong outside the project workbench, and this is exactly
   * the place a settings screen would grow if nobody said so.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const profile = $derived(persona(personaId).current);
  const binding = $derived(modelBindingOf(personaId).current);

  /** Held locally: the door is a read, and an edit that vanished on the next read
   * would be worse than one that is plainly local. */
  let picked = $state<string | undefined>(undefined);

  const chosen = $derived(picked ?? binding.name);
  const options = $derived(binding.available.map((name: string) => ({ value: name, label: name })));
</script>

<Panel title="Model">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: profile.name, key: "agents.persona" },
        { label: "Tools" },
        { label: "Model" }
      ]}
      onnavigate={(key: string) =>
        mockWorkbench.inspect(key, { kind: "persona", id: personaId })}
    />
  {/snippet}

  <PanelSection title="Binding" flush>
    <PanelFields>
      <PanelField label="Name" stacked>
        <PanelSelect
          label="Model binding"
          value={chosen}
          {options}
          onchange={(next: string) => (picked = next)}
        />
      </PanelField>
      <PanelField label="Default">
        <!--
          The door answers for the stored binding only. Which of the others the
          deployment treats as its default is deployment configuration, and
          guessing it here would put a claim on the screen nothing supports.
        -->
        {#if chosen === binding.name}
          {binding.isDefault ? "Yes" : "No"}
        {:else}
          Not known until this is saved
        {/if}
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Boundary" flush>
    <PanelNote>
      A binding name is the whole of it. Providers, credentials and deployment
      setup are outside the project workbench and never appear here.
    </PanelNote>
    <PanelNote tone="gap">
      Where the list of bindings comes from is unsettled. Bindings are deployment
      configuration rather than project data, so nothing in the project owns them.
    </PanelNote>
  </PanelSection>
</Panel>
