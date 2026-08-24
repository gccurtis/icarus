/**
 * The workspace vocabulary: the shapes the centre of a screen is built from.
 *
 * A companion to `unique-components/panel`, and a separate family because a
 * workspace is not a panel. A panel is 300px and vertical; a workspace is the
 * generous plane, and its recurring shapes are a header, a filter row, a table
 * or a grid of cards. Most of the nine screens are exactly that sequence.
 *
 * Like the panel vocabulary, these know only their props. What goes in them is
 * the view's business.
 */
export { default as ScreenSurface } from "./screen-surface.svelte";
export { default as ScreenHeader } from "./screen-header.svelte";
export { default as ScreenAction } from "./screen-action.svelte";
export { default as ScreenGroup } from "./screen-group.svelte";
export { default as ScreenNote } from "./screen-note.svelte";
export { default as ScreenBar } from "./screen-bar.svelte";
export { default as ScreenFilters } from "./screen-filters.svelte";
export { default as ScreenTable } from "./screen-table.svelte";
export { default as ScreenHeadCell } from "./screen-head-cell.svelte";
export { default as ScreenRow } from "./screen-row.svelte";
export { default as ScreenCell } from "./screen-cell.svelte";
export { default as ScreenCards } from "./screen-cards.svelte";
export { default as ScreenCard } from "./screen-card.svelte";
export { default as ScreenShelf } from "./screen-shelf.svelte";
export { default as ScreenShelfItem } from "./screen-shelf-item.svelte";
export { default as ScreenThumb } from "./screen-thumb.svelte";
export { default as ScreenPlaceholder } from "./screen-placeholder.svelte";
export { default as ScreenBanner } from "./screen-banner.svelte";
export { default as ScreenStats } from "./screen-stats.svelte";
export { default as ScreenStat } from "./screen-stat.svelte";
export { default as ScreenStrip } from "./screen-strip.svelte";
export { default as ScreenEmpty } from "./screen-empty.svelte";

/**
 * Something offered for a decision, with the decision on it.
 *
 * `ScreenCard` becomes a button the moment it is selectable, and a button cannot
 * hold three more buttons — so Accept, Edit and Dismiss on a proposed finding had
 * nowhere to go. Selecting a proposal and deciding it are two acts, and both have
 * to be reachable.
 */
export { default as ScreenDecision } from "./screen-decision.svelte";

/**
 * Entries that are neither records nor tiles.
 *
 * A mentions feed, an activity feed, a list of research turns, a persona's work.
 * Five workspaces show a stack of entries, and without a word for the shape each
 * one is raw `<button>` elements and its own hover classes.
 *
 * Not `ScreenTable`: a table is columnar and its cells align down the page. A
 * feed entry is a paragraph — an actor, what they did, where, and enough of what
 * they said to decide — and it does not align with the one above it. Not
 * `ScreenCard`, which is a tile sized by its picture. Not `PanelRow`, which is
 * 300px and truncates both its lines; on the plane an excerpt has room to be two
 * lines and should be.
 */
export { default as ScreenList } from "./screen-list.svelte";
export { default as ScreenItem } from "./screen-item.svelte";

/**
 * The plane a thing sits ON, and the two things that sit on it.
 *
 * A document floats: gutters on all four sides and between pages, all of it
 * canvas rather than more paper, because a document sits on a surface the way a
 * slide sits on its pasteboard. `ScreenSurface` cannot be it — that is the
 * workspace's own padding and scroll for ordinary content, where a canvas is a
 * darker ground whose job is to make what is on it read as an object.
 *
 * A canvas does not own zoom. Zoom is a gesture on the work surface and each
 * surface decides whether it zooms at all; a `zoom` prop here would decide that
 * for all three.
 *
 * `ScreenPage` is a real page at a real size, where `ScreenThumb` is an abstract
 * placeholder at an aspect ratio. Its margins are a dashed guide on every side —
 * there is no ruler, so the margin is visible where the writing is. It takes a
 * paper size, not a pixel width: 816px is US Letter at 96dpi and no caller should
 * have to know that.
 *
 * `ScreenSlide` is not a page. A page is a flow of content down a sheet; a slide
 * is a fixed stage with objects placed on it by coordinate — as percentages of
 * the stage, or nothing survives being resized. Speaker notes are not on it: they
 * belong to the inspector, because a tray under a 16:9 slide costs exactly the
 * height that zooming needs.
 */
export { default as ScreenCanvas } from "./screen-canvas.svelte";
export { default as ScreenPage } from "./screen-page.svelte";
export { default as ScreenSlide } from "./screen-slide.svelte";

/**
 * A grid, two sets related by an operator, and where a message is written.
 *
 * `ScreenGrid` is not `ScreenTable`: a table has named columns carrying meaning
 * and rows that are records, and a grid's columns are *addresses*. A table row
 * cannot be addressed and a grid cell must be — its identity is A1. It is one
 * grid and not a workbook: no sheet tabs, no frozen-column rule, a tab is a
 * spreadsheet. There is no formula bar and no name box anywhere near it, because
 * the inspector already names the cell you are on and holds the formula in it.
 *
 * `ScreenSplit` exists for its minus. Include minus Take out, side by side, and
 * no nested expression tree — the operator between the halves is what makes that
 * readable without one, and it has to stay between them when they collapse to one
 * column.
 *
 * `ScreenComposer` is not the Copilot's bar, which lives in the status bar and is
 * disabled on Research precisely because that screen already has one of these. It
 * carries what the message will be able to see, because a request states its
 * scope where the request is written.
 */
export { default as ScreenGrid } from "./screen-grid.svelte";
export { default as ScreenGridCell } from "./screen-grid-cell.svelte";
export { default as ScreenSplit } from "./screen-split.svelte";
export { default as ScreenComposer } from "./screen-composer.svelte";
