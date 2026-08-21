<script lang="ts">
  import HeadingIcon from "@lucide/svelte/icons/heading";
  import Pilcrow from "@lucide/svelte/icons/pilcrow";
  import Replace from "@lucide/svelte/icons/replace";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    Panel,
    PanelButton,
    PanelInput,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { findInDocument, type DocumentHit } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Search and replace inside this document.
   *
   * `docs/screen-panel-views/context/resource/find-document.md` is the
   * specification. A context view rather than a dialog, so it never covers the
   * text it is searching and never has to be dismissed to read a hit.
   *
   * **Replace is in the actions row, not under the results.** The specification
   * pins it at the foot; `Panel` has no footer and is not getting one, because a
   * control below a list of unbounded length is a control nobody finds.
   *
   * **A hit inside generated output is findable and not replaceable.** The block
   * runs on open, so a replacement there would survive until the next run and
   * then vanish. Those rows carry the intelligence tone, Replace stays disabled
   * on them, and the note at the foot says why.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  let query = $state("storm");
  let replacement = $state("");
  let hitId = $state<string>();

  /** No write door yet, so a replacement is recorded here and the row says it happened. */
  let replaced = $state<readonly string[]>([]);

  const hits = $derived(query.trim() === "" ? [] : findInDocument(documentId, query).current);
  const selected = $derived(hits.find((hit) => hit.id === hitId));

  const iconFor = (hit: DocumentHit) => {
    if (hit.source === "Prompt block output") return Sparkles;
    if (hit.source === "Table") return TableIcon;
    if (hit.source === "Heading") return HeadingIcon;
    return Pilcrow;
  };

  /**
   * Page, what the hit came out of, and the block — the block only where the
   * text is authored, because a generated hit is not addressed by the block a
   * person would edit.
   */
  const where = (hit: DocumentHit) => {
    const parts = [`p.${hit.page}`, hit.source];
    if (hit.replaceable && hit.blockId !== undefined) parts.push(`block ${hit.blockId}`);
    if (replaced.includes(hit.id)) parts.push("replaced");
    return parts.join(" · ");
  };

  const choose = (hit: DocumentHit) => {
    hitId = hit.id;
    mockWorkbench.inspect(
      hit.replaceable ? "resource.text-block-document" : "resource.prompt-block",
      { kind: "block", id: hit.blockId ?? hit.id }
    );
  };

  const blocked = $derived(
    selected === undefined
      ? "Select a hit to replace it"
      : !selected.replaceable
        ? "Generated output is overwritten on the next run"
        : replaced.includes(selected.id)
          ? "Already replaced"
          : undefined
  );

  const replaceSelected = () => {
    if (selected === undefined || blocked !== undefined) return;
    replaced = [...replaced, selected.id];
  };
</script>

<Panel title="Find">
  {#snippet actions()}
    <!-- Enter commits, and `replaceSelected` is the same guard the button is disabled by. -->
    <PanelInput
      label="Replace with"
      bind:value={replacement}
      placeholder="Replace with"
      onenter={replaceSelected}
      flush
    />
    <PanelButton
      label="Replace"
      icon={Replace}
      tone="primary"
      disabled={blocked !== undefined}
      title={blocked}
      onclick={replaceSelected}
    />
  {/snippet}

  <!--
    The field contains its hits, so what the query searches is answered by the
    markup rather than by a convention held in this file.
  -->
  <PanelSearch
    placeholder="Find in document"
    matched={hits.length}
    empty={query.trim() === "" ? "Type to search this document." : "Nothing matches."}
    bind:value={query}
    flush
  >
    <PanelSection title="Results" count={hits.length} flush>
      {#each hits as hit (hit.id)}
        <PanelRow
          title={hit.match}
          sub={where(hit)}
          icon={iconFor(hit)}
          tone={hit.replaceable ? "default" : "intelligence"}
          selected={hit.id === hitId}
          onselect={() => choose(hit)}
        >
          <span class="text-body-sm text-ink-muted truncate">
            {hit.before}<strong class="text-ink-primary font-semibold">{hit.match}</strong
            >{hit.after}
          </span>
        </PanelRow>
      {/each}
    </PanelSection>
  </PanelSearch>

  <PanelNote>
    A hit inside a prompt block's output can be read but not replaced: the block
    runs on open, and the next run writes over whatever was put there.
  </PanelNote>
</Panel>
