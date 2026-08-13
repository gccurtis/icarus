# Semantic sets

A **semantic set** assigns identity: which hue is primary, which is secondary,
which is tertiary, and which two carry the accents. It is theme-independent —
the same set works on any palette, because every theme provides the same named
ramps.

A set is an **enumeration and nothing else**. It fills five anchors from the
hues a theme provides and decides nothing about what those anchors are used for.
That is what makes sets cheap to multiply: `red-primary` is `blue-primary` with
different hue names on the right-hand side.

Token form: `--anchor-<name>-<slot>`, as in `--anchor-primary-fill`.

| Anchor | Consumed by |
| --- | --- |
| `primary` | `--color-interactive-*`, `--color-primary-*` |
| `secondary` | `--color-intelligence-*`, `--color-secondary-*` |
| `tertiary` | `--color-active-*` |
| `accent-1` | `--color-accent-1-*` |
| `accent-2` | `--color-accent-2-*` |

Five anchors × seven [slots](../slots.md) = 35 declarations. That is the entire
file.

## The contract

A set must satisfy three things:

1. **`primary`, `secondary`, and `tertiary` are mutually distinguishable hues.**
   `interactive` and `active` resolve to the first and third, and they must
   never be told apart by intensity alone — a control is one hue at rest and
   another while it is working. Three shades of the same hue is not a set.
2. **Accents draw from hues no meaning role claims.** `green`, `red`, `amber`,
   and `grey` are spoken for. An accent that reuses one makes brand color
   indistinguishable from state.
3. **A set fills exactly the five anchors and nothing else.** It may not declare
   a `--color-*` role, a `--palette-*` value, or a slot.

## What a set may not do

**Meaning is not a set's to assign.** `green`, `red`, and `amber` are absent
from every set because success, danger, and attention are fixed in
[roles](../roles.md). A set that could make danger orange would mean `danger`
stopped meaning the same thing between two screens of the same product.

**Intensity is not a set's to assign either.** A set names a hue; which step
that hue uses for each job comes from [slots](../slots.md), which no set can
see.

## Available sets

| Set | primary | secondary | tertiary | accent-1 | accent-2 |
| --- | --- | --- | --- | --- | --- |
| [`blue-primary`](blue-primary.md) | `blue` | `violet` | `cyan` | `teal` | `pink` |
| [`cyan-primary`](cyan-primary.md) | `cyan` | `violet` | `pink` | `teal` | `orange` |
| [`pink-primary`](pink-primary.md) | `pink` | `teal` | `blue` | `violet` | `yellow` |

`blue-primary` is the default, bound to bare `:root`. Switch with
`document.documentElement.dataset.set = "<name>"`.

Every set works on every theme, because a set names hues and a theme supplies
them. Three sets × two themes is six looks from one component tree, and no
component changes between any of them.

## Adding a set

One file, 35 lines, no prose required. Check it against the contract above and
add a row to the table here.

`orange` and `yellow` are claimed by no role in any set, which makes them the
safest accents for a set that needs to stay clear of both meaning and the
existing brand hues.
