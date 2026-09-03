<script lang="ts">
  import { onMount } from "svelte";
  import { baseKeymap } from "prosemirror-commands";
  import { history, redo, undo } from "prosemirror-history";
  import { keymap } from "prosemirror-keymap";
  import { Schema, type Node as ProseMirrorNode } from "prosemirror-model";
  import { EditorState, TextSelection } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";

  import { read } from "$capabilities/store/index.remote";
  import {
    DEFAULT_PAGE_SETUP,
    layoutMetrics
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const pageSetup = DEFAULT_PAGE_SETUP;
  const layout = layoutMetrics(pageSetup);
  const PAGE_TEXT_CAPACITY = layout.pageTextCapacity;

  const schema = new Schema({
    nodes: {
      doc: { content: "page+" },
      page: {
        attrs: { number: { default: 1 } },
        content: "paragraph+",
        toDOM: (node) => [
          "article",
          { class: "document-page", "data-page": node.attrs.number },
          0
        ]
      },
      paragraph: {
        content: "inline*",
        group: "block",
        parseDOM: [{ tag: "p" }],
        toDOM: () => ["p", 0]
      },
      text: { group: "inline" }
    },
    marks: {}
  });

  const documentId = $derived(view.active.resourceId);
  const documentTitle = $derived.by(() => {
    if (documentId === undefined) return undefined;

    const answer = read({ path: `documents.${documentId}.title` });
    if (!answer.ready) return undefined;

    const found = answer.current;
    return found?.kind === "field" && typeof found.value === "string" ? found.value : undefined;
  });

  let host = $state<HTMLDivElement>();
  let editor = $state<EditorView>();

  const pageText = (text: string): readonly string[] => {
    if (text.length === 0) return [""];

    const pages: string[] = [];
    let remaining = text;

    while (remaining.length > PAGE_TEXT_CAPACITY) {
      const boundary = remaining.lastIndexOf(" ", PAGE_TEXT_CAPACITY);
      const end = boundary > 0 ? boundary : PAGE_TEXT_CAPACITY;
      pages.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }

    pages.push(remaining);
    return pages;
  };

  const paginatedDocument = (text: string) => {
    const pages = pageText(text);
    return schema.node(
      "doc",
      null,
      pages.map((page, index) =>
        schema.node(
          "page",
          { number: index + 1 },
          schema.node("paragraph", null, page === "" ? undefined : schema.text(page))
        )
      )
    );
  };

  const textOffsetAt = (document: ProseMirrorNode, position: number): number =>
    document.textBetween(0, position, "").length;

  const positionAt = (document: ProseMirrorNode, offset: number): number => {
    let pageStart = 0;
    let consumed = 0;

    for (let index = 0; index < document.childCount; index += 1) {
      const page = document.child(index);
      const text = page.textContent;
      if (offset <= consumed + text.length) {
        return pageStart + 2 + offset - consumed;
      }
      consumed += text.length;
      pageStart += page.nodeSize;
    }

    const last = document.lastChild;
    return last === null ? 1 : pageStart - last.nodeSize + last.content.size;
  };

  onMount(() => {
    if (host === undefined) {
      throw new Error("The document editor did not mount its ProseMirror host.");
    }

    const state = EditorState.create({
      doc: paginatedDocument("Start writing. This document is rendered and edited by ProseMirror."),
      plugins: [
        history(),
        keymap({
          "Mod-z": undo,
          "Shift-Mod-z": redo,
          "Mod-y": redo,
          ...baseKeymap
        })
      ]
    });

    let mounted: EditorView;
    mounted = new EditorView(host, {
      state,
      dispatchTransaction(transaction) {
        let next = mounted.state.apply(transaction);
        const document = paginatedDocument(next.doc.textContent);
        if (!document.eq(next.doc)) {
          const from = textOffsetAt(next.doc, next.selection.from);
          const to = textOffsetAt(next.doc, next.selection.to);
          const transform = next.tr
            .replaceWith(0, next.doc.content.size, document.content)
            .setMeta("addToHistory", false);
          next = next.apply(
            transform.setSelection(
              TextSelection.create(
                transform.doc,
                positionAt(transform.doc, from),
                positionAt(transform.doc, to)
              )
            )
          );
        }
        mounted.updateState(next);
      }
    });
    editor = mounted;

    return () => mounted.destroy();
  });

  const pageStyle = $derived.by(
    () =>
      `--page-width: ${layout.pageWidth}rem; ` +
      `--page-aspect: ${layout.paper.width} / ${layout.paper.height}; ` +
      `--margin-top: ${layout.marginPercent.top}%; --margin-right: ${layout.marginPercent.right}%; ` +
      `--margin-bottom: ${layout.marginPercent.bottom}%; --margin-left: ${layout.marginPercent.left}%`
  );
</script>

<div class="document-editor">
  <header class="title-bar bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">
      {documentTitle ?? "Loading document..."}
    </h1>
  </header>

  <div class="canvas bg-surface-panel">
    <div class="pasteboard">
      <div bind:this={host} class="editor" aria-label="Document editor" style={pageStyle}></div>
    </div>
  </div>
</div>

<style>
  .document-editor {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .title-bar {
    flex-shrink: 0;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .canvas {
    min-height: 0;
    flex: 1;
    overflow: auto;
    scrollbar-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent) transparent;
    scrollbar-width: thin;
  }

  .canvas::-webkit-scrollbar {
    width: calc(var(--token-spacing-unit) * 1.5);
    height: calc(var(--token-spacing-unit) * 1.5);
  }

  .canvas::-webkit-scrollbar-thumb {
    border-radius: var(--token-radius-control);
    background-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent);
  }

  .canvas::-webkit-scrollbar-track {
    background: transparent;
  }

  .pasteboard {
    display: flex;
    width: 100%;
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    flex-direction: column;
    align-items: center;
    padding: calc(var(--token-spacing-unit) * 10);
  }

  .editor {
    width: min(var(--page-width), 100%);
  }

  .editor :global(.ProseMirror) {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 8);
    outline: none;
    white-space: pre-wrap;
  }

  .editor :global(.document-page) {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    aspect-ratio: var(--page-aspect);
    margin: 0;
    padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
    border: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-elevated);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--token-ink-primary) 12%, transparent);
  }

  .editor :global(.document-page::after) {
    position: absolute;
    right: var(--margin-right);
    bottom: calc(var(--token-spacing-unit) * 3);
    color: var(--token-ink-muted);
    content: attr(data-page);
    font-size: var(--token-text-caption);
  }

  .editor :global(.ProseMirror p) {
    margin: 0 0 calc(var(--token-spacing-unit) * 4);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
  }
</style>
