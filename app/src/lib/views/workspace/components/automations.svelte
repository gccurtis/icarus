<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import FileText from "@lucide/svelte/icons/file-text";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Quote from "@lucide/svelte/icons/quote";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { clientModel, type Tab } from "$model/client";
  import {
    PanelChip,
    PanelField,
    PanelFields,
    PanelQuote,
    PanelToggle
  } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCell,
    ScreenFilters,
    ScreenHeader,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";

  /**
   * Automations — standing one-trigger, one-action rules.
   *
   * **A rule is a sentence with two blanks in it.** The editor states the
   * sentence as the page heading and gives one column per blank, so reading the
   * rule never requires reading the two columns.
   *
   * **A fire is a dispatch.** Success means the task was created, not that it
   * finished — which is why the word is Started, and why the list's last column
   * is the only place in the application a table reports a result. Here the
   * dispatch *is* the subject.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  let editing = $state(false);

  const RULES = [
    { on: true, name: "Nightly filing digest", when: "02:00 daily", does: "Ask Filing Editor", fired: "Today, 02:00", result: "Couldn't start", tone: "danger" as const },
    { on: true, name: "Refresh outage summary", when: "SharePoint syncs", does: "Re-run a generated block", fired: "2 hours ago", result: "Started", tone: "success" as const },
    { on: true, name: "Brief on new finding", when: "A finding is accepted", does: "Ask Grid Analyst", fired: "Yesterday", result: "Started", tone: "success" as const },
    { on: false, name: "Weekly board pack", when: "Mondays, 07:00", does: "Ask Filing Editor", fired: "Never", result: "—", tone: "neutral" as const }
  ];

  const TRIGGERS = [
    { name: "On a schedule", about: "A time and a timezone", icon: Calendar, chosen: true },
    { name: "Something changes", about: "A kind of resource, or one exact resource", icon: FileText },
    { name: "A connector syncs", about: "One connector", icon: Link2 },
    { name: "A finding is accepted", about: "Optionally under one question", icon: Quote },
    { name: "Only when I say", about: "Never fires on its own", icon: Play }
  ];

  const ACTIONS = [
    { name: "Ask an agent to do something", about: "A Persona and what to ask it", icon: Sparkles, chosen: true },
    { name: "Re-run a generated block", about: "One prompt block in a document, deck or spreadsheet", icon: RefreshCw }
  ];
</script>

{#if editing}
  <div class="flex h-full min-h-0 flex-col">
    <ScreenBar title="Nightly filing digest" onback={() => (editing = false)} backLabel="Back to list">
      {#snippet meta()}
        <PanelToggle checked label="Nightly filing digest is on" />
        <span class="text-caption text-ink-muted">On</span>
      {/snippet}
      {#snippet actions()}
        <PanelChip tone="success">Saved</PanelChip>
      {/snippet}
    </ScreenBar>

    <ScreenSurface>
      <!--
        The sentence, with each half tinted to match the column it comes from.
        Reading the rule should not require reading the columns.
      -->
      <div class="flex flex-col gap-1">
        <h1 class="text-h4 leading-h4 m-0 font-semibold">
          When <span class="text-active-text">the clock reaches 02:00 in New York</span>,
          <span class="text-intelligence-text">ask Filing Editor to do something</span>.
        </h1>
        <p class="text-body-sm text-ink-muted m-0">
          One trigger, one action. Two things to do means two Automations.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="flex flex-col gap-3">
          <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">When</span>
          {#each TRIGGERS as trigger (trigger.name)}
            {@const Icon = trigger.icon}
            <button
              type="button"
              onclick={() => workbench.inspect("automations.trigger")}
              aria-current={trigger.chosen ? "true" : undefined}
              class="border-border-subtle bg-surface-panel hover:border-interactive-border aria-[current]:border-active-border aria-[current]:bg-active-surface rounded-panel flex cursor-pointer items-start gap-3 border p-3 text-start"
            >
              <span class="text-ink-muted mt-0.5 shrink-0"><Icon size={16} aria-hidden="true" /></span>
              <span class="flex flex-col">
                <span class="text-body-sm font-medium">{trigger.name}</span>
                <span class="text-caption text-ink-muted">{trigger.about}</span>
              </span>
            </button>
          {/each}
          <div class="border-border-subtle rounded-panel border py-2">
            <PanelFields>
              <PanelField label="At" mono>02:00 daily</PanelField>
              <PanelField label="Timezone" mono>America/New_York</PanelField>
              <PanelField label="Next" mono>Tomorrow, 02:00</PanelField>
            </PanelFields>
            <p class="text-caption text-ink-muted mx-3 mt-1 mb-0">
              Next run comes from the scheduler, not from the browser.
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
            Do this
          </span>
          {#each ACTIONS as action (action.name)}
            {@const Icon = action.icon}
            <button
              type="button"
              onclick={() => workbench.inspect("automations.action")}
              aria-current={action.chosen ? "true" : undefined}
              class="border-border-subtle bg-surface-panel hover:border-interactive-border aria-[current]:border-active-border aria-[current]:bg-active-surface rounded-panel flex cursor-pointer items-start gap-3 border p-3 text-start"
            >
              <span class="text-ink-muted mt-0.5 shrink-0"><Icon size={16} aria-hidden="true" /></span>
              <span class="flex flex-col">
                <span class="text-body-sm font-medium">{action.name}</span>
                <span class="text-caption text-ink-muted">{action.about}</span>
              </span>
            </button>
          {/each}
          <div class="border-border-subtle rounded-panel border py-2">
            <PanelFields>
              <PanelField label="Agent">Filing Editor</PanelField>
            </PanelFields>
            <div class="mt-2">
              <PanelQuote>
                Summarise last night's outage reports by substation and flag anything
                that changes the filing position.
              </PanelQuote>
            </div>
          </div>
          <button
            type="button"
            onclick={() => workbench.inspect("automations.last-run")}
            class="border-border-subtle rounded-panel cursor-pointer border py-2 text-start"
          >
            <PanelFields>
              <PanelField label="Last fired" mono>Today, 02:00</PanelField>
              <PanelField label="Result"><PanelChip tone="danger">Couldn't start</PanelChip></PanelField>
              <PanelField label="Why" stacked>Filing Editor may not use web.search</PanelField>
              <PanelField label="Fired about" mono>184 times</PanelField>
            </PanelFields>
          </button>
        </div>
      </div>
    </ScreenSurface>
  </div>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Automations"
      about="A run is a dispatch. Success means the task was created — what it then does is the task's own story."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (editing = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New Automation
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters placeholder="Search Automations" matched={4} total={4}>
      <PanelChip tone="active">All</PanelChip>
      <PanelChip>On</PanelChip>
      <PanelChip>Off</PanelChip>
      <PanelChip tone="danger">Not working</PanelChip>
    </ScreenFilters>

    <ScreenTable columns={["On", "Name", "When", "Do this", "Last fired", "Result"]}>
      {#each RULES as rule (rule.name)}
        <ScreenRow>
          <ScreenCell>
            <PanelToggle checked={rule.on} label={`${rule.name} is ${rule.on ? "on" : "off"}`} />
          </ScreenCell>
          <ScreenCell name={rule.name} onselect={() => workbench.inspect("automations.automation")} />
          <ScreenCell num>{rule.when}</ScreenCell>
          <ScreenCell>{rule.does}</ScreenCell>
          <ScreenCell num>{rule.fired}</ScreenCell>
          <ScreenCell>
            {#if rule.result === "—"}
              <span class="text-ink-muted">—</span>
            {:else}
              <PanelChip tone={rule.tone}>{rule.result}</PanelChip>
            {/if}
          </ScreenCell>
        </ScreenRow>
      {/each}
    </ScreenTable>

    <p class="text-caption text-ink-muted m-0">
      Duplicating one leaves it off, so a copy cannot fire before you have read it.
      Last result is Started or Couldn't start — an Automation is never itself
      “running”.
    </p>
  </ScreenSurface>
{/if}
