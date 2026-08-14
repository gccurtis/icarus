# Preferences

What the shell remembers between visits: panel widths, and whether each panel is
collapsed.

The lighter of the two stateful objects. Tab state dies with the tab; this
outlives every tab, which is the test for what belongs here. A user who sized the
inspector once expects it sized in the next tab too — the alternative makes
panels jump on every switch.

## Values, not bounds

The minimum width, the maximum, and the width below which a drag collapses
rather than clamps are **not here**. They belong to the panel component that
enforces the drag, because that is the thing which knows a gesture overshot.
This object stores what the panel currently is, and has no logic at all.

Before this move those numbers lived in three places at once — the panel
objects, an unexported `INITIAL`, and CSS custom properties — with two different
`COLLAPSE_AT` constants of different values. One home per dimension is the
point of the split.

`contextWidth` is the **content portion only**. The context panel's icon rail is
structural and never resizes, so the panel's total is this plus the rail.
Storing the total would oblige every reader to remember to subtract 44.

## `set`, not `remember`

The previous name argued these were observations of what a user did rather than
settings they chose, and named the mutator accordingly. That distinction stops
holding the moment theme and the semantic-set choice land here — those are
settings in the ordinary sense — and the method was always a plain mutation.

## Defaults are frozen

`$state(DEFAULTS)` instead of `$state({ ...DEFAULTS })` would wrap the module
constant itself in the reactive proxy, and a deep write would then reach every
later reader. That is a leak which typechecks, passes review, and behaves
perfectly with one user.

Freezing turns it into an immediate throw at the write. The spread in the
constructor is load-bearing and easy to lose in a refactor; the freeze is what
makes losing it loud.

## Persistence

Read once at construction from [`storage`](../storage/storage.md), written on
every `set`. A stored document is merged over the defaults rather than replacing
them, so a field added later has a value on the first load after it ships.
