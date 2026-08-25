<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { Separator } from "$lib/simple-components/separator";
  import { context } from "$mock-capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * A Context: the scope itself, its rule in plain words, and what it resolves
   * to right now.
   *
   * `docs/screen-panel-views/inspector/scope/context.md` is the specification.
   *
   * **A Context is a rule, not a list.** Nothing here is a stored membership. The
   * counts are a resolve as of this second, which is why *Right now* is its own
   * band and why a document created tomorrow is inside without anyone editing
   * anything.
   *
   * **Delete is drawn and disabled.** It stays gated until one query can find
   * every Context, Persona and prompt block depending on this one — deleting
   * blind creates scopes that fail at retrieval time rather than at delete time.
   */
  let { contextId }: { contextId?: string } = $props();

  const view = viewState();

  const id = $derived(contextId ?? view.selection?.id ?? "cx-drafts");

  const record = $derived(context(id).current);

  /**
   * Both editable values are held here rather than written back: the door is a
   * read, and an edit that vanished on the next read would be worse than one
   * that is plainly local.
   */
  let renamed = $state<string | undefined>(undefined);
  let redescribed = $state<string | undefined>(undefined);

  const name = $derived(renamed ?? record.name);
  const description = $derived(redescribed ?? record.description);
</script>

<Panel title={name}>
  <!-- The first band carries no heading: the panel's title already names it. -->
  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText
        value={name}
        label="Name"
        onchange={(next: string) => (renamed = next)}
      />
    </PanelField>
    <PanelField label="Describes" stacked>
      <PanelEditableText
        value={description}
        label="Describes"
        multiline
        onchange={(next: string) => (redescribed = next)}
      />
    </PanelField>
  </PanelFields>

  <!--
    The section that makes a Context reviewable by someone who did not build it.
    The two halves in the centre show the same thing spatially; this says it in
    words, generated from the definition rather than typed.
  -->
  <PanelSection title="In plain words">
    <PanelFields>
      <PanelField label="Rule" stacked>{record.inPlainWords}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      One level deep. A union nested inside a union cannot be said as one flat
      sentence any more than it can be drawn as two flat halves.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Right now">
    <PanelFields>
      <PanelField label="Contains">{record.contains} resources</PanelField>
      <PanelField label="Retrievable">{record.retrievable} of them</PanelField>
    </PanelFields>
    <PanelNote>
      Live. A document created tomorrow that fits the rule is included without
      editing anything.
    </PanelNote>
  </PanelSection>

  <!-- Provenance rather than the reason the panel was opened, so it arrives shut. -->
  <PanelSection title="Saved" open={false}>
    <PanelFields>
      <PanelField label="Revision" mono>{record.revision}</PanelField>
      <PanelField label="State">
        {#if record.state === "edited"}
          <PanelChip tone="attention">Edited</PanelChip>
        {:else}
          <PanelChip>Saved</PanelChip>
        {/if}
      </PanelField>
      {#if record.unsaved > 0}
        <PanelField label="Unsaved">{record.unsaved} terms, in the editor only</PanelField>
      {/if}
    </PanelFields>
  </PanelSection>

  <!-- Last and separated: the one action here destroys the scope. -->
  <Separator />

  <PanelActions>
    <PanelButton
      label="Delete Context"
      icon={Trash2}
      tone="danger"
      disabled
      title={record.deleteBlocked}
    />
  </PanelActions>

  <PanelNote tone="gap">
    Gated until one query can find every Context, Persona, prompt block and
    generated output depending on this one. Deleting blind makes broken scopes
    that fail at retrieval time rather than at delete time.
  </PanelNote>
</Panel>
