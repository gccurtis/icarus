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
  import { createTextSelectionState } from "$app-views/categories/document-editor/inspector/text-selection.state.svelte";
  import { startCommentCommand } from "$app-views/categories/document-editor/procedures/start-comment-command.svelte";
  import {
    agree,
    formatOps,
    resolvedOf,
    type HorizontalAlignment
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { FILLS, INKS, orClear, orNone } from "$app-views/categories/document-editor/procedures/colours";
  import {
    markHoleOps,
    markedHoleAt,
    nextHoleName,
    selectedWords
  } from "$app-views/categories/document-editor/procedures/templating";
  import {
    commentsQuery,
    peopleIn,
    remarksIn,
    remarksOf,
    threadsIn,
    threadsOf,
    viewerId
  } from "$app-views/categories/document-editor/procedures/comments";
  import {
    anchorOf,
    isCommentableSelection,
    quoteOf,
    threadsOn
  } from "$app-views/categories/document-editor/procedures/comment-anchors";
  import { ago, nameOf, textOf } from "$app-views/categories/document-editor/procedures/comment-copy";
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
  import {
    linkLabel,
    normalizeLinkUrl,
    safeLinkHref
  } from "$app-views/categories/document-editor/procedures/links";
  import {
    applyStyleOps,
    ensureStylesOps,
    styleOptions,
    styleSetOf
  } from "$app-views/categories/document-editor/procedures/styles";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = view.active.resourceId;

  const state = createTextSelectionState();

  $effect(() => {
    state.runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(state.runtime?.body);
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

  const comments = commentsQuery();
  const viewer = $derived(viewerId(comments));
  const users = $derived(peopleIn(comments));
  const remarks = $derived(remarksIn(comments));
  const threads = $derived(threadsOf(threadsIn(comments), documentId ?? ""));
  const here = $derived(body === undefined ? [] : threadsOn(threads, body, selection));
  const now = Date.now();

  const commentCommand = startCommentCommand();
  const failed = $derived(commentCommand.failed);
  const sending = $derived(commentCommand.sending);

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) state.runtime?.apply(ops);
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
    const normalized = normalizeLinkUrl(state.linkUrl);
    if (!normalized.ok) {
      state.linkFailed = normalized.reason;
      return;
    }
    const note = state.linkNote.trim();
    commit(linkOps(body, ranges, {
      kind: "url",
      url: normalized.url,
      ...(note.length === 0 ? {} : { note })
    }));
    state.linkUrl = "";
    state.linkNote = "";
    state.linkFailed = undefined;
  };

  const removeLink = (link: PlacedLink) => {
    if (body === undefined) return;
    commit(linkOps(body, [{ blockId: link.blockId, from: link.from, to: link.to }], undefined));
    if (state.editingLink === link.mark.id) state.editingLink = undefined;
  };

  const startEditingLink = (link: PlacedLink) => {
    const held = link.mark.link;
    if (held?.kind !== "url") return;
    state.editingLink = link.mark.id;
    state.editLinkUrl = held.url;
    state.editLinkNote = held.note ?? "";
    state.linkFailed = undefined;
  };

  const saveLink = (link: PlacedLink) => {
    const normalized = normalizeLinkUrl(state.editLinkUrl);
    if (!normalized.ok) {
      state.linkFailed = normalized.reason;
      return;
    }
    const note = state.editLinkNote.trim();
    commit(updateLinkOps(link, {
      kind: "url",
      url: normalized.url,
      ...(note.length === 0 ? {} : { note })
    }));
    state.editingLink = undefined;
    state.linkFailed = undefined;
  };

  const addComment = () => {
    const held = body;
    const at = selection;
    const message = state.composing.trim();
    if (
      held === undefined ||
      !isCommentableSelection(at) ||
      documentId === undefined ||
      message.length === 0
    ) return;

    const within = anchorOf(held, at);
    if (within === undefined) return;

    commentCommand.start(
      {
        documentId,
        within,
        quote: quoteOf(held, within) ?? text,
        text: message
      },
      () => (state.composing = "")
    );
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };

  const openThread = (id: string) =>
    view.inspect("document-editor.comment", { kind: "comment", id });
  const openPerson = (id: string) => view.inspect("general.person", { kind: "person", id });

  /**
   * A run of text marked as a hole.
   *
   * Nothing about the document changes. The words are what the hole says by
   * default, so a template placed without changing anything reads exactly like
   * the document it came from.
   */
  const holeBody = $derived(state.runtime?.body);
  const holeOffer = $derived(holeBody === undefined ? "Hole 1" : nextHoleName(holeBody));
  const holeWords = $derived(
    holeBody === undefined ? "" : selectedWords(holeBody, view.selection)
  );
  const holeHere = $derived(holeBody === undefined ? undefined : markedHoleAt(holeBody, view.selection));

  const templateify = () => {
    if (state.runtime === undefined || holeBody === undefined) return;
    const ops = markHoleOps(holeBody, view.selection, holeOffer);
    if (ops.length > 0) state.runtime.apply(ops);
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
          {#if holeHere === undefined}
            <PanelNote tone="muted">
              Mark this as a hole and a template built from this document will ask what fills it,
              starting from what it says now. The document itself does not change.
            </PanelNote>
            <PanelButton
              label="Templateify"
              tone="primary"
              title={`Mark the selection as a hole called ${holeOffer}`}
              onclick={templateify}
            />
          {:else}
            <PanelNote tone="muted">
              These words are the hole <b>{holeHere}</b>. They stay exactly as they are here; the
              template made from this document asks what goes in their place.
            </PanelNote>
          {/if}
        </div>
      </PanelSection>
    {/if}

    <PanelSection title="Comments" count={here.length} open={here.length > 0} chevron="end" flush>
      {#if commentable}
        <div class="flex flex-col gap-2.5 px-3 pb-1">
          <span class="text-caption text-ink-muted font-medium">New comment on the selected text</span>
          <Textarea
            placeholder="Write a comment on the selection…"
            bind:value={state.composing}
            class="text-body-sm field-sizing-content min-h-16 resize-none"
          />
          <div class="flex">
            <PanelButton
              label={sending ? "Adding…" : "Add comment"}
              tone="primary"
              disabled={sending || state.composing.trim().length === 0 || viewer.length === 0 || documentId === undefined}
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
          bind:value={state.linkUrl}
          onkeydown={(event) => event.key === "Enter" && addLink()}
          class="text-body-sm h-auto py-1"
        />
        <Textarea
          aria-label="Link notes"
          placeholder="Notes about this link…"
          bind:value={state.linkNote}
          class="text-body-sm field-sizing-content min-h-16 resize-none"
        />
        <div class="flex">
          <PanelButton label="Add link" tone="primary" disabled={state.linkUrl.trim().length === 0 || ranges.length === 0} onclick={addLink} />
        </div>
        {#if state.linkFailed !== undefined && state.editingLink === undefined}
          <PanelNote tone="gap">{state.linkFailed}</PanelNote>
        {/if}
      </div>

      <div class="border-border-subtle mt-1.5 flex flex-col gap-2 border-t pt-2">
        {#each links as link (link.mark.id)}
          <div class="flex flex-col gap-2 px-3">
            {#if state.editingLink === link.mark.id && link.mark.link?.kind === "url"}
              <Input
                type="url"
                aria-label="Edit link"
                bind:value={state.editLinkUrl}
                class="text-body-sm h-auto py-1"
              />
              <Textarea
                aria-label="Edit link notes"
                placeholder="Notes about this link…"
                bind:value={state.editLinkNote}
                class="text-body-sm field-sizing-content min-h-16 resize-none"
              />
              <div class="flex flex-wrap gap-1.5">
                <PanelButton label="Save" tone="primary" onclick={() => saveLink(link)} />
                <PanelButton label="Cancel" tone="ghost" onclick={() => (state.editingLink = undefined)} />
                <PanelButton label="Remove" tone="danger" onclick={() => removeLink(link)} />
              </div>
              {#if state.linkFailed !== undefined}
                <PanelNote tone="gap">{state.linkFailed}</PanelNote>
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
                    {linkLabel(link.mark.link)}
                  </a>
                {:else}
                  <span class="text-body-sm text-ink-secondary min-w-0 flex-1 truncate">{linkLabel(link.mark.link)}</span>
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
