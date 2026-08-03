/**
 * SQL `LIKE` treats `%` and `_` as wildcards, so caller-supplied text used as a
 * substring filter has to be escaped or it silently stops being a substring
 * filter: searching for `50%` matches every row, and `report_final` also matches
 * `reportXfinal`.
 *
 * **This lives in `0-utils` rather than in each capability's persistence**, which
 * is the one place this codebase's "capabilities own their own storage" rule
 * gives way. The reason is history: Templates and General Files each grew a name
 * filter independently, and they disagreed — one escaped and one did not, so the
 * same query returned different results depending on which capability answered
 * it. Four copies of a four-line function is cheap; four copies that disagree is
 * a class of bug nobody goes looking for.
 *
 * Every call site must also declare the escape character, because SQLite has no
 * default one:
 *
 * ```sql
 * WHERE name LIKE ? ESCAPE '\'
 * ```
 */
export const LIKE_ESCAPE_CHARACTER = "\\";

/**
 * `\` is replaced first. Doing it later would escape the backslashes this
 * function itself just added, turning `50%` into `50\\%` — a literal backslash
 * followed by a live wildcard.
 */
export const escapeLikeTerm = (term: string): string =>
  term.replace(/[\\%_]/g, (character) => `\\${character}`);
