import { Plugin, TextSelection } from "prosemirror-state";

import type { MarkLink } from "$representation/data/types/content/content-block";

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

export type LinkResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: string };

export const normalizeLinkUrl = (raw: string): LinkResult => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Enter a URL." };

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return { ok: false, reason: "Use an http, https, mailto, or tel link." };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, reason: "Enter a valid URL." };
  }
};

export const safeLinkHref = (link: MarkLink | null | undefined): string | undefined => {
  if (link?.kind !== "url") return undefined;
  const normalized = normalizeLinkUrl(link.url);
  return normalized.ok ? normalized.url : undefined;
};

export type WordRange = { readonly from: number; readonly to: number };

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}_'’]/u;

/** Browser-independent word boundaries for the editor's double-click contract. */
export const wordAt = (text: string, offset: number): WordRange | undefined => {
  if (text.length === 0) return undefined;

  let at = Math.min(Math.max(0, offset), text.length - 1);
  if (!WORD_CHARACTER.test(text[at] ?? "") && at > 0 && WORD_CHARACTER.test(text[at - 1] ?? "")) {
    at -= 1;
  }
  if (!WORD_CHARACTER.test(text[at] ?? "")) return undefined;

  let from = at;
  let to = at + 1;
  while (from > 0 && WORD_CHARACTER.test(text[from - 1] ?? "")) from -= 1;
  while (to < text.length && WORD_CHARACTER.test(text[to] ?? "")) to += 1;
  return { from, to };
};

const linkElement = (target: EventTarget | null): HTMLAnchorElement | undefined => {
  if (!(target instanceof Element)) return undefined;
  const link = target.closest("a.document-link");
  return link instanceof HTMLAnchorElement ? link : undefined;
};

/** Editor pointer contracts that ProseMirror does not provide itself. */
export const editorPointerGestures = (): Plugin =>
  new Plugin({
    props: {
      handleDOMEvents: {
        mousedown: (_view, event) => {
          if (!event.metaKey && !event.ctrlKey) return false;
          if (linkElement(event.target) === undefined) return false;

          // ProseMirror interprets a modified pointer-down as structural node
          // selection before the later click can open the link. Keep navigation
          // from changing the document selection at all.
          event.preventDefault();
          return true;
        },
        click: (_view, event) => {
          if (!event.metaKey && !event.ctrlKey) return false;
          const link = linkElement(event.target);
          if (link === undefined || link.href.length === 0) return false;

          event.preventDefault();
          event.stopPropagation();
          window.open(link.href, "_blank", "noopener,noreferrer");
          return true;
        },
        dblclick: (view, event) => {
          if (!(event.target instanceof Element)) return false;
          const block = event.target.closest<HTMLElement>("[data-block]");
          const blockId = block?.dataset.block;
          if (blockId === undefined) return false;

          let selection: TextSelection | undefined;
          view.state.doc.descendants((node, at) => {
            if (selection !== undefined) return false;
            if (node.type.name !== "text_block" || node.attrs.blockId !== blockId) return;

            if (event.shiftKey) {
              selection = TextSelection.create(view.state.doc, at + 1, at + 1 + node.content.size);
              return false;
            }

            const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (hit === null) return false;
            const word = wordAt(node.textContent, hit.pos - at - 1);
            if (word === undefined) return false;
            selection = TextSelection.create(view.state.doc, at + 1 + word.from, at + 1 + word.to);
            return false;
          });
          if (selection === undefined) return false;

          event.preventDefault();
          view.dispatch(view.state.tr.setSelection(selection).setMeta("addToHistory", false));
          view.focus();
          return true;
        }
      }
    }
  });
