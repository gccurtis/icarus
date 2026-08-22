<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelProgress,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { documentRecord, promptBlock } from "$mock-capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A block of the document body whose content is generated rather than typed.
   *
   * `docs/screen-panel-views/inspector/resource/prompt-block.md` is the
   * specification. On the page it reads as ordinary prose — a document is stable
   * and things do not pop out of it — so everything that distinguishes it is
   * here.
   *
   * **No stale badge and no "last generated" warning.** The block runs when the
   * document is opened, so what is on the page was generated against the project
   * as it is now. Provenance says how it was run; nothing needs to say it has
   * fallen behind.
   *
   * **Copy out is not a clipboard copy.** It takes the generated paragraph out of
   * the block and makes it ordinary text, which is why it hands the inspector to
   * the text-block lens: what you are looking at afterwards is a text block.
   */
  let {
    documentId = "r-memo",
    blockId = "b_5c2"
  }: { documentId?: string; blockId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const source = $derived(promptBlock(blockId));
  const block = $derived(source.current);

  let prompt = $state<string | undefined>(undefined);
  const shownPrompt = $derived(prompt ?? block.prompt);

  let running = $state(false);

  const run = async () => {
    running = true;
    await source.refresh();
    running = false;
  };
</script>

<Panel title="Prompt block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Prompt block" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  <PanelSection title="Prompt" flush>
    <PanelFields>
      <PanelField label="Instruction" stacked>
        <PanelEditableText
          label="Instruction"
          value={shownPrompt}
          multiline
          onchange={(next) => (prompt = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Output" flush>
    <!-- `intelligence` is the one place the generated/authored distinction is carried. -->
    <PanelQuote tone="intelligence">{block.output}</PanelQuote>

    {#if running}
      <PanelProgress label="Running the prompt" tone="intelligence" />
    {/if}

    <PanelActions>
      <PanelButton label="Run again" icon={RefreshCw} disabled={running} onclick={run} />
      <PanelButton
        label="Copy out"
        icon={Copy}
        title="Make the output ordinary text and drop the prompt"
        onclick={() =>
          view.inspect("resource.text-block-document", {
            kind: "block",
            id: block.id
          })}
      />
    </PanelActions>

    <PanelNote>
      The block runs when the document is opened, so this was generated against
      the project as it is now.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Scope" flush>
    <PanelRow
      title={block.scopeName}
      sub="What the block could look at when it ran"
      meta={`${block.scopeResolves}`}
      onselect={() => view.inspect("scope.context", { kind: "scope", id: block.scopeId })}
    />
  </PanelSection>

  <PanelSection title="Provenance" open={false} flush>
    <PanelFields>
      <PanelField label="Last run">{block.lastRun}</PanelField>
      <PanelField label="Model" mono>{block.model}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
