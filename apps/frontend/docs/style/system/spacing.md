# Spacing

> **Concrete tokens.** Exact values, identical in every theme. The stylesheet
> declares these once; nothing may hard-code them at a call site.

Every gap, pad, and offset in the system comes from here. How these values
arrange into a shell is the shell's own business, not this module's.

One file rather than a theory/component pair: the stance is three sentences, and
splitting it would produce one real document and one stub.

## Scale

The spacing scale is **4px based, with 8px as the primary step**. Every value is
a multiple of 4px, and nothing lands off-grid.

| | Value | Use |
| --- | --- | --- |
| Base unit | 4px | The smallest legal increment |
| Primary step | 8px | The default gap between related elements |
| Panel padding | 12–16px | Internal padding for context, inspector, drawer, and cards |
| Work surface | 24px and up | The center gets more air than the chrome around it |

That last row is the only opinion in this document, and it is
[design law 1](../mandate.md#design-laws) expressed as a number: when space runs
short it comes out of chrome, never out of the work surface.

The base unit is the one declared token — `--spacing: 0.25rem`. Every step is a
multiple of it, so `p-2` is 8px and `p-6` is 24px. It is declared rather than
inherited from the framework's default, so the grid is a decision this system
made and not one it happened to receive.

## No zone tokens

This module used to declare `--spacing-topbar`, `--spacing-tabstrip`,
`--spacing-rail`, `--spacing-status`, `--spacing-composer`, and three
default/min/max triples for context, inspector, and drawer.

Every one of them named a **zone of one application** rather than a dimension of
the design system, which contradicts the rule this system opens with:

> Nothing here names an application, a feature, or a screen. The system is
> expressed in design dimensions so it stays true regardless of what is built on
> top of it. — [README](../README.md)

They have been removed. The tell that the axis was wrong: `--spacing-context`
and `--spacing-inspector` carried identical triples, and the file argued for
keeping the duplication so a future divergence would be deliberate. Two names
for one dimension is what naming-by-zone produces.

**Where the numbers go instead.** Shell geometry belongs to the shell. A zone's
height, its width, and the range a resize handle enforces are properties of that
zone, so they belong wherever the zone is defined — expressed in terms of this
scale, but named by the application rather than by the system.

No such document exists yet. The shell has not been designed, and the layout
module that used to specify it has been removed, so nothing currently claims
these numbers. That is the correct state: the system should not hold dimensions
for a shell that has not been built.
