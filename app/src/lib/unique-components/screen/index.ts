/**
 * The workspace vocabulary: the shapes the centre of a screen is built from.
 *
 * A companion to `unique-components/panel`, and a separate family because a
 * workspace is not a panel. A panel is 300px and vertical; a workspace is the
 * generous plane, and its recurring shapes are a header, a filter row, a table
 * or a grid of cards. Eight of the eleven screens are exactly that sequence.
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
