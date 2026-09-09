<script lang="ts">
  import {
    Panel,
    PanelAlignment,
    PanelButton,
    PanelCrumbs,
    PanelNote,
    PanelQuote,
    PanelInlineStyle,
    PanelSection,
    PanelSpacing,
    PanelSelect
  } from "$authored-components/panel";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import { create } from "$capabilities/store/index.remote";
  import {
    agree,
    formatOps,
    resolvedOf,
    type HorizontalAlignment
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { FILLS, INKS, orClear, orNone } from "$app-views/categories/document-editor/procedures/colours";
  import {
    nextHoleName,
    selectedWords,
    selectionHoleOps
  } from "$app-views/categories/document-editor/procedures/templating";
  import {
    ago,
    anchorOf,
    isCommentableSelection,
    nameOf,
    quoteOf,
    remarkFields,
    remarksOf,
    textOf,
    threadFields,
    threadsOf,
    threadsOn
  } from "$app-views/categories/document-editor/procedures/comments";
  import {
    selectedText,
    selectedTexts
  } from "$app-views/categories/document-editor/procedures/inspecting";
  import {
    STYLES,
    blocksIn,
    colourOn,
    colourOps,
    linkOps,
    linksOn,
    rangesOf,
    styleOps,
    stylesOn,
    updateLinkOps,
    type MarkStyle,
    type PlacedLink
  } from "$app-views/categories/document-editor/procedures/marks";
  import { normalizeLinkUrl, safeLinkHref } from "$app-views/categories/document-editor/procedures/links";
  import {
    projectIdOf,
    refreshAll,
    rowsIn,
    rowsOf,
    tableQuery,
    viewerId
  } from "$app-views/categories/document-editor/procedures/store";
  import {
    applyStyleOps,
    ensureStylesOps,
    styleOptions,
    styleSetOf
  } from "$app-views/categories/document-editor/procedures/styles";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const selection = $derived(view.selection);
  const text = $derived(selectedText(body, selection));
  const texts = $derived(selectedTexts(body, selection));
  const ranges = $derived(rangesOf(body, selection));
  const selectionCount = $derived(selection === undefined ? 0 : 1 + (selection.ranges?.length ?? 0));
  const commentable = $derived(isCommentableSelection(selection));
  const characterCount = $derived(ranges.reduce((total, range) => total + range.to - range.from, 0));
  const selectionExcerpt = $derived(
    texts
      .map((held) => held.length > 180 ? `${held.slice(0, 179).trimEnd()}…` : held)
      .join("\n\n")
  );
  const blocks = $derived(blocksIn(body, selection));
  const spans = $derived(blocks.length > 1);

  const set = $derived(styleSetOf(body));
  const styleKey = $derived(agree(blocks.map((block) => block.style ?? set.defaultKey)));
  const resolved = $derived(body === undefined ? [] : blocks.map((block) => resolvedOf(body, block)));
  const family = $derived(agree(resolved.map((style) => style.fontFamily ?? "IBM Plex Sans")));
  const size = $derived(agree(resolved.map((style) => style.fontSize ?? 16)));
  const align = $derived(agree(resolved.map((style) => style.horizontalAlignment ?? "start")));
  const before = $derived(agree(resolved.map((style) => style.spaceBefore ?? 0)));
  const after = $derived(agree(resolved.map((style) => style.spaceAfter ?? 0)));
  const leading = $derived(agree(resolved.map((style) => style.lineHeight ?? 26)));
  const indent = $derived(agree(resolved.map((style) => style.indent ?? 0)));

  const marks = $derived(body === undefined ? { on: [], mixed: [] } : stylesOn(body, ranges));
  const colour = $derived(body === undefined ? { mixed: false } : colourOn(body, ranges));
  const links = $derived(body === undefined ? [] : linksOn(body, ranges));

  const project = $derived(projectIdOf(documentId));
  const viewer = $derived(viewerId());
  const threadsQuery = tableQuery("commentThreads");
  const remarksQuery = tableQuery("comments");
  const users = $derived(rowsIn("users"));
  const remarks = $derived(rowsOf(remarksQuery, "comments"));
  const threads = $derived(threadsOf(rowsOf(threadsQuery, "commentThreads"), documentId ?? ""));
  const here = $derived(body === undefined ? [] : threadsOn(threads, body, selection));
  const now = Date.now();

  let composing = $state("");
  let linkUrl = $state("");
  let linkNote = $state("");
  let linkFailed = $state<string | undefined>(undefined);
  let editingLink = $state<string | undefined>(undefined);
  let editLinkUrl = $state("");
  let editLinkNote = $state("");
  let failed = $state<string | undefined>(undefined);
  let sending = $state(false);

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const setStyle = (key: string) => {
    if (body === undefined) return;
    commit([...ensureStylesOps(body), ...blocks.flatMap((block) => applyStyleOps(block, key))]);
  };

  const setAlign = (next: HorizontalAlignment) =>
    commit(blocks.flatMap((block) => formatOps(block, { horizontalAlignment: next })));

  const setMarks = (next: string[]) => {
    if (body === undefined) return;
    const held = body;
    const ops = STYLES.flatMap(({ value }) => {
      const wanted = next.includes(value);
      const had = marks.on.includes(value as MarkStyle);
      return wanted === had ? [] : styleOps(held, ranges, value, wanted);
    });
    commit(ops);
  };

  const setInk = (next: string) => {
    if (body === undefined) return;
    commit(colourOps(body, ranges, { color: orClear(next), background: colour.background }));
  };

  const setFill = (next: string) => {
    if (body === undefined) return;
    commit(colourOps(body, ranges, { color: colour.color, background: orClear(next) }));
  };

  const setSpacing = (field: "spaceBefore" | "spaceAfter" | "lineHeight" | "indent", next: number) =>
    commit(blocks.flatMap((block) => formatOps(block, { [field]: next })));

  const addLink = () => {
    if (body === undefined) return;
    const normalized = normalizeLinkUrl(linkUrl);
    if (!normalized.ok) {
      linkFailed = normalized.reason;
      return;
    }
    const note = linkNote.trim();
    commit(linkOps(body, ranges, {
      kind: "url",
      url: normalized.url,
      ...(note.length === 0 ? {} : { note })
    }));
    linkUrl = "";
    linkNote = "";
    linkFailed = undefined;
  };

  const removeLink = (link: PlacedLink) => {
    if (body === undefined) return;
    commit(linkOps(body, [{ blockId: link.blockId, from: link.from, to: link.to }], undefined));
    if (editingLink === link.mark.id) editingLink = undefined;
  };

  const startEditingLink = (link: PlacedLink) => {
    const held = link.mark.link;
    if (held?.kind !== "url") return;
    editingLink = link.mark.id;
    editLinkUrl = held.url;
    editLinkNote = held.note ?? "";
    linkFailed = undefined;
  };

  const saveLink = (link: PlacedLink) => {
    const normalized = normalizeLinkUrl(editLinkUrl);
    if (!normalized.ok) {
      linkFailed = normalized.reason;
      return;
    }
    const note = editLinkNote.trim();
    commit(updateLinkOps(link, {
      kind: "url",
      url: normalized.url,
      ...(note.length === 0 ? {} : { note })
    }));
    editingLink = undefined;
    linkFailed = undefined;
  };

  const labelOf = (link: PlacedLink): string => {
    const held = link.mark.link;
    if (held === undefined) return "";
    if (held.kind === "url") return held.url;
    if (held.kind === "resource") return `${held.ref.kind} ${held.ref.id}`;
    if (held.kind === "persona") return `persona ${held.personaId}`;
    return "actor";
  };

  const addComment = async () => {
    const held = body;
    const at = selection;
    const message = composing.trim();
    if (
      held === undefined ||
      !isCommentableSelection(at) ||
      documentId === undefined ||
      message.length === 0
    ) return;

    const within = anchorOf(held, at);
    if (within === undefined) return;

    sending = true;
    failed = undefined;
    try {
      const { id } = await create({
        table: "commentThreads",
        fields: threadFields({
          projectId: project,
          documentId,
          within,
          quote: quoteOf(held, within) ?? text,
          by: viewer,
          now: Date.now()
        })
      });
      await create({
        table: "comments",
        fields: remarkFields({ projectId: project, threadId: id, text: message, by: viewer })
      });
      composing = "";
      await refreshAll(threadsQuery, remarksQuery);
    } catch (error) {
      failed = error instanceof Error ? error.message : "The comment was not saved.";
    } finally {
      sending = false;
    }
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };

  const openThread = (id: string) =>
    view.inspect("document-editor.comment", { kind: "comment", id });
  const openPerson = (id: string) => view.inspect("general.person", { kind: "person", id });

  /**
   * A run of text becoming a hole.
   *
   * The words are what the hole says by default, so a template placed without
   * changing anything reads exactly like the document it came from.
   */
  const holeBody = $derived(runtime?.body);
  const holeOffer = $derived(holeBody === undefined ? "Hole 1" : nextHoleName(holeBody));
  const holeWords = $derived(
    holeBody === undefined ? "" : selectedWords(holeBody, view.selection)
  );

  const templateify = () => {
    if (runtime === undefined || holeBody === undefined) return;
    const ops = selectionHoleOps(holeBody, view.selection, holeOffer);
    if (ops.length > 0) runtime.apply(ops);
  };
</script>

{#snippet head(title: string)}
  <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5">
    <span class="text-caption font-semibold tracking-wide uppercase">{title}</span>
  </div>
{/snippet}

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Selection" }]}
      onnavigate={navigate}
    />
  {/snippet}

  <div class="flex flex-col gap-2">
    <div class="pt-2 pb-2">
      {#if text === undefined}
        <PanelNote tone="muted">Nothing is selected in the document.</PanelNote>
      {:else if text.length === 0}
        <PanelNote tone="muted">The caret is here, but nothing is selected yet.</PanelNote>
      {:else if selectionCount > 1}
        <PanelQuote source={`${selectionCount} selections · ${characterCount} characters`}>
          {selectionExcerpt}
        </PanelQuote>
      {:else}
        <PanelQuote source={`${text.length} characters`}>{text}</PanelQuote>
      {/if}

      {#if spans}
        <div class="pt-1.5">
          <PanelNote tone="muted">
            The selection crosses {blocks.length} blocks. Block settings apply to each of them.
          </PanelNote>
        </div>
      {/if}
    </div>

    {@render head("Style")}
    <div class="flex flex-col gap-3 px-3 pb-2">
      <PanelSelect
        label="Style"
        value={styleKey.value ?? set.defaultKey}
        mixed={styleKey.mixed}
        options={styleOptions(set)}
        onchange={setStyle}
      />

      <button
        type="button"
        class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-control flex min-w-0 items-center gap-2 border px-2 py-1.5 text-start"
        disabled={styleKey.mixed}
        title={styleKey.mixed ? "The selected blocks use different named styles" : "Edit the named style"}
        onclick={() => view.inspect("document-editor.named-style", { kind: "named-style", id: styleKey.value ?? set.defaultKey })}
      >
        <span class="text-body-sm text-ink-primary min-w-0 flex-1 truncate">
          {family.mixed ? "Mixed typefaces" : (family.value ?? "IBM Plex Sans")}
        </span>
        <span class="text-caption text-ink-muted shrink-0 tabular-nums">
          {size.mixed ? "Mixed" : `${size.value ?? 16}px`}
        </span>
      </button>

      <PanelInlineStyle
        marks={[...marks.on]}
        mixedMarks={marks.mixed}
        options={STYLES}
        foreground={orNone(colour.color)}
        background={orNone(colour.background)}
        foregroundOptions={INKS}
        backgroundOptions={FILLS}
        coloursMixed={colour.mixed}
        onmarks={setMarks}
        onforeground={setInk}
        onbackground={setFill}
      />
      <PanelAlignment
        value={align.value ?? "start"}
        mixed={align.mixed}
        onchange={setAlign}
      />
    </div>

    <PanelSpacing
      spaceBefore={before.value ?? 0}
      spaceAfter={after.value ?? 0}
      lineHeight={leading.value ?? 26}
      indent={indent.value ?? 0}
      onchange={setSpacing}
    />

    {#if holeWords !== ""}
      <PanelSection title="Template" chevron="end">
        <div class="flex flex-col items-start gap-2">
          <PanelNote tone="muted">
            Make this a hole and a template built from this document will ask what fills it, starting
            from what it says now.
          </PanelNote>
          <PanelButton
            label="Templateify"
            tone="primary"
            title={`Turn the selection into a hole called ${holeOffer}`}
            onclick={templateify}
          />
        </div>
      </PanelSection>
    {/if}

    <PanelSection title="Comments" count={here.length} open={here.length > 0} chevron="end" flush>
      {#if commentable}
        <div class="flex flex-col gap-2.5 px-3 pb-1">
          <span class="text-caption text-ink-muted font-medium">New comment on the selected text</span>
          <Textarea
            placeholder="Write a comment on the selection…"
            bind:value={composing}
            class="text-body-sm field-sizing-content min-h-16 resize-none"
          />
          <div class="flex">
            <PanelButton
              label={sending ? "Adding…" : "Add comment"}
              tone="primary"
              disabled={sending || composing.trim().length === 0 || viewer.length === 0 || project.length === 0}
              onclick={() => void addComment()}
            />
          </div>
          {#if failed !== undefined}
            <PanelNote tone="gap">{failed}</PanelNote>
          {/if}
        </div>
      {:else}
        <div class="px-3 pb-1">
          <PanelNote tone="muted">
            Comments require one contiguous selection. Keep one passage selected to start a thread.
          </PanelNote>
        </div>
      {/if}

      <div class="border-border-subtle mt-1.5 flex flex-col gap-2.5 border-t pt-2">
        {#if here.length > 0}
          <span class="text-caption text-ink-muted px-3 font-medium">Open conversations</span>
        {/if}
        {#each here as thread (thread._id)}
          {@const first = remarksOf(remarks, thread._id)[0]}
          <PanelQuote
            source={nameOf(users, thread.createdBy)}
            when={ago(thread._creationTime, now)}
            onopen={() => thread.createdBy.kind === "user" && openPerson(thread.createdBy.userId)}
          >
            <button
              type="button"
              title="Open the thread"
              class="text-body-sm text-ink-secondary m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start"
              onclick={() => openThread(thread._id)}
            >
              {first === undefined ? (thread.quote ?? "") : textOf(first)}
            </button>
          </PanelQuote>
        {/each}
      </div>
    </PanelSection>

    <PanelSection title="Links" count={links.length} open={links.length > 0} chevron="end" flush>
      <div class="flex flex-col gap-2.5 px-3 pb-1">
        <Input
          type="url"
          aria-label="Link"
          placeholder="https://"
          bind:value={linkUrl}
          onkeydown={(event) => event.key === "Enter" && addLink()}
          class="text-body-sm h-auto py-1"
        />
        <Textarea
          aria-label="Link notes"
          placeholder="Notes about this link…"
          bind:value={linkNote}
          class="text-body-sm field-sizing-content min-h-16 resize-none"
        />
        <div class="flex">
          <PanelButton label="Add link" tone="primary" disabled={linkUrl.trim().length === 0 || ranges.length === 0} onclick={addLink} />
        </div>
        {#if linkFailed !== undefined && editingLink === undefined}
          <PanelNote tone="gap">{linkFailed}</PanelNote>
        {/if}
      </div>

      <div class="border-border-subtle mt-1.5 flex flex-col gap-2 border-t pt-2">
        {#each links as link (link.mark.id)}
          <div class="flex flex-col gap-2 px-3">
            {#if editingLink === link.mark.id && link.mark.link?.kind === "url"}
              <Input
                type="url"
                aria-label="Edit link"
                bind:value={editLinkUrl}
                class="text-body-sm h-auto py-1"
              />
              <Textarea
                aria-label="Edit link notes"
                placeholder="Notes about this link…"
                bind:value={editLinkNote}
                class="text-body-sm field-sizing-content min-h-16 resize-none"
              />
              <div class="flex flex-wrap gap-1.5">
                <PanelButton label="Save" tone="primary" onclick={() => saveLink(link)} />
                <PanelButton label="Cancel" tone="ghost" onclick={() => (editingLink = undefined)} />
                <PanelButton label="Remove" tone="danger" onclick={() => removeLink(link)} />
              </div>
              {#if linkFailed !== undefined}
                <PanelNote tone="gap">{linkFailed}</PanelNote>
              {/if}
            {:else}
              <div class="flex min-w-0 items-center gap-2">
                {#if link.mark.link?.kind === "url" && safeLinkHref(link.mark.link) !== undefined}
                  <a
                    href={safeLinkHref(link.mark.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-body-sm text-ink-primary min-w-0 flex-1 truncate"
                  >
                    {labelOf(link)}
                  </a>
                {:else}
                  <span class="text-body-sm text-ink-secondary min-w-0 flex-1 truncate">{labelOf(link)}</span>
                {/if}
                <PanelButton label="Edit" tone="ghost" onclick={() => startEditingLink(link)} />
              </div>
              {#if link.mark.link?.kind === "url" && link.mark.link.note}
                <p class="text-caption text-ink-muted m-0 whitespace-pre-wrap">{link.mark.link.note}</p>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </PanelSection>
  </div>
</Panel>
