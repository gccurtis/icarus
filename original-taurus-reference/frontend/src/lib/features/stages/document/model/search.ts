import type { Node as PmNode } from 'prosemirror-model';
import { nodeKind } from '../editor/bridge';
import type { SearchOptions, SearchResult } from '../editor/session';

/**
 * DOCUMENT SEARCH — a pure read of the ProseMirror document, for the Find panel.
 *
 * Matching is per top-level block rather than across the whole document, so a
 * match can never span a block boundary and every result carries the block it
 * belongs to. Positions are absolute document positions, ready to be turned into
 * a `TextSelection` by the caller.
 */

/** How much text to show around a match in its preview. */
const CONTEXT_BEFORE = 36;
const CONTEXT_AFTER = 52;

/** Build the regular expression a query + options describe, or null if invalid. */
function patternFor(query: string, options: SearchOptions): RegExp | null {
  // A literal query is escaped; `useRegex` passes it through verbatim, which is
  // why this can fail — a half-typed pattern like `foo(` is a syntax error, and
  // the Find panel should show no results rather than throw on every keystroke.
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = options.useRegex ? query : escaped;
  const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(pattern, options.matchCase ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/** Every in-block match for `query`, in document order. */
export function findText(doc: PmNode, query: string, options: SearchOptions): SearchResult[] {
  if (!query) return [];
  const expression = patternFor(query, options);
  if (!expression) return [];
  const results: SearchResult[] = [];
  doc.forEach((node, offset, index) => {
    const text = node.textContent;
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text))) {
      // A pattern that can match nothing (`a*`, `\b`) would never advance
      // `lastIndex` on its own — step past it by hand or this loops forever.
      if (match[0].length === 0) {
        expression.lastIndex += 1;
        continue;
      }
      // +1 for the block node's own opening token: a block's text starts one
      // position after the node itself.
      const from = offset + 1 + match.index;
      const contextStart = Math.max(0, match.index - CONTEXT_BEFORE);
      const contextEnd = Math.min(text.length, match.index + match[0].length + CONTEXT_AFTER);
      const excerpt = text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim();
      results.push({
        id: `${offset}:${match.index}:${match[0].length}`,
        blockId: (node.attrs.blockId as string | null) ?? null,
        block: index + 1,
        kind: nodeKind(node),
        from,
        to: from + match[0].length,
        match: match[0],
        preview: `${contextStart ? '…' : ''}${excerpt}${contextEnd < text.length ? '…' : ''}`
      });
    }
  });
  return results;
}
