<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { PanelChip, PanelSentence } from "$authored-components/panel";
  import { ScreenEmpty, ScreenGroup, ScreenNote } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { Switch } from "$vendored-components/switch";
  import { Textarea } from "$vendored-components/textarea";
  import Grants from "$app-views/categories/agents/components/grants.svelte";
  import NameInput from "$app-views/categories/agents/components/name-input.svelte";
  import PersonaPicker from "$app-views/categories/agents/components/persona-picker.svelte";
  import RemoteState from "$app-views/categories/agents/components/remote-state.svelte";
  import SurfaceBand from "$app-views/categories/agents/components/surface-band.svelte";
  import SurfaceHead from "$app-views/categories/agents/components/surface-head.svelte";
  import TaskTable from "$app-views/categories/agents/components/task-table.svelte";
  import TriggerEditor from "$app-views/categories/agents/components/trigger-editor.svelte";
  import { AutomationState } from "$app-views/categories/agents/content/automation.state.svelte";
  import {
    agentsLibrary,
    automationDetail,
    messageOf
  } from "$app-views/categories/agents/procedures/agents";
  import { followShownThing } from "$app-views/categories/agents/procedures/effects/claim.svelte";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { openTask, showLibrary } from "$app-views/categories/agents/procedures/navigate";
  import { removeAutomation } from "$app-views/categories/agents/procedures/remove-automation";
  import { run } from "$app-views/categories/agents/procedures/run";
  import { runAutomation } from "$app-views/categories/agents/procedures/run-automation";
  import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import { TRIGGER_LABEL, triggerClause } from "$app-views/categories/agents/procedures/vocabulary";
  import type { UpdateAutomationPatch } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const automationId = $derived(view.active.focus);
  const detail = $derived(automationDetail(automationId));
  const library = agentsLibrary();

  const surface = new AutomationState();
  const clock = startClock();
  releaseWhenGone(surface);

  const automation = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );

  followShownThing(view, surface, () =>
    automation === undefined ? undefined : { kind: "automation", id: automation.id }
  );

  const save = (label: string, patch: UpdateAutomationPatch) => {
    if (automation === undefined) return;
    const held = automation;
    void run(surface, label, () => updateAutomation(view, held, patch));
  };

  const fire = () => {
    if (automation === undefined) return;
    const held = automation;
    void run(
      surface,
      "run",
      () => runAutomation(view, held.id),
      (fired) => openTask(view, fired.taskId)
    );
  };

  const remove = () => {
    if (automation === undefined) return;
    const held = automation;
    void run(surface, "delete", () => removeAutomation(view, held), () => {
      view.clear();
      showLibrary(view);
    });
  };

  const short = (text: string) => (text.length > 96 ? `${text.slice(0, 96).trimEnd()}…` : text);
  const unwritten = $derived(automation !== undefined && automation.instruction.trim() === "");
</script>

<div class="surface">
  <RemoteState
    ready={library.ready && detail !== undefined && detail.ready}
    error={library.error !== undefined
      ? messageOf(library.error)
      : detail?.error !== undefined
        ? messageOf(detail.error)
        : undefined}
    what="The automation"
    onretry={() => {
      void library.refresh();
      void detail?.refresh();
    }}
  >
    {#if automation === undefined}
      <div class="p-6">
        <ScreenEmpty title="That automation is not in this project">
          It may have been removed, or it belongs to another project.
        </ScreenEmpty>
        <Button variant="outline" size="sm" onclick={() => showLibrary(view)}>Back to the library</Button>
      </div>
    {:else}
      <SurfaceBand kicker="Automation" onback={() => showLibrary(view)} />

      <div class="body">
        <SurfaceHead>
          <NameInput
            value={automation.name}
            label="Automation name"
            placeholder="Name the automation"
            onsave={(next) => save("name", { name: next })}
          />
          <div class="chips">
            <PanelChip tone="neutral">{TRIGGER_LABEL[automation.trigger.kind]}</PanelChip>
            <PanelChip tone={automation.enabled ? "success" : "inactive"}>{automation.enabled ? "On" : "Off"}</PanelChip>
            {#if automation.running > 0}
              <PanelChip tone="attention">{automation.running} running</PanelChip>
            {/if}
            <span class="text-caption text-ink-muted">
              {#if automation.firedCount === 0}
                Never fired
              {:else}
                Fired {automation.firedCount} {automation.firedCount === 1 ? "time" : "times"}
                {#if automation.lastFiredAt !== null}· last {relativeTime(automation.lastFiredAt, clock.now)}{/if}
              {/if}
              {#if surface.busy !== undefined}· saving {surface.busy}…{/if}
            </span>
          </div>
          {#snippet actions()}
            <label
              class="text-caption text-ink-secondary flex items-center gap-2"
              title={unwritten && !automation.enabled ? "Write the instruction under Do this first" : undefined}
            >
              <Switch
                size="sm"
                checked={automation.enabled}
                disabled={surface.busy !== undefined || (unwritten && !automation.enabled)}
                onCheckedChange={(next: boolean) => save("enabled", { enabled: next })}
              />
              On
            </label>
            <Button
              variant="default"
              size="sm"
              disabled={surface.busy !== undefined || unwritten}
              title={unwritten ? "Write the instruction under Do this first" : "Start one task from this now"}
              onclick={fire}
            >
              <Play aria-hidden="true" />
              {surface.busy === "run" ? "Starting…" : "Run now"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-danger-text"
              disabled={surface.busy !== undefined || automation.firedCount > 0}
              title={automation.firedCount > 0 ? "It has fired tasks that still name it. Switch it off instead." : "Delete this automation"}
              onclick={remove}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          {/snippet}
        </SurfaceHead>

        {#if surface.failure}
          <ScreenNote tone="gap">{surface.failure}</ScreenNote>
        {/if}

        <div class="sentence" class:off={!automation.enabled}>
          <PanelSentence size="head" lead="When" join="ask" tone={automation.enabled ? "default" : "inactive"}>
            {#snippet when()}{triggerClause(automation.trigger, automation.triggerRefName ?? undefined)}{/snippet}
            {#snippet then()}{automation.personaName} to {unwritten ? "…" : short(automation.instruction)}{/snippet}
          </PanelSentence>
        </div>

        <ScreenGroup label="Trigger" tone="intelligence">
          <TriggerEditor automationId={automation.id} disabled={surface.busy !== undefined} />
        </ScreenGroup>

        <ScreenGroup label="Do this">
          <div class="do">
            <div class="stack">
              <span class="text-caption text-ink-muted">Ask</span>
              <PersonaPicker
                value={automation.personaId}
                disabled={surface.busy !== undefined}
                onchange={(id) => save("persona", { personaId: id })}
              />
            </div>
            <div class="stack">
              <span class="text-caption text-ink-muted">To</span>
              <Textarea
                rows={5}
                value={automation.instruction}
                placeholder="What to ask, in full. It is sent verbatim each time."
                aria-label="Instruction"
                disabled={surface.busy !== undefined}
                onchange={(event) => {
                  const next = event.currentTarget.value.trim();
                  if (next !== "" && next !== automation.instruction) void save("instruction", { instruction: next });
                }}
              />
            </div>
          </div>
        </ScreenGroup>

        <Grants label="Allowed" owner={automation.id} disabled={surface.busy !== undefined} />

        <ScreenGroup label="Fired">
          <TaskTable automation={automation.id} />
        </ScreenGroup>
      </div>
    {/if}
  </RemoteState>
</div>

<style>
  .surface {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .body {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 6);
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 6);
    scrollbar-width: none;
  }

  .sentence {
    max-width: 80ch;
    padding: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid var(--token-color-intelligence-border);
    border-radius: 0 var(--token-radius-panel) var(--token-radius-panel) 0;
    background: var(--token-color-intelligence-surface);
  }

  .sentence.off {
    border-inline-start-color: var(--token-border-strong);
    background: var(--token-surface-elevated);
  }

  .do {
    display: grid;
    grid-template-columns: minmax(16rem, 2fr) minmax(0, 3fr);
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: start;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  @media (max-width: 64rem) {
    .do {
      grid-template-columns: 1fr;
    }
  }
</style>
