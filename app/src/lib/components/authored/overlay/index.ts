/**
 * Things that appear over what you were already looking at.
 *
 * A third family alongside `drag/`, and for the same kind of reason: an overlay
 * belongs to neither of the other two vocabularies. The formula modal is opened
 * from a 300px inspector *and* from a cell out on the plane, and it is the same
 * modal both times — so it cannot be a panel shape and it cannot be a screen
 * shape. What defines it is that it is on top and the thing underneath waits.
 *
 * **Two shapes, and they are genuinely different.** One inserts into what you
 * are already writing and one takes the screen away from you. `=` in a formula
 * and `@` for a variable are the first; building the formula and defining the
 * variable are the second. Collapsing them into a single "overlay" component
 * with a `mode` prop was rejected — a menu that never closes the page behind it
 * and a dialog that traps focus have no behaviour in common, only a z-index.
 *
 * **Both are the registry underneath**: `command` inside `popover` for the menu,
 * `dialog` for the modal. What this family adds is the vocabulary — the width,
 * the ranking rule, the gutter, and the answer to what happens to unfinished
 * work when the thing closes.
 *
 * **There is no `OverlayField`, on purpose.** A modal's body is a form and
 * `unique-components/panel` already is one: `PanelFields`, `PanelField`,
 * `PanelEditableText`, `PanelSelect` and `PanelCode` cover a formula builder and
 * a variable definition between them, and `PanelCode` in particular exists for
 * exactly the expression a formula modal is about. A parallel set of fields
 * would be two places to change a density decision, and the second one would
 * drift. `OverlayModal` is built for that reuse — its gutter is the panel's
 * gutter and its body adds no horizontal padding of its own, so a `PanelFields`
 * block dropped in lines up with the title above it.
 */
export { default as OverlayInsertMenu } from "$authored-components/overlay/overlay-insert-menu.svelte";
export { default as OverlayModal } from "$authored-components/overlay/overlay-modal.svelte";

export type { InsertEntry } from "$authored-components/overlay/overlay-insert-menu.svelte";
