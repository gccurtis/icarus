# Spacing

> **Concrete tokens.** Exact values. The stylesheet declares these once;
> nothing may hard-code them at a call site.

Every gap, pad, offset, and structural dimension in the system comes from here.
How these values arrange into a shell is [Layout](../component/layout.md).

## Scale

The spacing scale is **4px based, with 8px as the primary step**. Every value is
a multiple of 4px.

| | Value | Use |
| --- | --- | --- |
| Base unit | 4px | The smallest legal increment. Nothing lands off-grid. |
| Primary step | 8px | The default gap between related elements. |
| Panel padding | 12–16px | Internal padding for context, inspector, drawer, and cards. |
| Work surface | 24px and up | The center gets more air than the chrome around it. |

## Shell geometry

Named structural dimensions. These are tokens because they are referenced from
more than one place: the element that *is* the top bar, and everything that has
to offset itself by the height of the top bar.

| Token | Value | Element |
| --- | --- | --- |
| `--spacing-topbar` | 44px / 2.75rem | Top bar |
| `--spacing-tabstrip` | 36px / 2.25rem | Tab strip |
| `--spacing-rail` | 44px / 2.75rem | Context icon rail |
| `--spacing-status` | 24px / 1.5rem | Status surface |
| `--spacing-composer` | 48px / 3rem | Composer, compact height |

## Panel widths

Each resizable panel carries three tokens: a default, a minimum, and a maximum.

| Token | Default | Min | Max |
| --- | --- | --- | --- |
| `--spacing-context` | 280px / 17.5rem | 220px / 13.75rem | 380px / 23.75rem |
| `--spacing-inspector` | 320px / 20rem | 280px / 17.5rem | 440px / 27.5rem |
| `--spacing-drawer` | 480px / 30rem | 380px / 23.75rem | 640px / 40rem |

The bounds are exposed as their own tokens — `--spacing-context-min`,
`--spacing-context-max`, and the matching pairs for inspector and drawer — so the
constraint a resize handle enforces is the same value the panel was built from.
What enforces them is a [layout law](../component/layout.md#layout-laws).

> The three **drawer** values are provisional. A drawer holds detail for one
> object, including content a user must compare side by side, which is why it is
> substantially wider than the inspector. Tune the numbers against the first real
> drawer rather than trusting them.
