<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelQuote
  } from "$authored-components/panel";

  let { stress = false }: { stress?: boolean } = $props();

  const noop = () => undefined;
  const question = $derived(
    stress
      ? "How should the resilience team reconcile customer-minutes lost across the northern transmission corridor when the source assumptions, operating windows, restoration scenarios, and field dispatch records all disagree about the moment service was actually restored?"
      : "What drives customer-minutes lost?"
  );
</script>

<Panel title="Activity">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Project history", key: "project-overview.history" },
        { label: "Started a research question" }
      ]}
      onnavigate={noop}
    />
  {/snippet}

  <div class="flex flex-col gap-3 pt-1.5">
    <section aria-labelledby="mock-activity-what" class="flex min-w-0 flex-col gap-1.5">
      <div class="flex min-w-0 flex-col gap-0.5 px-3">
        <h3 id="mock-activity-what" class="text-caption text-ink-muted m-0 font-semibold tracking-wide uppercase">
          What
        </h3>
        <p class="text-body text-ink-primary m-0 font-semibold">Started a research question</p>
      </div>
      <PanelQuote collapsible={stress}>
        <span class="text-body text-ink-primary font-medium">{question}</span>
      </PanelQuote>
    </section>

    <PanelFields proportional>
      <PanelField label="Where" stacked hierarchy>
        <PanelLink
          label="Research chat"
          title={question}
          lines={2}
          onselect={noop}
        />
      </PanelField>
      <PanelField label="Who" stacked hierarchy>
        <PanelLink
          label={stress ? "Alexandria-Cassandra Montgomery" : "Mira Okonkwo"}
          title="Open collaborator"
          lines={2}
          onselect={noop}
        />
      </PanelField>
      <PanelField label="When" stacked hierarchy>
        <span class="inline-flex flex-wrap items-baseline gap-1">
          <span>Sep 1, 2026</span><span aria-hidden="true">·</span><span>8d ago</span>
        </span>
      </PanelField>
    </PanelFields>
  </div>
</Panel>
