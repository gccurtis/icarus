<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import AtSign from "@lucide/svelte/icons/at-sign";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Settings from "@lucide/svelte/icons/settings";

  /**
   * The project's own Overview: what it is, what state it is in, who is here,
   * and what is waiting on you.
   *
   * The first rail entry and the default, because it answers "where am I and
   * what is outstanding" without requiring a click.
   *
   * **Needs you is the only interrupting section**, and it holds two kinds of
   * thing: a person addressed you, or something is broken. Nothing else earns a
   * place above the fold.
   *
   * Fixture content throughout — every count here is a project-scoped query no
   * capability can answer yet.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  const HERE_NOW = ["AR", "TK", "MJ"];
</script>

<Panel title="Overview">
  {#snippet actions()}
    <PanelButton
      label="Settings"
      icon={Settings}
      onclick={() => workbench.inspect("project.self")}
    />
  {/snippet}

  <PanelSection title="This project">
    <PanelFields>
      <PanelField label="Name" stacked>Northwind Grid Resilience</PanelField>
      <PanelField label="About" stacked>
        Winter-storm hardening case for the 2026 rate filing.
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="State">
    <PanelFields>
      <PanelField label="Status"><PanelChip tone="success">Active</PanelChip></PanelField>
      <PanelField label="Your role"><PanelChip tone="interactive">Owner</PanelChip></PanelField>
      <PanelField label="Members" mono>7</PanelField>
      <PanelField label="Project work" mono>24 items</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Here now">
    <div class="faces">
      {#each HERE_NOW as initials (initials)}
        <button
          type="button"
          class="face"
          title={initials}
          onclick={() => workbench.inspect("actor.person")}
        >
          {initials}
        </button>
      {/each}
    </div>
  </PanelSection>

  <PanelSection title="Needs you" count={2} flush>
    <PanelRow
      title="4 mentions"
      sub="Unread"
      icon={AtSign}
      tone="active"
      onselect={() => workbench.inspect("project.mention")}
    />
    <PanelRow
      title="SharePoint can't sync"
      sub="Authentication expired"
      icon={Link2}
      tone="danger"
      onselect={() => workbench.inspect("project.connector")}
    />
  </PanelSection>

  <PanelSection title="Dates" open={false}>
    <PanelFields>
      <PanelField label="Created" mono>12 Mar 2026</PanelField>
      <PanelField label="Updated" mono>4 minutes ago</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>

<style>
  .faces {
    display: flex;
    gap: var(--token-spacing-unit);
    padding-inline: calc(var(--token-spacing-unit) * 3);
  }

  .face {
    width: calc(var(--token-spacing-unit) * 7);
    height: calc(var(--token-spacing-unit) * 7);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--token-color-interactive-border);
    border-radius: 999px;
    background-color: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
    font-size: var(--token-text-caption);
    font-weight: 600;
    cursor: pointer;
  }
</style>
