# pink-primary

An enumeration — see the [set contract](README.md#the-contract) for what a set
may decide.

| Anchor | Hue | Consumed by |
| --- | --- | --- |
| `primary` | `pink` | `--color-interactive-*`, `--color-primary-*` |
| `secondary` | `teal` | `--color-intelligence-*`, `--color-secondary-*` |
| `tertiary` | `blue` | `--color-active-*` |
| `accent-1` | `violet` | `--color-accent-1-*` |
| `accent-2` | `yellow` | `--color-accent-2-*` |

Each anchor expands to all seven [slots](../slots.md#the-seven-slots).

## Contract check

- **Distinguishable identity hues.** `pink`, `teal`, and `blue` are widely
  separated in hue — this is the most legible of the three sets with intensity
  removed.
- **Accents clear of meaning.** `violet` and `yellow` are claimed by no meaning
  role.
- **Five anchors, nothing else.**

`yellow` sits adjacent to `amber`, which carries `attention`. They are
distinguishable at every slot, but a screen placing an accent-2 chip beside a
needs-review badge should lean on the second cue that
[the state matrix](../../interaction/component.md#state-matrix) already
requires — this is the pairing that most rewards it.

This is the furthest any current set moves from the product's default identity,
which makes it the useful one for checking that nothing in a component has
quietly hard-coded blue.
