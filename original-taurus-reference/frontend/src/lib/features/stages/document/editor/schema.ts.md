# src/lib/features/stages/document/editor/schema.ts — breakdown

Companion to [schema.ts](schema.ts). The ProseMirror schema for the document
editor — a direct projection of Omega's block model. It declares the block nodes
(paragraph, heading, code, divider, list, and a leaf placeholder), each carrying
the stable `blockId`/`rowId` ids, and the inline marks (basic formatting plus
typography).

## Imports

### Bring in ProseMirror's `Schema` constructor

```ts
import { Schema } from 'prosemirror-model';

```

The only dependency is `Schema` from `prosemirror-model`, which turns the
node/mark spec below into the concrete schema the editor state is built on. The
blank line separates the import from the exported declaration.

## The schema and its Omega block-model mapping

### Doc-comment mapping Omega blocks/marks to nodes, then open the `Schema`

```ts
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
```

The doc-comment is the contract: how each Omega block kind and mark projects onto
a ProseMirror node/mark, and why every node keeps `blockId`/`rowId` so the differ
can address change-set ops at stable ids. `export const schema = new Schema({`
opens the single exported schema; the `nodes` and `marks` maps follow.

## Text block nodes: doc, paragraph, heading

### The document root and the two inline-content text blocks

```ts
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
```

`doc` is the root, holding one or more `block` nodes. `paragraph` is the workhorse
text block: it carries `kind`/`subKind` attrs (defaulting to `text`/`body`)
alongside the id attrs, and its `toDOM` only emits `data-kind`/`data-subkind` when
they differ from those defaults, so a plain paragraph renders as a clean `<p>`.
`heading` adds a `level` attr, parses `h1`–`h6` into that level, and renders back
to the matching tag.

## Element block nodes: code_block and divider

### A text-only code block and a horizontal-rule atom

```ts
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
```

`code_block` holds plain `text*` with marks disabled; `code: true` and
`defining: true` make it a verbatim, structure-preserving block. It parses `<pre>`
with full whitespace and renders `<pre><code>`. `divider` is a selectable atom
(no content) with `kind: 'divider'`, parsing and rendering an `<hr>`.

## List nodes: list and list_item

### The flat list block and its level-carrying items

```ts
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
```

The list model is flat, mirroring Omega's `ListBlockData`: a `list` holds
`list_item+` siblings, and nesting is an attr rather than actual DOM nesting.
`list` carries `listType` (bullet/ordered) and an ordered `start`; its `toDOM`
tags `<ul>`/`<ol>`, sets `data-list-type`, and only emits a `counter-reset` style
when an ordered list starts somewhere other than 1. Each `list_item` carries its
own `level` and `checked` state, surfaced as `data-level` and (when checked)
`data-checked`.

## The leaf placeholder and the text node

### A read-only atom for not-yet-editable kinds, plus inline text; close `nodes`

```ts
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
```

`block_leaf` is the escape hatch for block kinds not yet editable inline (e.g.
image): a selectable atom that renders a non-editable `<div>` labelled by its
`label` (falling back to `kind`), while its real typed data lives in the snapshot
and the differ preserves it untouched — so the block round-trips even though the
node holds no content. `text` is the plain inline text node. The `},` closes the
`nodes` map.

## Basic formatting marks

### The six 1:1 Omega formatting marks (strong, em, underline, strike, code, link)

```ts
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
```

The `marks` map opens with the six marks that map 1:1 onto Omega's inline
formatting. `strong` and `em` each accept both HTML spellings (`strong`/`b`,
`em`/`i`). `underline`, `strike`, and `code` are straightforward tag pairs. `link`
is non-inclusive (typing past its end doesn't extend it).

**`link` validates its href in both directions** (catalog **S1**). Omega accepts any non-empty
href — no scheme check — so `javascript:…` can be stored and served back; this is the last line
of defence, not a second one. `parseDOM` validates because pasted HTML is untrusted input on the
way *in*, and `toDOM` validates because the document may already contain a bad value. A rejected
href renders as a plain `<span>`, so the link text survives and only the navigation is dropped.

## Typography marks: font, fg, bg

### Inline font family/size and foreground/background color; close `marks` and the schema

```ts
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
```

These three marks carry Omega's atom-level typography. `font` composes an optional
`family` and/or `size` into a single `style` string (emitting an empty attr object
when neither is set); `fg` and `bg` each carry one CSS color value, rendered as
`color` and `background-color` respectively.

Every value goes through `cssDeclaration`, which emits the declaration only if the value
validates (catalog **S2**). This is not belt-and-braces for fonts: Omega length-bounds
`family`/`size` but performs no charset check, so `Arial;background:url(…)` fits inside its
128-char limit. Colours *are* validated server-side, and `safeCssColor` mirrors that same rule so
the two agree. An invalid value is dropped rather than escaped — the span simply inherits. The trailing `}` and `});` close the
`marks` map and the `new Schema(...)` call.
