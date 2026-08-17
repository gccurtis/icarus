import { v, type Infer } from "convex/values";

/**
 * What a project holds and works over — the kinds a scope can select and the
 * kinds retrieval can index.
 *
 * **An open string, not a closed union.** A connector is a provider *and* a
 * version rather than one thing, and integrations keep arriving; a closed union
 * cannot express a space that grows without making every new integration a
 * schema change. Base kinds today:
 *
 * ```text
 * document  slides  spreadsheet  external  finding  connector  template
 * ```
 *
 * with subkinds after `::` — `connector::google-docs::v1`, `external::web-page`.
 *
 * The cost is honest: nothing validates the string, so a typo in a kind is a
 * silent miss rather than a rejected write. That is the trade for a set of kinds
 * that grows with integrations.
 *
 * **A finding is one of them.** It is durable project content with a body, it is
 * cited, and "answer from our findings only" is an obvious thing to want to scope
 * to. A question and a hypothesis are the project's *open threads* rather than
 * its material, so neither is one: retrieving over a question would return the
 * asking rather than an answer.
 *
 * **Messages are outside it deliberately.** A conversation is working material,
 * and a message worth keeping is promoted to a finding — the promotion is the
 * editorial act worth indexing, not the raw transcript.
 *
 * No list of base kinds is exported. Naming them in an array invites reading an
 * open space as closed, which is the one thing the open string exists to avoid.
 */
export const resourceKindValidator = v.string();

export type ResourceKind = Infer<typeof resourceKindValidator>;

/**
 * A specific resource, with its kind beside its id.
 *
 * The kind is stored rather than looked up because a set has to be resolvable
 * without probing every table to find out what each id is — and because the kind,
 * subkind included, should be readable without parsing an id.
 */
export const resourceRefValidator = v.object({
  kind: resourceKindValidator,
  id: v.string()
});

export type ResourceRef = Infer<typeof resourceRefValidator>;

/** The delimiter between a kind and its subkinds. */
const SUBKIND = "::";

/**
 * Whether `kind` falls under `pattern` — segment-wise prefix matching, to any
 * depth.
 *
 * `connector` matches `connector::google-docs::v1`, and `connector::google-docs`
 * matches every version of it. One selector covers a whole provider without
 * enumerating anything, which is the entire reason the delimiter exists rather
 * than being decoration.
 *
 * **Segments, not raw string prefixes.** `connector::google` must not match
 * `connector::googlesheets`, and a `startsWith` would say it does. Comparing
 * segments also means arbitrary depth costs nothing — the comparison never knows
 * how many levels there are, so a subkind can have a subkind.
 */
export const kindMatches = (pattern: ResourceKind, kind: ResourceKind): boolean => {
  const patternSegments = pattern.split(SUBKIND);
  const kindSegments = kind.split(SUBKIND);

  return (
    patternSegments.length <= kindSegments.length &&
    patternSegments.every((segment, index) => segment === kindSegments[index])
  );
};
