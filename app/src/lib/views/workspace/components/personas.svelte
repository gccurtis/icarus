<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { clientModel, type Tab } from "$model/client";
  import { PanelChip, PanelQuote, PanelSection } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCard,
    ScreenCards,
    ScreenCell,
    ScreenFilters,
    ScreenHeader,
    ScreenRow,
    ScreenStat,
    ScreenStats,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";

  /**
   * Personas — a profile for each agent, not a form.
   *
   * The order is the argument: who it is, then what it has *done*, then how it is
   * configured. A record is what tells you whether to trust an agent; the
   * configuration only matters once you do.
   *
   * **Behaviour and Context are opposite each other on purpose.** One is prompt
   * text sent on every call, the other is material the agent can go and look
   * things up in. Putting them side by side makes the distinction spatial as well
   * as stated.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  let profile = $state(true);

  const PERSONAS = [
    {
      initials: "GA",
      name: "Grid Analyst",
      about: "Reads field data and relay logs; refuses to speculate past the record.",
      work: "41 tasks · 2 running"
    },
    {
      initials: "FE",
      name: "Filing Editor",
      about: "Turns findings into filing prose in the Commission's register.",
      work: "18 tasks"
    },
    {
      initials: "SK",
      name: "Skeptic",
      about: "Argues the other side of every hypothesis before it is accepted.",
      work: "6 tasks"
    }
  ];

  const BEHAVIOUR = [
    ["Focus", "Concentrate on outage causation from field evidence: relay logs, event sequences, weather records."],
    ["Background", "Northwind operates 41 substations across three counties. The 2024 reconductoring raised…"],
    ["Approach", "Establish the event sequence before proposing a mechanism. Name the document and page…"],
    ["Output", "Lead with the mechanism in one sentence, then the evidence. Cite every claim…"],
    ["Verification", "Before finishing, confirm every cited page number resolves and no claim rests on…"]
  ];

  const WORK = [
    { task: "Summarise overnight outage reports", by: "Nightly filing digest", when: "02:00", result: "Running · 3 of 5", tone: "active" as const },
    { task: "Rebuild substation crosswalk", by: "Ana Reyes", when: "Yesterday", result: "Failed · tool not permitted", tone: "danger" as const },
    { task: "Extract 2024 storm precedents", by: "Ana Reyes", when: "2 hours ago", result: "14 findings accepted", tone: "success" as const },
    { task: "Relay coordination history", by: "Ana Reyes", when: "2 hours ago", result: "Conversation · 14 turns", tone: "neutral" as const }
  ];
</script>

{#if profile}
  <div class="flex h-full min-h-0 flex-col">
    <ScreenBar title="Grid Analyst" onback={() => (profile = false)}>
      {#snippet actions()}
        <PanelChip tone="success">Saved · revision 14</PanelChip>
      {/snippet}
    </ScreenBar>

    <ScreenSurface>
      <div class="flex items-start gap-4">
        <button
          type="button"
          onclick={() => workbench.inspect("personas.persona")}
          class="border-intelligence-border bg-intelligence-surface text-intelligence-text flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full border text-base font-semibold"
        >
          GA
        </button>
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-h3 leading-h3 m-0 font-semibold tracking-tight">Grid Analyst</h1>
          <p class="text-body-sm text-ink-muted m-0">
            Reads field data and relay logs; refuses to speculate past the record.
          </p>
          <div class="mt-1 flex flex-wrap gap-1">
            <PanelChip tone="accent-2">This project</PanelChip>
            <PanelChip tone="inactive">analyst-default</PanelChip>
            <PanelChip>4 tools</PanelChip>
          </div>
        </div>
      </div>

      <!-- `failed` is never omitted: a record that only counts successes is not one. -->
      <ScreenStats>
        <ScreenStat value="41" label="tasks run" />
        <ScreenStat value="2" label="running now" />
        <ScreenStat value="1" label="failed" tone="danger" />
        <ScreenStat value="128" label="findings accepted" />
      </ScreenStats>

      <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div class="flex flex-col gap-2">
          <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
            How it behaves
          </span>
          <div class="border-border-subtle rounded-panel border py-1">
            {#each BEHAVIOUR as [name, text], index (name)}
              <PanelSection title={name} open={index === 0}>
                <PanelQuote>{text}</PanelQuote>
              </PanelSection>
            {/each}
          </div>
          <p class="text-caption text-ink-muted m-0">
            All of it is prompt text and costs context on every call. What it can
            look things up in is separate, and beside it.
          </p>
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              What it can look up
            </span>
            <div class="border-border-subtle rounded-panel flex flex-col border p-3">
              <span class="text-body-sm">Field reports 2024–25</span>
              <span class="text-caption text-ink-muted">
                96 resources · not pasted into the prompt
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              What it may do
            </span>
            <div class="border-border-subtle rounded-panel flex flex-wrap gap-1 border p-3">
              <PanelChip tone="success">lattice.retrieve</PanelChip>
              <PanelChip tone="success">resource.read</PanelChip>
              <PanelChip tone="success">finding.create</PanelChip>
              <PanelChip tone="danger">resource.write</PanelChip>
              <PanelChip tone="danger">web.search</PanelChip>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
          Everything it has done
        </span>
        <ScreenTable columns={["Task", "Started by", "When", "Result"]}>
          {#each WORK as item (item.task)}
            <ScreenRow>
              <ScreenCell name={item.task} onselect={() => workbench.inspect("personas.task")} />
              <ScreenCell>
                <button
                  type="button"
                  onclick={() => workbench.inspect("actor.person")}
                  class="text-interactive-text text-body-sm cursor-pointer border-none bg-transparent p-0 hover:underline"
                >
                  {item.by}
                </button>
              </ScreenCell>
              <ScreenCell num>{item.when}</ScreenCell>
              <ScreenCell><PanelChip tone={item.tone}>{item.result}</PanelChip></ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>
      </div>
    </ScreenSurface>
  </div>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Personas"
      about="Reusable agent behaviour. Provider credentials and deployment setup stay outside project data."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (profile = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New Persona
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters placeholder="Search Personas" matched={3} total={3}>
      <PanelChip tone="active">All</PanelChip>
      <PanelChip>This project</PanelChip>
      <PanelChip>Everywhere</PanelChip>
    </ScreenFilters>

    <ScreenCards min="15rem">
      {#each PERSONAS as persona (persona.name)}
        <ScreenCard
          title={persona.name}
          sub={persona.about}
          onselect={() => workbench.inspect("personas.persona")}
        >
          <PanelChip tone="inactive">{persona.work}</PanelChip>
        </ScreenCard>
      {/each}
    </ScreenCards>
  </ScreenSurface>
{/if}
