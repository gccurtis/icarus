<script lang="ts">
  import { PanelButton, PanelNote, PanelSection } from "$authored-components/panel";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
  import {
    linkLabel,
    normalizeLinkUrl,
    safeLinkHref
  } from "$app-views/categories/document-editor/procedures/links";
  import {
    blockOf,
    linkOps,
    linksAt,
    updateLinkOps,
    type PlacedLink
  } from "$app-views/categories/document-editor/procedures/marks";
  import { linearOf } from "$app-views/categories/document-editor/procedures/projection";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = view.active.resourceId;
  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const selection = $derived(view.selection);
  const address = $derived(selection === undefined ? undefined : addressOf(selection.id));
  const block = $derived(body === undefined || address === undefined ? undefined : blockOf(body, address.blockId));
  const at = $derived(
    block === undefined || address === undefined
      ? 0
      : linearOf(block.atoms, { atom: address.atomId, offset: address.offset })
  );
  const links = $derived(body === undefined || block === undefined ? [] : linksAt(body, block.id, at));

  let editing = $state<string | undefined>(undefined);
  let url = $state("");
  let note = $state("");
  let failed = $state<string | undefined>(undefined);

  $effect(() => {
    if (editing !== undefined && !links.some((link) => link.mark.id === editing)) {
      editing = undefined;
      failed = undefined;
    }
  });

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const startEditing = (link: PlacedLink) => {
    const held = link.mark.link;
    if (held?.kind !== "url") return;
    editing = link.mark.id;
    url = held.url;
    note = held.note ?? "";
    failed = undefined;
  };

  const save = (link: PlacedLink) => {
    const normalized = normalizeLinkUrl(url);
    if (!normalized.ok) {
      failed = normalized.reason;
      return;
    }

    const heldNote = note.trim();
    commit(updateLinkOps(link, {
      kind: "url",
      url: normalized.url,
      ...(heldNote.length === 0 ? {} : { note: heldNote })
    }));
    editing = undefined;
    failed = undefined;
  };

  const remove = (link: PlacedLink) => {
    if (body === undefined) return;
    commit(linkOps(body, [{ blockId: link.blockId, from: link.from, to: link.to }], undefined));
    editing = undefined;
    failed = undefined;
  };
</script>

<PanelSection title="Links" count={links.length} open={links.length > 0} chevron="end" flush>
  {#if links.length === 0}
    <div class="px-3 pb-1">
      <PanelNote tone="muted">No link contains the caret.</PanelNote>
    </div>
  {:else}
    <div class="flex flex-col gap-2.5 pb-1">
      <span class="text-caption text-ink-muted px-3 font-medium">Links under the caret</span>
      {#each links as link (link.mark.id)}
        <div class="flex flex-col gap-2 px-3">
          {#if editing === link.mark.id && link.mark.link?.kind === "url"}
            <Input type="url" aria-label="Edit link" bind:value={url} class="text-body-sm h-auto py-1" />
            <Textarea
              aria-label="Edit link notes"
              placeholder="Notes about this link…"
              bind:value={note}
              class="text-body-sm field-sizing-content min-h-16 resize-none"
            />
            <div class="flex flex-wrap gap-1.5">
              <PanelButton label="Save" tone="primary" onclick={() => save(link)} />
              <PanelButton label="Cancel" tone="ghost" onclick={() => (editing = undefined)} />
              <PanelButton label="Remove" tone="danger" onclick={() => remove(link)} />
            </div>
            {#if failed !== undefined}<PanelNote tone="gap">{failed}</PanelNote>{/if}
          {:else}
            <div class="flex min-w-0 items-center gap-2">
              {#if link.mark.link?.kind === "url" && safeLinkHref(link.mark.link) !== undefined}
                <a
                  href={safeLinkHref(link.mark.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-body-sm text-ink-primary min-w-0 flex-1 truncate"
                >{linkLabel(link.mark.link)}</a>
              {:else}
                <span class="text-body-sm text-ink-secondary min-w-0 flex-1 truncate">{linkLabel(link.mark.link)}</span>
              {/if}
              {#if link.mark.link?.kind === "url"}
                <PanelButton label="Edit" tone="ghost" onclick={() => startEditing(link)} />
              {/if}
            </div>
            {#if link.mark.link?.kind === "url" && link.mark.link.note}
              <p class="text-caption text-ink-muted m-0 whitespace-pre-wrap">{link.mark.link.note}</p>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</PanelSection>
