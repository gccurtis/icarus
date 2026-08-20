<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Folder from "@lucide/svelte/icons/folder";
  import Layers from "@lucide/svelte/icons/layers";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Scope from "@lucide/svelte/icons/scan-search";
  import Target from "@lucide/svelte/icons/target";

  import { clientModel, type Tab } from "$model/client";
  import { PanelButton, PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenCell,
    ScreenFilters,
    ScreenHeader,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";

  /**
   * Research — anchored to the question you just asked.
   *
   * **Not a chat room.** The screen holds one turn: the prompt, its answer, and
   * what it produced. Earlier turns are History in the panel rather than a
   * scrollback you live in, which is what keeps an enquiry from becoming a
   * conversation nobody can summarise.
   *
   * **A finding is a conclusion you accept, not a passage you copied.** They are
   * proposed beside the answer with Accept, Edit and Dismiss, and one of them is
   * marked Inference rather than pretending a source says it outright.
   *
   * The Copilot is disabled on this screen: it is already a conversation with an
   * agent, and a second floating composer would be two ways to say the same
   * thing.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  let one = $state(true);

  const SOURCES = [
    {
      icon: Folder,
      title: "feeder-12-relay.pdf · p.7",
      quote: "“…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing time…”"
    },
    {
      icon: Link2,
      title: "nerc.gov/docket/2024-882",
      quote: "Reconductoring approval — no coordination study attached"
    }
  ];

  const THREADS = [
    { name: "Why did Feeder 12 fail twice?", job: "Answer one question", tone: "accent-1" as const, turns: "3", found: "1 accepted · 2 proposed", when: "just now", icon: FlaskConical },
    { name: "Undergrounding beats vegetation management", job: "Test an idea", tone: "accent-2" as const, turns: "22", found: "9 accepted", when: "2 days ago", icon: Target },
    { name: "Winter storm precedents", job: "Look around", tone: "inactive" as const, turns: "9", found: "4 accepted", when: "1 week ago", icon: Scope },
    { name: "Is Eastbrook exposed the same way?", job: "Answer one question", tone: "accent-1" as const, turns: "4", found: "none yet", when: "1 week ago", icon: FlaskConical }
  ];
</script>

{#if one}
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="border-border-subtle bg-surface-panel flex h-9 shrink-0 items-center gap-2 border-b px-3"
    >
      <span class="text-body-sm truncate font-medium">Why did Feeder 12 fail twice?</span>
      <PanelChip tone="accent-1">Question</PanelChip>
      <div class="ms-auto flex items-center gap-1">
        <PanelButton label="Grid Analyst" onclick={() => workbench.inspect("research.thread")} />
        <PanelButton label="All threads" onclick={() => (one = false)} />
      </div>
    </div>

    <ScreenSurface wide>
      <div class="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div class="flex min-w-0 flex-col gap-4">
          <!-- The prompt, with what it was allowed to look at. -->
          <div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-4">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              You asked · 10:21
            </span>
            <p class="text-body-lg leading-body-lg m-0 font-medium">
              Was the coordination study ever redone after the 2024 reconductoring?
            </p>
            <div class="flex flex-wrap gap-1">
              <PanelChip tone="accent-2">Field reports 2024–25</PanelChip>
              <PanelChip tone="interactive">Web</PanelChip>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <p class="text-body-sm leading-body m-0">
              No study dated after the 2024 reconductoring appears in either the
              filings index or the Commission's public docket. The reconductoring
              raised available fault current on the Feeder 12 / Eastbrook tie by
              roughly 18%, which is enough to invalidate the 2019 coordination
              settings — and the two 2026 failures both cleared upstream of the
              intended device.
            </p>

            <div class="flex flex-col gap-1.5">
              {#each SOURCES as source (source.title)}
                {@const SourceIcon = source.icon}
                <button
                  type="button"
                  onclick={() => workbench.inspect("research.source")}
                  class="border-border-subtle bg-surface-panel hover:border-interactive-border rounded-control flex cursor-pointer items-start gap-2 border p-2 text-start"
                >
                  <span class="text-ink-muted mt-0.5 shrink-0">
                    <SourceIcon size={14} aria-hidden="true" />
                  </span>
                  <span class="flex min-w-0 flex-col">
                    <span class="text-body-sm truncate">{source.title}</span>
                    <span class="text-caption text-ink-muted">{source.quote}</span>
                  </span>
                </button>
              {/each}
            </div>

            <!-- The trace, small and last: the claim comes before the machinery. -->
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                onclick={() => workbench.inspect("research.tool-call")}
                class="text-caption border-border-subtle text-ink-muted rounded-control inline-flex cursor-pointer items-center gap-1 border bg-transparent px-1.5 py-0.5"
              >
                <Layers size={11} aria-hidden="true" /> lattice.retrieve · 4 regions · 1.2 s
              </button>
              <button
                type="button"
                onclick={() => workbench.inspect("research.tool-call")}
                class="text-caption border-border-subtle text-ink-muted rounded-control inline-flex cursor-pointer items-center gap-1 border bg-transparent px-1.5 py-0.5"
              >
                <Scope size={11} aria-hidden="true" /> web.search · 2 results · 2.8 s
              </button>
            </div>
          </div>
        </div>

        <div class="flex min-w-0 flex-col gap-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              Findings from this answer
            </span>
            <span class="text-caption text-ink-muted">2 proposed · 1 accepted</span>
          </div>

          <div class="border-accent-2-border bg-accent-2-surface rounded-panel flex flex-col gap-2 border p-3">
            <PanelChip tone="accent-2">Proposed</PanelChip>
            <span class="text-body-sm font-medium">
              No coordination study exists after the 2024 reconductoring
            </span>
            <span class="text-caption text-ink-secondary">
              Neither the filings index nor the public docket lists one, and the
              reconductoring raised fault current by ~18%.
            </span>
            <div class="flex flex-wrap gap-1">
              <PanelChip>2 sources</PanelChip>
              <PanelChip tone="success">Supports H-3</PanelChip>
            </div>
            <div class="flex flex-wrap gap-1">
              <PanelButton
                label="Accept"
                icon={Check}
                tone="primary"
                onclick={() => workbench.inspect("research.finding")}
              />
              <PanelButton label="Edit" onclick={() => workbench.inspect("research.finding")} />
              <PanelButton label="Dismiss" tone="ghost" />
            </div>
          </div>

          <div class="border-accent-2-border bg-accent-2-surface rounded-panel flex flex-col gap-2 border p-3">
            <PanelChip tone="accent-2">Proposed</PanelChip>
            <span class="text-body-sm font-medium">
              The 2019 settings are invalid at current fault levels
            </span>
            <span class="text-caption text-ink-secondary">
              An implication, not a quotation — no source says this outright.
            </span>
            <div class="flex flex-wrap gap-1">
              <PanelChip>2 sources</PanelChip>
              <PanelChip tone="attention">Inference</PanelChip>
            </div>
            <div class="flex flex-wrap gap-1">
              <PanelButton label="Accept" icon={Check} tone="primary" />
              <PanelButton label="Edit" />
              <PanelButton label="Dismiss" tone="ghost" />
            </div>
          </div>

          <button
            type="button"
            onclick={() => workbench.inspect("research.finding-accepted")}
            class="border-success-border bg-success-surface rounded-panel flex cursor-pointer flex-col gap-2 border p-3 text-start"
          >
            <span class="flex gap-1">
              <PanelChip tone="success">Accepted</PanelChip>
              <PanelChip tone="intelligence">In the lattice</PanelChip>
            </span>
            <span class="text-body-sm font-medium">Relay pair mis-coordinated since 2024</span>
            <span class="text-caption text-ink-secondary">
              Accepted from the 10:14 answer. Retrievable everywhere in the project.
            </span>
          </button>

          <p class="text-caption text-ink-muted m-0">
            A finding is a conclusion you accept, not a passage you copied.
            Accepting it is what puts it in the lattice, which is why the model
            asks rather than writes.
          </p>
        </div>
      </div>

      <!-- The composer, framed by what the thread already is. -->
      <div class="border-border-subtle bg-surface-elevated rounded-panel shadow-panel border">
        <div class="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
          <PanelChip tone="accent-1">Question mode</PanelChip>
          <span class="text-caption text-ink-muted">anchored to Q-14</span>
          <div class="ms-auto flex gap-1">
            <PanelButton label="Context" icon={Target} />
            <PanelButton label="Web" icon={Scope} />
          </div>
        </div>
        <div class="flex items-center gap-3 p-3">
          <span class="text-body-sm text-ink-muted flex-1">Ask the next question…</span>
          <span
            class="bg-interactive-fill text-interactive-on-fill flex size-6 items-center justify-center rounded-full"
          >
            <ArrowUp size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </ScreenSurface>
  </div>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Research"
      about="Every line of enquiry in this project. Opening one brings it to the centre — there is one Research tab, not one per thread."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (one = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New thread
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters placeholder="Search threads and findings" matched={4} total={4}>
      <PanelChip tone="active">All</PanelChip>
      <PanelChip>Questions</PanelChip>
      <PanelChip>Hypotheses</PanelChip>
      <PanelChip>Open-ended</PanelChip>
    </ScreenFilters>

    <ScreenTable columns={["Thread", "Job", "Turns", "Findings", "Last asked"]}>
      {#each THREADS as thread (thread.name)}
        <ScreenRow>
          <ScreenCell name={thread.name} icon={thread.icon} onselect={() => (one = true)} />
          <ScreenCell><PanelChip tone={thread.tone}>{thread.job}</PanelChip></ScreenCell>
          <ScreenCell num>{thread.turns}</ScreenCell>
          <ScreenCell num>{thread.found}</ScreenCell>
          <ScreenCell num>{thread.when}</ScreenCell>
        </ScreenRow>
      {/each}
    </ScreenTable>

    <p class="text-caption text-ink-muted m-0">
      A thread has one job, chosen when it starts: look around, answer one
      question, or test one idea. That is what keeps an enquiry from becoming a
      chat room.
    </p>
  </ScreenSurface>
{/if}
