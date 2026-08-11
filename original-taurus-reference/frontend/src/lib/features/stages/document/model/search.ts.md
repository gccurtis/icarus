# search.ts

Document search for the Find panel — a pure read of the ProseMirror document. Lifted out of
`runtime.ts` during workstream C's actions extraction, where it had been a private method with no
test coverage at all.

## Matching is per block, not per document

```ts
doc.forEach((node, offset, index) => {
  const text = node.textContent;
  …
  const from = offset + 1 + match.index;
```

The regex runs against each top-level block's `textContent` separately, so a match can never span
a block boundary and every result carries the block it belongs to. The `+1` is the block node's
own opening token — a block's text starts one position after the node itself, and getting this
wrong shifts every selection by one character per block.

## patternFor — three options, one expression

```ts
const source = options.useRegex ? query : escaped;
const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
try { return new RegExp(pattern, options.matchCase ? 'g' : 'gi'); } catch { return null; }
```

A literal query is escaped; `useRegex` passes it through verbatim. The whole-word wrapper uses a
**non-capturing** group so an alternation like `cat|dog` binds correctly rather than anchoring only
its first branch.

The `try/catch` is not defensive padding. The Find field re-searches on every keystroke, so a
user typing `a(b)` sends the invalid `a(` first. Returning `null` (and then `[]`) shows no results
for that instant instead of throwing.

## The zero-length guard

```ts
if (match[0].length === 0) {
  expression.lastIndex += 1;
  continue;
}
```

A pattern that can match nothing — `a*`, `\b`, `x?` — never advances `lastIndex` on its own, so a
global `exec` loop over it spins forever. Stepping past by hand is what makes an empty match
terminate. `search.test.ts` pins this with `a*`; without the guard that test hangs rather than
fails, which is exactly why it is worth having.

## Previews

`CONTEXT_BEFORE`/`CONTEXT_AFTER` (36/52 characters) bracket the match, whitespace is collapsed, and
an ellipsis is added **only on the side that was actually cut**. A short block previews as its whole
text with no leading `…` suggesting hidden content.
