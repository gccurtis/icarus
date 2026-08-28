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
export { default as Panel } from "$authored-components/panel/panel.svelte";
export { default as PanelSection } from "$authored-components/panel/panel-section.svelte";
export { default as PanelRow } from "$authored-components/panel/panel-row.svelte";
export { default as PanelFields } from "$authored-components/panel/panel-fields.svelte";
export { default as PanelField } from "$authored-components/panel/panel-field.svelte";
export { default as PanelChip } from "$authored-components/panel/panel-chip.svelte";
export { default as PanelNote } from "$authored-components/panel/panel-note.svelte";
export { default as PanelButton } from "$authored-components/panel/panel-button.svelte";
export { default as PanelSearch } from "$authored-components/panel/panel-search.svelte";
export { default as PanelCrumbs } from "$authored-components/panel/panel-crumbs.svelte";
export { default as PanelQuote } from "$authored-components/panel/panel-quote.svelte";
export { default as PanelActions } from "$authored-components/panel/panel-actions.svelte";
export { default as PanelLink } from "$authored-components/panel/panel-link.svelte";
export { default as PanelToggle } from "$authored-components/panel/panel-toggle.svelte";
export { default as PanelCode } from "$authored-components/panel/panel-code.svelte";

/**
 * The words for things a panel identifies by something other than a string.
 *
 * An actor is identified by a face, and a slide by its picture — neither has a
 * title to put in a row. Without a word for either, a persona screen hand-rolls
 * an initials circle and a deck inspector pulls the *workspace* thumbnail into a
 * 300px column, re-declaring the panel's width in a view file.
 */
export { default as PanelActor } from "$authored-components/panel/panel-actor.svelte";
export { default as PanelThumbs } from "$authored-components/panel/panel-thumbs.svelte";
export { default as PanelThumb } from "$authored-components/panel/panel-thumb.svelte";

/**
 * One of a small set, shown rather than hidden. Separate from `PanelSelect`
 * because the set being visible is the whole point: these sit above the list
 * they narrow, as a region of the layout rather than behind a trigger.
 */
export { default as PanelChoice } from "$authored-components/panel/panel-choice.svelte";

/**
 * The editing vocabulary: the three ways a value is changed, and the one
 * structure whose rows the reader creates.
 *
 * Split out because everything above displays what the model owns and these
 * hand it back. They are the same three kinds a form has — free text, one of a
 * set, on or off — which is not a coincidence: a panel is where a form goes when
 * the thing being edited is already on the screen beside it.
 */
export { default as PanelEditableText } from "$authored-components/panel/panel-editable-text.svelte";
export { default as PanelSelect } from "$authored-components/panel/panel-select.svelte";
export { default as PanelPairs } from "$authored-components/panel/panel-pairs.svelte";
export { default as PanelPair } from "$authored-components/panel/panel-pair.svelte";

/**
 * Three the shapes above cannot express.
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
export { default as PanelInput } from "$authored-components/panel/panel-input.svelte";
export { default as PanelMarks } from "$authored-components/panel/panel-marks.svelte";
export { default as PanelColor } from "$authored-components/panel/panel-color.svelte";

/**
 * What a panel says while it is finding out, and what it says about work that
 * is under way. Both are states a panel is in rather than things it holds,
 * which is why neither is a section.
 */
export { default as PanelProgress } from "$authored-components/panel/panel-progress.svelte";
export { default as PanelSkeleton } from "$authored-components/panel/panel-skeleton.svelte";

/** Several actors at once, as faces. `PanelActor` is one of them, named. */
export { default as PanelFaces } from "$authored-components/panel/panel-faces.svelte";

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
export { default as PanelTable } from "$authored-components/panel/panel-table.svelte";
export { default as PanelCards } from "$authored-components/panel/panel-cards.svelte";
export { default as PanelSentence } from "$authored-components/panel/panel-sentence.svelte";

/**
 * A colour, shown rather than chosen.
 *
 * A deck theme lists its palette; a chart lists which colour is which series.
 * Without a word for it, three panels draw the same shape with a local `<style>`
 * block and a `.chip` div — at three sizes, in three layouts.
 *
 * Not `PanelColor`, which is a `radiogroup` of round targets: some of these are
 * not selectable at all, and the ones that are open a lens rather than setting a
 * value. They are drawn square for that reason, so the two never read alike.
 *
 * A swatch carries its name as text. A row of colours with no words is unusable
 * to anyone who cannot see them and unreadable to everyone else.
 */
export { default as PanelSwatches } from "$authored-components/panel/panel-swatches.svelte";
export { default as PanelSwatch } from "$authored-components/panel/panel-swatch.svelte";

/**
 * A proportion that is a fact, and a record read as figures.
 *
 * `PanelMeter` is not `PanelProgress`, and the difference is a claim rather than
 * a drawing: progress is `role="progressbar"` and its bar promises it is heading
 * to the total. A lattice that has indexed 88 of 211 resources is not on its way
 * to 211 — it may sit there forever. This is `role="meter"`, has no indeterminate
 * form, and draws its track so the total is visible rather than implied.
 *
 * `PanelStats` is not `PanelFields`: a field is a labelled value and reads left
 * to right; a record is a row of figures and reads across, which is why
 * `41 tasks · 2 running · 128 findings` written as a sentence in a field
 * disappears into the list around it. Not `ScreenStats` either — that carries a
 * frame sized for the plane, and at 84px its one-line form is unreachable.
 */
export { default as PanelMeter } from "$authored-components/panel/panel-meter.svelte";
export { default as PanelStats } from "$authored-components/panel/panel-stats.svelte";
export { default as PanelStat } from "$authored-components/panel/panel-stat.svelte";

/**
 * Things in an order, and things in a shape.
 *
 * `PanelTimeline` is what happened: a rail is what makes "and then" visible, and
 * a plain list of rows read out of order reads the same as one read in order. It
 * takes a `size`, so a workspace uses this rather than a second way to draw one
 * feed.
 *
 * `PanelSteps` is what is *meant* to happen. Drawn like a timeline it reads like
 * one, and then a reader cannot tell a step that failed from an event that
 * occurred — so it has no rail, and the five states are the component: each a
 * fixed word, a fixed shape and a role, decided once instead of per surface.
 *
 * `PanelTree` collapses, which is the whole reason it is not `PanelRow` with
 * `depth`: depth says where a row sits, but a tree of forty nodes is forty rows
 * whatever you were looking for. A branch with nothing under it draws no twisty,
 * because an empty disclosure is a control that lies.
 *
 * `PanelDiff` marks what changed. Two labelled values invite a reader to compare
 * them character by character, which is exactly the work this should be doing for
 * them; the marks are `<del>` and `<ins>` with signs on each side, so the change
 * survives being read without colour.
 */
export { default as PanelTimeline } from "$authored-components/panel/panel-timeline.svelte";
export { default as PanelSteps } from "$authored-components/panel/panel-steps.svelte";
export { default as PanelTree } from "$authored-components/panel/panel-tree.svelte";
export { default as PanelBranch } from "$authored-components/panel/panel-branch.svelte";
export { default as PanelDiff } from "$authored-components/panel/panel-diff.svelte";

/**
 * What a panel says when it holds nothing, and when something is wrong.
 *
 * Both have a screen-scale counterpart and neither is it. `ScreenEmpty` is
 * centred, `flex-1` and `max-w-sm`; every one of those would have to be
 * overridden into its opposite at 276px. What survives the resizing is its one
 * good distinction — a list never used and a filter that hid everything need
 * different sentences and different ways out — and here they differ visually too:
 * `nothing-yet` outlines the shape of the missing thing, `no-matches` does not,
 * because that list is full and outlining it would be a lie.
 *
 * `PanelBanner` is not `PanelNote tone="gap"`: a gap note says the model cannot
 * store this, and a banner says something is wrong *now*. It is the one place a
 * panel may reach for the danger role, so it must always carry an action or a
 * reason — the type enforces it, and a banner that only worries does not compile.
 */
export { default as PanelEmpty } from "$authored-components/panel/panel-empty.svelte";
export { default as PanelBanner } from "$authored-components/panel/panel-banner.svelte";

/**
 * A shortcut, and the three values a field could not hold honestly.
 *
 * `PanelKeys` exists because of a design law: shortcuts accelerate visible paths
 * and never replace them, so a shortcut nobody can see is the failure that law
 * names. It takes the chord as parts rather than a string — a caller writing
 * "Cmd+K" has already made the platform decision, and made it wrong on Linux.
 *
 * The other three are all the same argument against `PanelEditableText`: text
 * has no floor, no ceiling, no step and no unit, so every caller re-implements
 * four things and one of them gets it wrong. A date typed as text is a date in
 * somebody's local format, and the difference between 03/04 and 04/03 is a
 * filing deadline. `PanelRange` is not `PanelNumber` because a number is exact
 * and a range is proportional — what a slider says that a field cannot is where
 * the value sits between its ends, which is what you need when it has no unit.
 */
export { default as PanelKeys } from "$authored-components/panel/panel-keys.svelte";
export { default as PanelDate } from "$authored-components/panel/panel-date.svelte";
export { default as PanelNumber } from "$authored-components/panel/panel-number.svelte";
export { default as PanelRange } from "$authored-components/panel/panel-range.svelte";
