# Inspector

The lens: what is this selected thing?

It owns view resolution and nothing else. What is under inspection belongs to the
workbench, so switching tabs restores each tab's inspection without the inspector
doing anything.

## It holds no state

Like the activities projection, a plain `.ts` reading through the workbench. The
same rule applies: if this ever needs `$state`, something belongs elsewhere.

## Inspection changes only on an explicit call

Nothing here listens to focus or selection events. That is what lets an
inspection hold while the editor is blurred — click into the inspector, the caret
collapses, and the panel keeps showing what the user came to work on. An
inspection derived from focus would empty the panel the user is reaching for.

## `view` is undefined when nothing is inspected

That is the panel's cue to render the nothing-inspected view. The alternative — a
placeholder node standing in for absence — would mean every view defending
against a node that isn't really there.

`current` is the innermost node. The ancestry above it is what a breadcrumb
walks, so the step outward stays available without being imposed.

## The registry is total

`Record<InspectionNode["kind"], …>` rather than a partial map: adding a member to
the union fails to compile until it has a view, so an inspection can never reach
the panel with nothing to render. Frozen, for the same reason the activity
registry is.
