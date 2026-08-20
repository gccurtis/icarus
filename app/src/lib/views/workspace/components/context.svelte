<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Folder from "@lucide/svelte/icons/folder";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Minus from "@lucide/svelte/icons/minus";
  import Pin from "@lucide/svelte/icons/pin";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Quote from "@lucide/svelte/icons/quote";
  import Scope from "@lucide/svelte/icons/scan-search";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Target from "@lucide/svelte/icons/target";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { clientModel, type Tab } from "$model/client";
  import { PanelChip, PanelRow } from "$lib/unique-components/panel";
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
   * Context — a saved scope, said as arithmetic.
   *
   * **Two halves with a minus between them, and the minus is a region.** Without
   * the sign the screen reads as two lists of things that are in, rather than as
   * a subtraction. That single glyph is the whole model.
   *
   * **Every row of the result says why it is there.** The In because column is
   * what makes a Context debuggable — and it is also the thing most obviously
   * blocked, because it needs per-result expression proofs the resolver does not
   * produce.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  let one = $state(true);

  const SETS = [
    { name: "Everything but drafts", rule: "Everything in the project, minus templates", has: "211", get: "88", by: "2 agents", icon: Pin, warn: false },
    { name: "Regulatory corpus", rule: "Documents, and the Filings set", has: "34", get: "34", by: "1 agent · 1 automation", icon: Target, warn: false },
    { name: "Field reports 2024–25", rule: "12 chosen resources, and everything SharePoint syncs", has: "96", get: "88", by: "1 agent · 3 prompts", icon: Target, warn: false },
    { name: "Storm precedents", rule: "Nothing matches it right now", has: "0", get: "0", by: "—", icon: TriangleAlert, warn: true }
  ];

  const CONTENTS = [
    { name: "Q3 Resilience Memo", icon: FileText, kind: "Document", because: "Everything in this project", when: "4m" },
    { name: "Board Update — October", icon: Presentation, kind: "Slide deck", because: "Everything in this project", when: "2h" },
    { name: "Outage Cost Model", icon: Sheet, kind: "Spreadsheet", because: "Everything in this project", when: "1d" },
    { name: "NERC-2025-winter-review.pdf", icon: Folder, kind: "External file", because: "Regulatory corpus", when: "4d" },
    { name: "feeder-12-relay.pdf", icon: Folder, kind: "External file", because: "Regulatory corpus · via SharePoint", when: "6d" },
    { name: "Undergrounding cut SAIDI 38%", icon: Quote, kind: "Finding", because: "Everything in this project", when: "5d" }
  ];
</script>

{#if one}
  <div class="flex h-full min-h-0 flex-col">
    <ScreenBar title="Everything but drafts" onback={() => (one = false)} backLabel="All Contexts">
      {#snippet actions()}
        <PanelChip tone="success">Saved</PanelChip>
        <span class="text-caption text-ink-muted">211 resources</span>
      {/snippet}
    </ScreenBar>

    <ScreenSurface wide>
      <div class="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <section class="flex min-w-0 flex-col gap-2" aria-label="Include">
          <div class="flex items-center gap-2">
            <span class="text-caption text-success-text font-semibold tracking-wide uppercase">
              Include
            </span>
            <span class="text-caption text-ink-muted">248 resources</span>
          </div>
          <div class="border-border-subtle rounded-panel flex-1 overflow-hidden border py-1">
            <PanelRow
              title="Everything in this project"
              sub="Including anything created later"
              meta="248"
              icon={Scope}
              selected
              onselect={() => workbench.inspect("context.include-everything")}
            />
            <PanelRow
              title="Regulatory corpus"
              sub="Another saved Context, at its current contents"
              meta="34"
              icon={Target}
              onselect={() => workbench.inspect("context.include-context")}
            />
          </div>
        </section>

        <!-- The operator. A region, not a control: it is what makes the two
             halves a subtraction rather than two lists. -->
        <div class="text-ink-muted flex items-center justify-center" aria-hidden="true">
          <Minus size={18} />
        </div>

        <section class="flex min-w-0 flex-col gap-2" aria-label="Take out">
          <div class="flex items-center gap-2">
            <span class="text-caption text-danger-text font-semibold tracking-wide uppercase">
              Take out
            </span>
            <span class="text-caption text-ink-muted">37 resources</span>
          </div>
          <div class="border-border-subtle rounded-panel flex-1 overflow-hidden border py-1">
            <PanelRow
              title="Every template"
              sub="By kind"
              meta="37"
              icon={LayoutTemplate}
              onselect={() => workbench.inspect("context.take-out-kind")}
            />
          </div>
        </section>
      </div>

      <div class="flex flex-col gap-2">
        <ScreenFilters placeholder="Filter" matched={6} total={211}>
          <PanelChip tone="active">All kinds</PanelChip>
          <PanelChip>Problems only</PanelChip>
        </ScreenFilters>
        <ScreenTable columns={["Name", "Kind", "In because", "Updated"]}>
          {#each CONTENTS as item (item.name)}
            <ScreenRow>
              <ScreenCell
                name={item.name}
                icon={item.icon}
                onselect={() => workbench.inspect("context.resolved")}
              />
              <ScreenCell>{item.kind}</ScreenCell>
              <ScreenCell>{item.because}</ScreenCell>
              <ScreenCell num>{item.when}</ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>
        <p class="text-caption text-ink-muted m-0">
          6 of 211 shown · a Context is live, so this list changes as the project
          does.
        </p>
      </div>
    </ScreenSurface>
  </div>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Context"
      about="Saved scopes. Each is a live rule — what matches it today is what an agent can look at today."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (one = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New Context
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters placeholder="Search Contexts" matched={4} total={4} />

    <ScreenTable columns={["Name", "The rule, in words", "Contains", "Retrievable", "Used by"]}>
      {#each SETS as set (set.name)}
        <ScreenRow>
          <ScreenCell name={set.name} icon={set.icon} onselect={() => (one = true)} />
          <ScreenCell>{set.rule}</ScreenCell>
          <ScreenCell num>{set.has}</ScreenCell>
          <ScreenCell num>{set.get}</ScreenCell>
          <ScreenCell>{set.by}</ScreenCell>
        </ScreenRow>
      {/each}
    </ScreenTable>

    <p
      class="text-caption border-attention-border bg-attention-surface text-attention-text rounded-control m-0 border border-dashed p-2"
    >
      A Context matching nothing cannot be used to narrow a search — an empty scope
      currently means the whole project, so it would widen rather than narrow.
    </p>
  </ScreenSurface>
{/if}
