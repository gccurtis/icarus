<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { actionsFor, type ActionOption } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The action half of an Automation: the two things a rule can do.
   *
   * `docs/screen-panel-views/context/agents/do-this.md` is the specification. A
   * chooser like [When](./when.svelte), for the same reason: a rule has exactly
   * one action, so the chosen one is expanded and marked and the other collapses
   * to its name.
   *
   * **The block chooser lists every block either way**, because that section is
   * a list of candidates as well as a summary of the choice.
   *
   * **The set is keyed on the choice**, since `PanelSection` reads `open` once
   * and a new choice has to open its own section.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const options = $derived(actionsFor(automationId).current);

  const stored = $derived(
    options.find((option: ActionOption) => option.chosen)?.kind ?? "ask-agent"
  );

  /** The choice in this session, once someone has made one. */
  let picked = $state<ActionOption["kind"] | undefined>(undefined);
  const chosen = $derived(picked ?? stored);

  const storedName = $derived(
    options.find((option: ActionOption) => option.kind === stored)?.name ?? "nothing"
  );

  /** Which block, once someone has chosen a different one. */
  let pickedBlock = $state<string | undefined>(undefined);
</script>

<Panel title="Do this">
  {#if chosen !== stored}
    <PanelNote>
      Not saved. The rule still does {storedName.toLowerCase()} until this is
      written back.
    </PanelNote>
  {/if}

  {#key chosen}
    {#each options as option (option.kind)}
      <PanelSection title={option.name} open={option.kind === chosen} flush={option.kind === "refresh-block"}>
        {#if option.kind !== chosen}
          <PanelNote>{option.blurb}.</PanelNote>
          <PanelButton label="Do this instead" icon={Check} onclick={() => (picked = option.kind)} />
        {:else if option.kind === "ask-agent"}
          <PanelChip tone="active">Chosen</PanelChip>
          <PanelFields>
            <PanelField label="Agent">
              {#if option.agent && option.agentName}
                {@const agentId = option.agent}
                <PanelLink
                  label={option.agentName}
                  title="{option.agentName} — agent"
                  onselect={() =>
                    view.inspect("agents.persona", { kind: "persona", id: agentId })}
                />
              {:else}
                No agent chosen yet
              {/if}
            </PanelField>
            <PanelField label="Ask it to" stacked>
              {option.prompt ?? "Nothing to ask yet"}
            </PanelField>
          </PanelFields>
          <!-- The instruction is what the agent gets. Nothing is added to it and
               nothing is templated into it. -->
          <PanelNote>The instruction is sent verbatim.</PanelNote>
        {:else}
          <!--
            The chosen block is marked by the row rather than by a chip: this
            section runs its rows to the panel's edges, and a chip at that edge
            would sit a step to the left of everything under it.
          -->
          {#each option.blocks as block (block.id)}
            <PanelRow
              title={block.name}
              sub="In {block.resource} · {block.location}"
              icon={RefreshCw}
              selected={block.id === (pickedBlock ?? option.chosenBlock)}
              onselect={() => (pickedBlock = block.id)}
            />
          {/each}
          <PanelNote tone="gap">
            A block stores no pointer back to what it lives in, so where a block
            lives is a reverse query — and it sometimes comes back empty.
          </PanelNote>
        {/if}
      </PanelSection>
    {/each}
  {/key}
</Panel>
