/**
 * The panel vocabulary: the shapes every context view and inspector lens is
 * built from.
 *
 * There are roughly two hundred panels specified, and about seven shapes among
 * them. Naming the seven is what makes the two hundred cheap to write and, more
 * to the point, cheap to change: density, disclosure and hover behaviour are
 * decided here rather than re-decided in every file that draws a list.
 *
 * They are unique components rather than views — each knows only its props, none
 * reads the client model. What goes in them is the view's business.
 *
 * Everything with a control in it is `simple-components` underneath. A button, a
 * switch, a text field and a listbox each carry behaviour that is invisible
 * until it is missing — a press state, a focus ring, typeahead, the disabled
 * handling — and redrawing them at panel scale loses all of it silently. What
 * belongs here is the panel's vocabulary over the top: the tones, the labels,
 * the widths.
 */
export { default as Panel } from "./panel.svelte";
export { default as PanelSection } from "./panel-section.svelte";
export { default as PanelRow } from "./panel-row.svelte";
export { default as PanelFields } from "./panel-fields.svelte";
export { default as PanelField } from "./panel-field.svelte";
export { default as PanelChip } from "./panel-chip.svelte";
export { default as PanelNote } from "./panel-note.svelte";
export { default as PanelButton } from "./panel-button.svelte";
export { default as PanelSearch } from "./panel-search.svelte";
export { default as PanelCrumbs } from "./panel-crumbs.svelte";
export { default as PanelQuote } from "./panel-quote.svelte";
export { default as PanelActions } from "./panel-actions.svelte";
export { default as PanelLink } from "./panel-link.svelte";
export { default as PanelToggle } from "./panel-toggle.svelte";
export { default as PanelCode } from "./panel-code.svelte";

/**
 * The words for things a panel identifies by something other than a string.
 *
 * An actor is identified by a face, and a slide by its picture — neither has a
 * title to put in a row. Both were being faked before they were named: a persona
 * screen hand-rolled an initials circle, and a deck inspector pulled the
 * *workspace* thumbnail into a 300px column and re-declared its width in a view
 * file.
 */
export { default as PanelActor } from "./panel-actor.svelte";
export { default as PanelThumbs } from "./panel-thumbs.svelte";
export { default as PanelThumb } from "./panel-thumb.svelte";

/**
 * One of a small set, shown rather than hidden. Separate from `PanelSelect`
 * because the set being visible is the whole point: these sit above the list
 * they narrow, as a region of the layout rather than behind a trigger.
 */
export { default as PanelChoice } from "./panel-choice.svelte";

/**
 * The editing vocabulary: the three ways a value is changed, and the one
 * structure whose rows the reader creates.
 *
 * Split out because everything above displays what the model owns and these
 * hand it back. They are the same three kinds a form has — free text, one of a
 * set, on or off — which is not a coincidence: a panel is where a form goes when
 * the thing being edited is already on the screen beside it.
 */
export { default as PanelEditableText } from "./panel-editable-text.svelte";
export { default as PanelSelect } from "./panel-select.svelte";
export { default as PanelPairs } from "./panel-pairs.svelte";
export { default as PanelPair } from "./panel-pair.svelte";

/**
 * The three the specifications asked for that the first pass did not have.
 *
 * `PanelInput` is the field the other two leave out: `PanelSearch` contains what
 * it filters and `PanelEditableText` edits a value already on screen, and a
 * replacement string is neither — it is text the panel will use against content
 * it does not display.
 *
 * `PanelMarks` is the set `PanelChoice` cannot express. A choice picks exactly
 * one, which would make bold and italic alternatives; these are independent, and
 * the third state — some of the selection carries it — is drawn rather than
 * resolved.
 *
 * `PanelColor` is a choice whose options are swatches. Not a picker: a fill comes
 * from a theme or a style set, so the set is small and named, and a free picker
 * would let an author put a colour in a deck its theme has never heard of.
 */
export { default as PanelInput } from "./panel-input.svelte";
export { default as PanelMarks } from "./panel-marks.svelte";
export { default as PanelColor } from "./panel-color.svelte";

/**
 * What a panel says while it is finding out, and what it says about work that
 * is under way. Both are states a panel is in rather than things it holds,
 * which is why neither is a section.
 */
export { default as PanelProgress } from "./panel-progress.svelte";
export { default as PanelSkeleton } from "./panel-skeleton.svelte";

/** Several actors at once, as faces. `PanelActor` is one of them, named. */
export { default as PanelFaces } from "./panel-faces.svelte";

/**
 * Three shapes a flank has to hold that are not lists of one thing.
 *
 * `PanelTable` is a bounded prefix of a tabular value with its total under it —
 * a variable holding 4,182 rows still has to show what it holds, and three rows
 * and a count answers that where a scrollable grid in a 300px column does not.
 *
 * `PanelCards` is `PanelChoice` for a set chosen by its picture rather than its
 * name: a chart kind, a slide layout, a page orientation. Two or three across and
 * never more, because a 276px body divided four ways is not a picture of
 * anything.
 *
 * `PanelSentence` is one rule read as prose, with its clauses still selectable.
 * Three surfaces draw the same Automation — the library, the lens and the editor
 * heading — and three hand-written renderings is three ways to read one rule.
 */
export { default as PanelTable } from "./panel-table.svelte";
export { default as PanelCards } from "./panel-cards.svelte";
export { default as PanelSentence } from "./panel-sentence.svelte";
