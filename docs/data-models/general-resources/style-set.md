# Style set

Named text styles — "Heading 1", "Body", "Quote" — defined once per resource and
referenced by the blocks that use them.

```ts
interface StyleSet {
  styles: Record<string, TextStyle>;   // keyed: "heading1", "body", "quote"
  defaultKey: string;                  // what unstyled text uses
}

interface TextStyle {
  name: string;                        // "Heading 1" — what a person picks from a menu
  fontFamily?: string;
  fontSize?: number;                   // points
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  lineHeight?: number;                 // multiplier
  spaceBefore?: number;                // points
  spaceAfter?: number;
  align?: "start" | "center" | "end" | "justify";
  indent?: number;                     // points
}
```

## Named styles, not copied formatting

A [text block](../content/content-block.md#text-blocks) carries `style?: string`
— a key into its resource's style set — not a copy of the formatting.

This is what makes a document behave the way knowledge workers expect. Changing
"Heading 1" restyles every heading at once. Applying "Body" to a paragraph makes
it match the others by definition rather than by someone having got the numbers
right. An outline can be derived by looking at which style a block uses.

Copied formatting cannot do any of that. A document where each heading
independently holds `fontSize: 18` has no headings in it — it has paragraphs that
currently look alike, and they drift the first time someone edits one.

## Local overrides still work

A block's own `format` overrides its style. Bolding one word, centring one
paragraph, colouring one line — none of that should require defining a style.

The precedence is: style set default, then the block's named style, then the
block's `format`, then [marks](../content/content-block.md#marks-index-the-display-string)
on a range within it. Each step narrows, and each is stored separately so
removing an override reveals what was underneath rather than leaving a hole.

## Keys and names are separate

`styles` is keyed by a stable identifier; each style carries its own display
`name`. Renaming "Heading 1" to "Section Title" is then an edit to one field
rather than a rewrite of every block referencing it.

## Embedded per resource

A style set lives inside the resource that uses it, like a
[deck's theme](slides.md#themes-and-layouts). A document should not change
appearance because something outside it was edited, and a shared style set would
mean exactly that.

The cost is that starting a new document from an existing one's look is a copy.
That is what [templates](../special-resources/template.md) are for.

## `defaultKey`

Which style applies to a block that names none. Required, so there is always an
answer — a document with no default would render unstyled text differently
depending on which renderer was asked.

## Related

[document](document.md) · [slides](slides.md) ·
[content block](../content/content-block.md#text-blocks)
