<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import GitCompareArrows from "@lucide/svelte/icons/git-compare-arrows";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect
  } from "$components/authored/panel";
  import { analysis, relationship, tablesIn } from "$capabilities/analysis";
  import type { JoinMode } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Two variables that need relating before a chart can be drawn, and the fix.
   *
   * `docs/screen-panel-views/inspector/analysis/relationship.md` is the
   * specification. This is what a join step becomes here: it appears only when
   * two variables are actually in play, and it is stated as a problem to solve
   * rather than as a modelling stage to get through first.
   *
   * **The key is presented as a guess, because it is one.** The match count sits
   * beside it and the alternatives keep the order the inference gave them —
   * re-ranking a list of guesses by coverage makes it look like analysis, and a
   * high count is not on its own a good key.
   *
   * **A hand-made pair shows no coverage.** Nothing has counted it, and a blank
   * where a number belongs is more honest than a number nobody computed.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const view = viewState();

  const record = $derived(analysis(analysisId).current);
  const problem = $derived(relationship(analysisId).current);
  const tables = $derived(tablesIn(view.project).current);

  /** The pairing in use plus the ones the inference offered, in the order it gave them. */
  const candidates = $derived([problem.key, ...problem.alternatives]);

  let chosenId = $state<string | undefined>(undefined);
  let keeping = $state<JoinMode | undefined>(undefined);
  let picking = $state(false);
  let leftPick = $state<string | undefined>(undefined);
  let rightPick = $state<string | undefined>(undefined);

  const chosen = $derived(
    candidates.find((one) => one.id === (chosenId ?? problem.key.id)) ?? problem.key
  );
  const mode = $derived(keeping ?? problem.mode);
  const manual = $derived(leftPick !== undefined || rightPick !== undefined);
  const left = $derived(leftPick ?? chosen.left);
  const right = $derived(rightPick ?? chosen.right);
  const others = $derived(candidates.filter((one) => one.id !== chosen.id));

  const MODES = [
    { value: "With a match", label: "With a match" },
    { value: "All on the left", label: "All on the left" },
    { value: "All on the right", label: "All on the right" },
    { value: "All of both", label: "All of both" }
  ] as const;

  /** Each side is a field of the variable that side's key already names. */
  const variableOf = (key: string) => key.split(".")[0];
  const fieldsOf = (name: string) =>
    (tables.find((table) => table.name === name)?.fields ?? []).map((field) => ({
      value: `${name}.${field.name}`,
      label: field.name
    }));

  const leftFields = $derived(fieldsOf(variableOf(problem.key.left)));
  const rightFields = $derived(fieldsOf(variableOf(problem.key.right)));

  const pair = (key: { left: string; right: string }) => `${key.left} → ${key.right}`;
  const coverage = (key: { matched: number; of: number }) =>
    `Matches ${key.matched} of ${key.of} rows`;

  /** Committing sends the reader back to the chart, which is the thing that changed. */
  const use = () => view.inspect("analysis.analysis", { kind: "analysis", id: analysisId });

  const elsewhere = () => {
    if (picking) {
      leftPick = undefined;
      rightPick = undefined;
    }
    picking = !picking;
  };
</script>

<Panel title="Two variables, no relationship">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Relationship" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Why you are seeing this">
    <PanelNote>
      <b>{problem.placed[0]}</b> and <b>{problem.placed[1]}</b> live in different variables. A chart
      needs to know which rows belong together.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Currently matching on">
    {#if picking}
      <!-- The two sides become choosable in place: the same band, answering by hand. -->
      <PanelFields>
        <PanelField label="Left" stacked>
          <PanelSelect
            label="Left field"
            value={left}
            options={leftFields}
            onchange={(next: string) => (leftPick = next)}
          />
        </PanelField>
        <PanelField label="Right" stacked>
          <PanelSelect
            label="Right field"
            value={right}
            options={rightFields}
            onchange={(next: string) => (rightPick = next)}
          />
        </PanelField>
      </PanelFields>
    {:else}
      <PanelFields>
        <PanelField label="Left" mono>{left}</PanelField>
        <PanelField label="Right" mono>{right}</PanelField>
      </PanelFields>
    {/if}

    <!--
      What happens to rows that do not match is the part that changes the answer,
      so it sits with the key rather than behind a further disclosure.
    -->
    <PanelChoice
      label="Keep rows"
      value={mode}
      options={MODES}
      onchange={(next: string) => (keeping = next as JoinMode)}
    />

    {#if manual}
      <PanelNote>Nothing has counted this pairing yet, so there is no coverage to show.</PanelNote>
    {:else}
      <PanelNote>{coverage(chosen)}. {chosen.note}</PanelNote>
    {/if}

    <PanelNote tone="gap">
      The modes are in plain words rather than inner, left, right and full. That is right for
      reading and ambiguous for anyone who knows the standard names; whether both appear is a
      review question.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Other ways they line up" count={others.length} flush>
    {#each others as candidate (candidate.id)}
      <PanelRow
        title={pair(candidate)}
        sub={candidate.note}
        meta={coverage(candidate)}
        onselect={() => {
          chosenId = candidate.id;
          leftPick = undefined;
          rightPick = undefined;
          picking = false;
        }}
      />
    {/each}
    <PanelNote tone="gap">
      These are inferred, and they are listed in the order the inference gave them rather than
      ranked. A ranked list of guesses is more dangerous than one guess, because it looks like
      analysis.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Use this"
        icon={Check}
        tone="primary"
        title="Draw the chart with {pair({ left, right })}"
        onclick={use}
      />
      <PanelButton
        label={picking ? "Use a suggested pair" : "Match on something else"}
        icon={GitCompareArrows}
        onclick={elsewhere}
      />
    </PanelActions>
  </PanelSection>
</Panel>
