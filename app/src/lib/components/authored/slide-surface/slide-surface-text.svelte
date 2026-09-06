<script lang="ts">
  import { tick } from "svelte";

  import type { SurfaceText, SurfaceTextEdit } from "$authored-components/slide-surface/slide-surface-types";

  let {
    text,
    editing = false,
    fit = false,
    onedit,
    oncaret,
    onexit
  }: {
    text: SurfaceText;
    editing?: boolean;
    fit?: boolean;
    onedit?: (edit: SurfaceTextEdit) => void;
    oncaret?: (from: number, to: number) => void;
    onexit?: () => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let pendingCaret: number | undefined;
  let shrink = $state(1);

  const style = $derived(
    `font-family: ${JSON.stringify(text.font)}; font-size: ${text.size * shrink}px; font-weight: ${text.weight}; ` +
      `font-style: ${text.italic ? "italic" : "normal"}; text-decoration: ${text.underline ? "underline" : "none"}; ` +
      `color: ${text.color}; line-height: ${text.lineHeight}; text-align: ${text.align}; ` +
      `padding: ${text.spaceBefore}px 0 ${text.spaceAfter}px; text-indent: ${text.indent}px;`
  );

  const lengthOf = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.length ?? 0;
    if (node instanceof HTMLElement && node.dataset.length !== undefined) return Number(node.dataset.length);
    let total = 0;
    for (const child of node.childNodes) total += lengthOf(child);
    return total;
  };

  const offsetOf = (node: Node, offset: number): number => {
    if (host === undefined) return 0;
    let total = 0;
    const walk = (current: Node): boolean => {
      if (current === node) {
        if (current.nodeType === Node.TEXT_NODE) total += offset;
        else {
          for (let index = 0; index < offset; index += 1) total += lengthOf(current.childNodes[index]);
        }
        return true;
      }
      if (current.nodeType === Node.TEXT_NODE || (current instanceof HTMLElement && current.dataset.length !== undefined)) {
        total += lengthOf(current);
        return false;
      }
      for (const child of current.childNodes) if (walk(child)) return true;
      return false;
    };
    walk(host);
    return total;
  };

  const positionAt = (wanted: number): { node: Node; offset: number } => {
    if (host === undefined) throw new Error("no host");
    let remaining = wanted;
    let last: { node: Node; offset: number } = { node: host, offset: 0 };
    const walk = (current: Node): { node: Node; offset: number } | undefined => {
      if (current.nodeType === Node.TEXT_NODE) {
        const length = current.nodeValue?.length ?? 0;
        if (remaining <= length) return { node: current, offset: remaining };
        remaining -= length;
        last = { node: current, offset: length };
        return undefined;
      }
      if (current instanceof HTMLElement && current.dataset.length !== undefined) {
        const length = Number(current.dataset.length);
        if (remaining < length) return { node: current.parentNode as Node, offset: Array.from(current.parentNode?.childNodes ?? []).indexOf(current) };
        remaining -= length;
        last = { node: current.parentNode as Node, offset: Array.from(current.parentNode?.childNodes ?? []).indexOf(current) + 1 };
        return undefined;
      }
      for (const child of current.childNodes) {
        const found = walk(child);
        if (found) return found;
      }
      return undefined;
    };
    return walk(host) ?? last;
  };

  const range = (): { from: number; to: number } | undefined => {
    const selection = window.getSelection();
    if (host === undefined || selection === null || selection.rangeCount === 0) return undefined;
    const held = selection.getRangeAt(0);
    if (!host.contains(held.startContainer) || !host.contains(held.endContainer)) return undefined;
    return { from: offsetOf(held.startContainer, held.startOffset), to: offsetOf(held.endContainer, held.endOffset) };
  };

  const placeCaret = (at: number) => {
    if (host === undefined) return;
    const selection = window.getSelection();
    if (selection === null) return;
    const position = positionAt(Math.max(0, Math.min(at, text.display.length)));
    const held = document.createRange();
    held.setStart(position.node, position.offset);
    held.collapse(true);
    selection.removeAllRanges();
    selection.addRange(held);
  };

  const emit = (from: number, to: number, insert: string) => {
    pendingCaret = Math.min(from, to) + insert.length;
    onedit?.({ blockId: text.blockId, from, to, insert });
  };

  const wordStart = (from: number): number => {
    const before = text.display.slice(0, from);
    const trimmed = before.replace(/\s+$/, "");
    const at = trimmed.lastIndexOf(" ");
    return at === -1 ? 0 : at + 1;
  };

  const beforeInput = (event: InputEvent) => {
    if (!editing) return;
    const held = range();
    if (held === undefined) return;
    const { from, to } = held;
    const collapsed = from === to;

    switch (event.inputType) {
      case "insertText":
      case "insertReplacementText":
        event.preventDefault();
        emit(from, to, event.data ?? "");
        return;
      case "insertParagraph":
      case "insertLineBreak":
        event.preventDefault();
        emit(from, to, "\n");
        return;
      case "insertFromPaste":
      case "insertFromDrop": {
        event.preventDefault();
        const pasted = event.dataTransfer?.getData("text/plain") ?? "";
        emit(from, to, pasted);
        return;
      }
      case "deleteContentBackward":
        event.preventDefault();
        if (!collapsed) emit(from, to, "");
        else if (from > 0) emit(from - 1, from, "");
        return;
      case "deleteContentForward":
        event.preventDefault();
        if (!collapsed) emit(from, to, "");
        else if (from < text.display.length) emit(from, from + 1, "");
        return;
      case "deleteWordBackward":
        event.preventDefault();
        if (!collapsed) emit(from, to, "");
        else emit(wordStart(from), from, "");
        return;
      case "deleteByCut":
        event.preventDefault();
        if (!collapsed) {
          void navigator.clipboard?.writeText(text.display.slice(Math.min(from, to), Math.max(from, to)));
          emit(from, to, "");
        }
        return;
      default:
        return;
    }
  };

  const reconcile = () => {
    if (!editing || host === undefined) return;
    const typed = host.innerText.replace(/\n$/, "");
    if (typed === text.display) return;
    const shortest = Math.min(typed.length, text.display.length);
    let head = 0;
    while (head < shortest && typed[head] === text.display[head]) head += 1;
    let tail = 0;
    while (tail < shortest - head && typed[typed.length - 1 - tail] === text.display[text.display.length - 1 - tail]) tail += 1;
    emit(head, text.display.length - tail, typed.slice(head, typed.length - tail));
  };

  const keydown = (event: KeyboardEvent) => {
    if (!editing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onexit?.();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && ["b", "i", "u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  };

  const report = () => {
    if (!editing) return;
    const held = range();
    if (held !== undefined) oncaret?.(held.from, held.to);
  };

  $effect(() => {
    if (!editing) return;
    document.addEventListener("selectionchange", report);
    return () => document.removeEventListener("selectionchange", report);
  });

  $effect(() => {
    void text.display;
    if (!editing || pendingCaret === undefined) return;
    const at = pendingCaret;
    pendingCaret = undefined;
    void tick().then(() => {
      host?.focus({ preventScroll: true });
      placeCaret(at);
      report();
    });
  });

  const POINT_LIFETIME = 600;

  let lastPoint: { x: number; y: number; at: number } | undefined;

  const remember = (event: PointerEvent) => {
    lastPoint = { x: event.clientX, y: event.clientY, at: performance.now() };
  };

  const caretFromPoint = (): boolean => {
    if (host === undefined || lastPoint === undefined || performance.now() - lastPoint.at > POINT_LIFETIME) return false;
    const found = document.caretRangeFromPoint?.(lastPoint.x, lastPoint.y);
    if (!found || !host.contains(found.startContainer)) return false;
    const selection = window.getSelection();
    if (selection === null) return false;
    selection.removeAllRanges();
    selection.addRange(found);
    return true;
  };

  $effect(() => {
    if (!editing || host === undefined) return;
    const element = host;
    void tick().then(() => {
      element.focus({ preventScroll: true });
      if (!caretFromPoint()) placeCaret(text.display.length);
      lastPoint = undefined;
      report();
    });
  });

  $effect(() => {
    void text.display;
    void text.size;
    if (!fit || host === undefined) {
      shrink = 1;
      return;
    }
    const element = host;
    const box = element.parentElement;
    if (box === null) return;
    shrink = 1;
    void tick().then(() => {
      let factor = 1;
      for (let step = 0; step < 12 && element.scrollHeight > box.clientHeight + 1; step += 1) {
        factor *= 0.92;
        element.style.fontSize = `${text.size * factor}px`;
      }
      shrink = factor;
    });
  });
</script>

<div
  bind:this={host}
  class="text"
  class:is-editing={editing}
  data-block={text.blockId}
  {style}
  contenteditable={editing ? "true" : "false"}
  spellcheck={editing}
  role="textbox"
  tabindex={editing ? 0 : undefined}
  aria-multiline="true"
  aria-label="Text"
  onbeforeinput={beforeInput}
  oninput={reconcile}
  onkeydown={keydown}
  onpointerdown={remember}
  onmouseup={report}
>{#each text.runs as run, index (index)}{#if run.formula}<span
        class="chip"
        contenteditable="false"
        data-length={run.text.length}>{run.text}</span
      >{:else}<span
        class="run"
        class:is-bold={run.bold}
        class:is-italic={run.italic}
        class:is-underline={run.underline}
        class:is-strike={run.strike}
        class:is-code={run.code}
        style:color={run.color}>{run.text}</span
      >{/if}{/each}</div>

<style>
  .text {
    min-height: 1em;
    flex-shrink: 0;
    outline: none;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    cursor: inherit;
    caret-color: var(--token-ink-primary);
  }

  .text.is-editing {
    cursor: text;
    user-select: text;
  }

  .text:not(.is-editing) {
    user-select: none;
  }

  .text.is-editing::selection,
  .text.is-editing :global(*::selection) {
    background: color-mix(in srgb, var(--token-color-active-fill) 28%, transparent);
  }

  .is-bold { font-weight: 700; }
  .is-italic { font-style: italic; }
  .is-underline { text-decoration: underline; }
  .is-strike { text-decoration: line-through; }
  .is-underline.is-strike { text-decoration: underline line-through; }
  .is-code { font-family: var(--token-font-mono); font-size: 0.9em; }

  .chip {
    display: inline-block;
    padding: 0 0.3em;
    border-radius: 0.25em;
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
    font-family: var(--token-font-mono);
    font-size: 0.85em;
    user-select: none;
  }
</style>
