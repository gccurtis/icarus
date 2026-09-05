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
          if (!event.shiftKey || !(event.target instanceof Element)) return false;
          const block = event.target.closest<HTMLElement>("[data-block]");
          const blockId = block?.dataset.block;
          if (blockId === undefined) return false;

          let selection: TextSelection | undefined;
          view.state.doc.descendants((node, at) => {
            if (selection !== undefined) return false;
            if (node.type.name !== "text_block" || node.attrs.blockId !== blockId) return;
            selection = TextSelection.create(view.state.doc, at + 1, at + 1 + node.content.size);
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
