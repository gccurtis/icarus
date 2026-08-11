import {
  cssDeclaration,
  safeCssColor,
  safeCssLength,
  safeFontFamily,
  safeHref
} from '$systems/documents/sanitize';
import { Schema } from 'prosemirror-model';

/**
 * The ProseMirror schema for Taurus documents — a direct projection of Omega's
 * block model (docs/architecture/document-editor.md):
 *
 * - Omega `paragraph` and `prompt` blocks → the `paragraph` node (the real kind
 *   is preserved in the `kind` attr so round-trips never rewrite it).
 * - Omega `heading_1..6` → the `heading` node with a `level` attr.
 * - Every block node carries `blockId`/`rowId` attrs — the stable Omega ids the
 *   change-set differ addresses ops with. New nodes (from Enter, paste) start
 *   with `blockId: null`; the next sync assigns both a fresh block id and a
 *   fresh row id so ordinary line breaks never become accidental columns.
 * - Omega marks map 1:1: bold→strong, italic→em, underline, strike, code, link.
 */
export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: {
        blockId: { default: null },
        rowId: { default: null },
        kind: { default: 'text' },
        subKind: { default: 'body' }
      },
      parseDOM: [{ tag: 'p' }],
      toDOM(node) {
        const kind = node.attrs.kind as string;
        const subKind = node.attrs.subKind as string;
        const attrs: Record<string, string> = {};
        if (kind && kind !== 'text') attrs['data-kind'] = kind;
        if (subKind && subKind !== 'body') attrs['data-subkind'] = subKind;
        return ['p', attrs, 0];
      }
    },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 }, blockId: { default: null }, rowId: { default: null } },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM(node) {
        return [`h${node.attrs.level}`, 0];
      }
    },
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { blockId: { default: null }, rowId: { default: null }, kind: { default: 'code' } },
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() {
        return ['pre', ['code', 0]];
      }
    },
    divider: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { blockId: { default: null }, rowId: { default: null }, kind: { default: 'divider' } },
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return ['hr'];
      }
    },
    // A list block: flat `list_item` children, each with a nesting `level` and (for
    // check lists) a `checked` state — mirrors Omega's ListBlockData.
    list: {
      group: 'block',
      content: 'list_item+',
      attrs: {
        blockId: { default: null },
        rowId: { default: null },
        listType: { default: 'bullet' },
        start: { default: 1 }
      },
      parseDOM: [
        { tag: 'ul', attrs: { listType: 'bullet' } },
        { tag: 'ol', attrs: { listType: 'ordered' } }
      ],
      toDOM(node) {
        const type = node.attrs.listType as string;
        const start = Number(node.attrs.start) || 1;
        const attrs: Record<string, string> = { 'data-list-type': type, class: 'doc-list' };
        if (type === 'ordered' && start !== 1) attrs.style = `counter-reset: doc-list-item ${start - 1}`;
        return [type === 'ordered' ? 'ol' : 'ul', attrs, 0];
      }
    },
    list_item: {
      content: 'inline*',
      attrs: { level: { default: 0 }, checked: { default: false } },
      parseDOM: [{ tag: 'li' }],
      toDOM(node) {
        const attrs: Record<string, string> = { 'data-level': String(node.attrs.level) };
        if (node.attrs.checked) attrs['data-checked'] = 'true';
        return ['li', attrs, 0];
      }
    },
    // A read-only placeholder for kinds not yet editable inline (image).
    // Its typed data lives in the snapshot; the differ preserves it untouched, so
    // the block round-trips even though the node carries no content.
    block_leaf: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: {
        blockId: { default: null },
        rowId: { default: null },
        kind: { default: 'list' },
        label: { default: '' }
      },
      toDOM(node) {
        const kind = node.attrs.kind as string;
        return [
          'div',
          { 'data-kind': kind, class: 'block-leaf', contenteditable: 'false' },
          String(node.attrs.label || kind)
        ];
      }
    },
    text: { group: 'inline' }
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM() {
        return ['strong', 0];
      }
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM() {
        return ['em', 0];
      }
    },
    underline: {
      parseDOM: [{ tag: 'u' }],
      toDOM() {
        return ['u', 0];
      }
    },
    strike: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }],
      toDOM() {
        return ['s', 0];
      }
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code', 0];
      }
    },
    // Every value below is validated on the way into the DOM. Omega does NOT
    // scheme-check hrefs and only length-bounds font names (verified 2026-07-27,
    // catalog S1/S2/S4), so this boundary is the last line of defence, not a
    // second one. See $systems/documents/sanitize.
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom) {
            // Pasted HTML is untrusted input too: drop an unsafe href here
            // rather than letting it into the document model.
            return { href: safeHref((dom as HTMLElement).getAttribute('href')) ?? '' };
          }
        }
      ],
      toDOM(mark) {
        const href = safeHref(mark.attrs.href as string);
        // A dropped href still renders its text — the link is simply inert.
        return href ? ['a', { href }, 0] : ['span', 0];
      }
    },
    // Inline typography marks (Omega's atom-level styling). `font` carries an
    // optional family and/or size; `fg`/`bg` carry a CSS color value.
    font: {
      attrs: { family: { default: '' }, size: { default: '' } },
      toDOM(mark) {
        const parts = [
          cssDeclaration('font-family', mark.attrs.family as string, safeFontFamily),
          cssDeclaration('font-size', mark.attrs.size as string, safeCssLength)
        ].filter((part): part is string => part !== null);
        return ['span', parts.length ? { style: parts.join('; ') } : {}, 0];
      }
    },
    fg: {
      attrs: { value: { default: '' } },
      toDOM(mark) {
        const style = cssDeclaration('color', mark.attrs.value as string, safeCssColor);
        return ['span', style ? { style } : {}, 0];
      }
    },
    bg: {
      attrs: { value: { default: '' } },
      toDOM(mark) {
        const style = cssDeclaration('background-color', mark.attrs.value as string, safeCssColor);
        return ['span', style ? { style } : {}, 0];
      }
    }
  }
});
