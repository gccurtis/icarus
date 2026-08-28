<script lang="ts">
  import FunctionSquare from "@lucide/svelte/icons/function-square";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelChoice,
    PanelField,
    PanelFields,
    PanelSearch
  } from "$components/authored/panel";
  import { HoverCard, HoverCardContent, HoverCardTrigger } from "$lib/components/vendor/hover-card";
  import { Separator } from "$lib/components/vendor/separator";
  import { variableFamily, variables } from "$capabilities/project";
  import VariablesCreate from "$panels/context/project/variables-create.svelte";
  import FunctionBuilder from "$modals/function-builder.svelte";

  /**
   * The project's Name Manager — every named table, value and function, and the
   * only place they are created.
   *
   * `docs/screen-panel-views/context/project/variables.md` is the specification.
   * A variable is stored as a *value*, not as an expression, so what this shows is
   * exactly what a formula will get when it runs. Nothing here is ever stale and
   * no section carries a refresh.
   */
  const all = $derived(variables().current);

  /** Create switches this panel in place rather than opening a modal. */
  let creating = $state(false);
  let building = $state(false);

  let filter = $state<"all" | "tables" | "values" | "functions">("all");
  let search = $state("");

  /**
   * Four chips, not nine types. Nine is a storage taxonomy; the question a person
   * asks is whether a thing has rows, holds a value, or gets called.
   */
  const FILTERS = [
    { value: "all", label: "All" },
    { value: "tables", label: "Tables" },
    { value: "values", label: "Values" },
    { value: "functions", label: "Functions" }
  ] as const;

  const shown = $derived(
    all
      .filter((variable) => filter === "all" || variableFamily(variable.type) === filter)
      .filter((variable) => variable.name.toLowerCase().includes(search.trim().toLowerCase()))
  );
</script>

{#if creating}
  <VariablesCreate onback={() => (creating = false)} />
{:else}
  <Panel title="Variables">
    <!--
      `Panel` has no footer, so what a panel offers is visible before what it
      lists. Create is primary: defining a variable is why a person opens this,
      and the builder is the specialist path.
    -->
    {#snippet actions()}
      <PanelButton
        label="Create variable"
        icon={Plus}
        tone="primary"
        onclick={() => (creating = true)}
      />
      <PanelButton
        label="Function Builder"
        icon={FunctionSquare}
        onclick={() => (building = true)}
      />
    {/snippet}

    <Separator />

    <!--
      The field contains what it filters, so the scope of the search is answered
      by the markup rather than by a convention held in this file.
    -->
    <PanelSearch
      placeholder="Search variables"
      matched={shown.length}
      total={all.length}
      bind:value={search}
      flush
    >
      <PanelChoice
        label="Show"
        value={filter}
        options={FILTERS}
        onchange={(next) => (filter = next as typeof filter)}
      />

      <PanelFields>
        {#each shown as variable (variable.id)}
          <PanelField label={variable.name} mono>
            {#if variable.preview === undefined}
              {variable.value}
            {:else}
              <!--
                A scalar is short enough to show, so it is shown. Anything else
                names its type and gives the value to a hover, which reads a
                bounded prefix rather than the whole thing.
              -->
              <HoverCard openDelay={150}>
                <HoverCardTrigger class="cursor-help underline decoration-dotted">
                  {variable.value}
                </HoverCardTrigger>
                <HoverCardContent class="text-caption">{variable.preview}</HoverCardContent>
              </HoverCard>
            {/if}
          </PanelField>
        {/each}
      </PanelFields>
    </PanelSearch>
  </Panel>
{/if}

<FunctionBuilder bind:open={building} />
