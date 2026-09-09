<script lang="ts">
  import type { Component } from "svelte";
  import CalendarClock from "@lucide/svelte/icons/calendar-clock";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import Play from "@lucide/svelte/icons/play";

  import { PanelChoice } from "$authored-components/panel";
  import { ScreenCard, ScreenCards, ScreenNote } from "$authored-components/screen";
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { agentsLibrary, automationDetail } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
  import {
    REPEATS,
    TRIGGER_KINDS,
    TRIGGER_RESOURCE_KINDS,
    WEEKDAYS,
    type AutomationTrigger,
    type AutomationTriggerKind,
    type ScheduleRepeat,
    type Weekday
  } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  let { automationId, disabled = false }: { automationId: string; disabled?: boolean } = $props();

  const view = workspaceState();
  const library = agentsLibrary();
  const detail = $derived(automationDetail(automationId));
  const automation = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );
  const resources = $derived(library.ready ? library.current.resources : []);
  const value = $derived<AutomationTrigger>(automation?.trigger ?? { kind: "manual" });

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

  const save = (next: AutomationTrigger) => {
    if (automation === undefined) return;
    const held = automation;
    void run(surface, "trigger", () => updateAutomation(view, held, { trigger: next }));
  };

  const CARD: Record<
    AutomationTriggerKind,
    { title: string; sub: string; icon: Component<{ size?: number | string }> }
  > = {
    manual: { title: "Manual", sub: "Runs when someone presses Run", icon: Play },
    schedule: { title: "On a schedule", sub: "A time, a repeat and a timezone", icon: CalendarClock },
    "resource-edited": { title: "When a resource is edited", sub: "A kind, or one exact resource", icon: FilePen },
    "resource-created": { title: "When a resource is created", sub: "A kind of resource", icon: FilePlus2 }
  };

  const ZONES = ["America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"];

  const off = $derived(disabled || surface.busy !== undefined || automation === undefined);

  const pick = (kind: AutomationTriggerKind) => {
    if (off || kind === value.kind) return;
    if (kind === "manual") void save({ kind });
    else if (kind === "schedule") {
      void save({ kind, at: "07:00", repeats: "daily", timezone: "America/Chicago" });
    } else if (kind === "resource-edited") void save({ kind, kinds: ["document"] });
    else void save({ kind, kinds: ["document"] });
  };

  const setSchedule = (patch: Partial<Extract<AutomationTrigger, { kind: "schedule" }>>) => {
    if (value.kind !== "schedule") return;
    const next = { ...value, ...patch };
    if (next.repeats !== "weekly") {
      const { weekday, ...rest } = next;
      void weekday;
      void save(rest);
    } else {
      void save({ ...next, weekday: next.weekday ?? "Monday" });
    }
  };

  const setKinds = (kinds: string[]) => {
    if (kinds.length === 0) return;
    if (value.kind === "resource-edited") void save({ ...value, kinds });
    if (value.kind === "resource-created") void save({ kind: "resource-created", kinds });
  };

  const setRef = (choice: string) => {
    if (value.kind !== "resource-edited") return;
    if (choice === "") void save({ kind: "resource-edited", kinds: value.kinds });
    else {
      const option = resources.find((candidate) => `${candidate.ref.kind}/${candidate.ref.id}` === choice);
      if (option) void save({ kind: "resource-edited", kinds: value.kinds, ref: option.ref });
    }
  };

  const refChoice = $derived(
    value.kind === "resource-edited" && value.ref !== undefined
      ? `${value.ref.kind}/${value.ref.id}`
      : ""
  );

  const REPEAT_OPTIONS = REPEATS.map((repeat) => ({
    value: repeat,
    label: repeat === "daily" ? "Daily" : repeat === "weekdays" ? "Weekdays" : "Weekly"
  }));
</script>

<div class="editor">
  {#if surface.failure}
    <ScreenNote tone="gap">{surface.failure}</ScreenNote>
  {/if}
  <ScreenCards min="11rem">
    {#each TRIGGER_KINDS as kind (kind)}
      {@const card = CARD[kind]}
      <ScreenCard
        title={card.title}
        sub={card.sub}
        icon={card.icon}
        selected={value.kind === kind}
        onselect={() => pick(kind)}
      />
    {/each}
  </ScreenCards>

  {#if value.kind !== "manual"}
  <div class="parameters">
    {#if value.kind === "schedule"}
      <div class="fields">
        <label>
          <span>At</span>
          <input
            class="field"
            type="time"
            value={value.at}
            disabled={off}
            onchange={(event) => setSchedule({ at: event.currentTarget.value })}
          />
        </label>
        <div class="stacked">
          <span>Repeats</span>
          <PanelChoice
            label="Repeats"
            value={value.repeats}
            options={REPEAT_OPTIONS}
            flush
            onchange={(next) => setSchedule({ repeats: next as ScheduleRepeat })}
          />
        </div>
        {#if value.repeats === "weekly"}
          <label>
            <span>On</span>
            <select
              class="field"
              value={value.weekday ?? "Monday"}
              disabled={off}
              onchange={(event) => setSchedule({ weekday: event.currentTarget.value as Weekday })}
            >
              {#each WEEKDAYS as day (day)}
                <option value={day}>{day}</option>
              {/each}
            </select>
          </label>
        {/if}
        <label>
          <span>Timezone</span>
          <select
            class="field"
            value={value.timezone}
            disabled={off}
            onchange={(event) => setSchedule({ timezone: event.currentTarget.value })}
          >
            {#each ZONES as zone (zone)}
              <option value={zone}>{zone}</option>
            {/each}
          </select>
        </label>
      </div>
    {:else}
      <div class="fields">
        <div class="stacked wide">
          <span>{value.kind === "resource-edited" ? "Any of these kinds" : "Of these kinds"}</span>
          <ToggleGroup.Root
            type="multiple"
            value={[...value.kinds]}
            onValueChange={(next: string[]) => setKinds(next)}
            variant="outline"
            size="sm"
            disabled={off}
          >
            {#each TRIGGER_RESOURCE_KINDS as kind (kind.id)}
              <ToggleGroup.Item value={kind.id}>{kind.label}</ToggleGroup.Item>
            {/each}
          </ToggleGroup.Root>
        </div>
        {#if value.kind === "resource-edited"}
          <label>
            <span>Or one exact resource</span>
            <select
              class="field"
              value={refChoice}
              disabled={off}
              onchange={(event) => setRef(event.currentTarget.value)}
            >
              <option value="">Any of the kinds above</option>
              {#each resources as option (`${option.ref.kind}/${option.ref.id}`)}
                <option value="{option.ref.kind}/{option.ref.id}">{option.name}</option>
              {/each}
            </select>
          </label>
        {/if}
      </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .parameters {
    padding: calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: start;
  }

  .fields label,
  .stacked {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .stacked.wide {
    grid-column: 1 / -1;
  }

  .fields span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .field {
    height: calc(var(--token-spacing-unit) * 8);
    padding: 0 calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
    font: inherit;
    font-size: var(--token-text-body-sm);
  }
</style>
