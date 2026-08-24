<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    automation as automationDoor,
    triggersFor,
    type TriggerOption
  } from "$mock-capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What makes an Automation fire — the choice between the five, and the detail
   * of whichever is chosen.
   *
   * **One lens for all five kinds, not five lenses.** They are alternatives to
   * one another, so the interesting act here is switching between them, and a
   * lens per kind would make that act a navigation. The chosen one's detail is
   * the only thing that varies, and it is one field.
   *
   * **`Only when I say` is a real trigger, not the absence of one.** A rule that
   * never fires on its own is a saved action you run deliberately, and calling
   * that "no trigger" is how it ends up looking broken in a health list.
   */
  let { automationId }: { automationId?: string } = $props();

  const id = $derived(automationId ?? view.active.focus ?? "nightly-digest");

  const rule = $derived(automationDoor(id).current);
  const options = $derived(triggersFor(id).current);
  const chosen = $derived(
    options.find((option: TriggerOption) => option.chosen) ?? options[0]
  );

  /** The one field that varies with the kind. Absent means the kind carries none. */
  const detail = $derived(
    chosen.kind === "schedule"
      ? chosen.schedule
        ? `${chosen.schedule.at} ${chosen.schedule.timezone} · ${chosen.schedule.repeats}`
        : undefined
      : chosen.kind === "resource-change"
        ? chosen.watches
        : chosen.kind === "connector-sync"
          ? chosen.connector
          : chosen.kind === "finding-accepted"
            ? chosen.question
            : undefined
  );
</script>

<Panel title="When it happens">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: rule.name, key: "agents.automation" }, { label: "When" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "automation", id: rule.id });
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Fires on"><PanelChip tone="intelligence">{chosen.name}</PanelChip></PanelField>
    {#if detail}
      <PanelField label="Which">{detail}</PanelField>
    {/if}
    <PanelField label="Last fired">{rule.lastFire.when} · {rule.lastFire.result}</PanelField>
    <PanelField label="Fired about">~{rule.lastFire.firedAbout} times</PanelField>
  </PanelFields>

  {#if rule.lastFire.why}
    <PanelNote tone="gap">{rule.lastFire.why}</PanelNote>
  {/if}

  <PanelSection title="Or fire on" count={options.length} flush>
    {#each options as option (option.kind)}
      <PanelRow
        title={option.name}
        sub={option.blurb}
        selected={option.chosen}
        onselect={() => view.inspect("agents.trigger", { kind: "trigger", id: option.kind })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Choosing a different trigger selects it here and nothing more. No capability
    writes a rule back.
  </PanelNote>
</Panel>
