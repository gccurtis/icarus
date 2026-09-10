<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import MetricStrip from "$development-views/derived-output-rebase/components/metric-strip.svelte";
  import ReferenceSection from "$development-views/derived-output-rebase/components/reference-section.svelte";
  import ReferenceShell from "$development-views/derived-output-rebase/components/reference-shell.svelte";
  import {
    ARCHITECTURE_FILES,
    CURRENT_SCHEMA_CUTS,
    OPERATION_OWNERS,
    QUEUE_RULES,
    TRANSACTION_ENTRIES
  } from "$development-views/derived-output-rebase/procedures/architecture";
  import {
    DURABILITY_DIAGRAM,
    FLIGHT_DIAGRAM
  } from "$development-views/derived-output-rebase/procedures/diagrams";
  import { pageOf } from "$development-views/derived-output-rebase/procedures/navigation";

  let { project }: { project: string } = $props();
  const page = pageOf("architecture");

  const metrics = [
    { value: "5", label: "atomic authoring entries", tone: "pass" as const },
    { value: "2", label: "durable semantic lanes", tone: "pass" as const },
    { value: "5m", label: "claim lease", tone: "attention" as const },
    { value: "3", label: "maximum attempts", tone: "attention" as const },
    { value: "0", label: "ambient flight registries", tone: "pass" as const }
  ];
</script>

<ReferenceShell {page} {project}>
  <MetricStrip items={metrics} />

  <ReferenceSection
    id="commit-line"
    eyebrow="Atomic authoring boundary"
    title="The fact and the intention are one commit"
    lede="A save never publishes embeddings inside its transaction. It does guarantee that any durable authored revision has a durable semantic job beside it, so a restart can finish the work without guessing what changed."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={DURABILITY_DIAGRAM}
        label="Atomic authored state leading to a leased semantic worker"
        caption="Solid arrows are durable state transitions. The provider failure path returns through an expired lease and bounded retry; it never rolls back authored content."
        minHeight="28rem"
      />
    </div>
    <div class="reb-transaction-grid">
      {#each TRANSACTION_ENTRIES as item, index (item.entry)}
        <article>
          <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.entry}</h3></header>
          <dl>
            <div><dt>authored rows</dt><dd>{item.authored}</dd></div>
            <div><dt>same commit</dt><dd>{item.semantic}</dd></div>
            <div><dt>executable proof</dt><dd>{item.proof}</dd></div>
          </dl>
        </article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="queue"
    eyebrow="Durable queue protocol"
    title="A lease is authority, not decoration"
    lede="The queue row answers who may work, until when, how often and for which revision. Process-local coordination can improve latency, but it cannot override the durable claim."
  >
    <ol class="reb-queue-rules">
      {#each QUEUE_RULES as rule, index (rule[0])}
        <li><span>{String(index + 1).padStart(2, "0")}</span><h3>{rule[0]}</h3><p>{rule[1]}</p></li>
      {/each}
    </ol>
    <div class="reb-callout attention">
      <span>Freshness gate</span>
      <p>A source is usable only when the indexed exact and material revisions satisfy the requested authored revision and no unresolved newer job exists. A terminal failure is visible evidence that freshness cannot be proven—not permission to answer from the old index.</p>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="ownership"
    eyebrow="Server-owned operation state"
    title="Durability lives in rows; coordination lives on ServerModel"
    lede="Derived Output and Research Chat share one cohesive process owner. Capabilities receive that owner through ServerModel, and shutdown aborts its active work before the rest of the server graph closes."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={FLIGHT_DIAGRAM}
        label="ServerModel-owned derived-output and research operation flights"
        caption="There is no globalThis map, lazy module singleton or capability-owned controller registry. The strengthened checker has mutation tests for each disguise."
        minHeight="25rem"
      />
    </div>
    <div class="reb-owner-grid">
      {#each OPERATION_OWNERS as item (item.owner)}
        <article>
          <code>{item.owner}</code>
          <dl>
            <div><dt>holds</dt><dd>{item.holds}</dd></div>
            <div><dt>lifetime</dt><dd>{item.lifetime}</dd></div>
            <div><dt>shutdown</dt><dd>{item.shutdown}</dd></div>
          </dl>
        </article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="schema"
    eyebrow="Current-schema cut"
    title="There is one readable shape"
    lede="Integration deletes ambiguity instead of teaching new code to understand old rows. These are absence contracts, protected by source search, unit fixtures and architecture checks."
  >
    <div class="reb-schema-cut">
      {#each CURRENT_SCHEMA_CUTS as cut, index (cut)}
        <div><span>{String(index + 1).padStart(2, "0")}</span><p>{cut}</p><b>absent</b></div>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="where"
    eyebrow="Review map"
    title="Seven places explain the runtime"
    lede="The facades stay small; each named location owns one decision. Resource reading, synthesis, refresh and material projection are decomposed behind their existing public entry points."
  >
    <div class="reb-command-list">
      {#each ARCHITECTURE_FILES as item, index (item[0])}
        <div><span>{String(index + 1).padStart(2, "0")}</span><b>{item[0]}</b><code>src/lib/{item[1]}</code></div>
      {/each}
    </div>
  </ReferenceSection>
</ReferenceShell>
