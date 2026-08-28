<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelPair,
    PanelPairs,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { template, useTemplateDraft, type InstantiationAsk } from "$capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * What using a template will make, and what has to be supplied first.
   *
   * `docs/screen-panel-views/inspector/library/use-template.md` is the
   * specification. **Using a template hands back an independent copy**: the
   * result records where it came from and nothing else, and editing the template
   * afterwards never reaches back into it.
   *
   * The asks are pairs rather than fields because a key and the value standing
   * against it is exactly what a pair is, and because only a text variable has an
   * editor — an image or a table variable has nowhere to put a value yet, so its
   * pair is read-only and says so. Create is disabled for the reason the door
   * gives, which is the one fact this whole form has to admit.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const view = viewState();

  const draft = $derived(useTemplateDraft(templateId).current);
  const tpl = $derived(template(templateId).current);

  /** Undefined until touched, so an untouched name still reads from the door. */
  let called = $state<string>();

  /** What has been typed in, by key. Empty until something is supplied. */
  let supplied = $state<Record<string, string>>({});

  /** "Not set" is a state, not a value, so it is never put in the field. */
  const valueOf = (ask: InstantiationAsk) =>
    supplied[ask.key] ?? (ask.state === "Not set" ? "" : ask.state);

  const set = (key: string, next: string) => (supplied = { ...supplied, [key]: next });

  const unsupplied = $derived(
    draft.asks.filter((ask: InstantiationAsk) => valueOf(ask) === "").length
  );
</script>

<Panel title="Use template">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Templates" }, { label: tpl.name, key: "library.template" }, { label: "Use" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Makes" flush>
    <PanelFields>
      <PanelField label="A">{draft.makes}</PanelField>
      <PanelField label="Called" stacked>
        <PanelEditableText
          label="Called"
          value={called ?? draft.called}
          onchange={(next: string) => (called = next)}
        />
      </PanelField>
      <PanelField label="In">{draft.into}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection
    title="Asks you for"
    count={unsupplied === 0 ? draft.asks.length : `${draft.asks.length - unsupplied} of ${draft.asks.length}`}
    flush
  >
    <PanelPairs
      columns={["Variable", "Value"]}
      count={draft.asks.length}
      empty="It asks for nothing."
    >
      {#each draft.asks as ask (ask.key)}
        <!--
          No `onrename` and no `onremove`: the set of variables belongs to the
          template, and this form answers them rather than changes them.
        -->
        <PanelPair
          name={ask.key}
          value={valueOf(ask)}
          mono={false}
          placeholder={ask.type === "Text" ? "Not set" : `Not set — ${ask.type}`}
          onchange={ask.type === "Text" ? (next: string) => set(ask.key, next) : undefined}
        />
      {/each}
    </PanelPairs>

    <PanelNote tone="gap">
      A table variable needs a picker over project variables, an upload, or both.
      Nothing describes that yet, so anything but text is read-only here.
    </PanelNote>
  </PanelSection>

  <!-- Not questions, so they are not in the form. Shut, because there is nothing to do. -->
  <PanelSection title="Generated on open" count={draft.generated.length} open={false} flush>
    {#each draft.generated as ask (ask.key)}
      <PanelRow title={ask.key}>
        {#snippet children()}
          <span class="text-body-sm text-ink-primary truncate font-mono">{ask.key}</span>
          <span class="text-caption text-ink-muted truncate">Becomes a prompt block</span>
        {/snippet}
      </PanelRow>
    {/each}
    {#if draft.generated.length === 0}
      <PanelNote>Nothing is generated on open.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Create" flush>
    <PanelActions>
      <PanelButton
        label="Create"
        icon={Plus}
        tone="primary"
        disabled={!draft.canCreate}
        title={draft.blockedBecause}
      />
    </PanelActions>
    <PanelNote tone="gap">{draft.blockedBecause}</PanelNote>
    <PanelNote>
      The result records where it came from and nothing else. Later edits to the
      template never reach into it.
    </PanelNote>
  </PanelSection>
</Panel>
