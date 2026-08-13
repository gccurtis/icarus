# cyan-primary

An enumeration — see the [set contract](README.md#the-contract) for what a set
may decide.

| Anchor | Hue | Consumed by |
| --- | --- | --- |
| `primary` | `cyan` | `--color-interactive-*`, `--color-primary-*` |
| `secondary` | `violet` | `--color-intelligence-*`, `--color-secondary-*` |
| `tertiary` | `pink` | `--color-active-*` |
| `accent-1` | `teal` | `--color-accent-1-*` |
| `accent-2` | `orange` | `--color-accent-2-*` |

Each anchor expands to all seven [slots](../slots.md#the-seven-slots).

## Contract check

- **Distinguishable identity hues.** `cyan`, `violet`, and `pink` are separated
  by hue rather than intensity, so `interactive` and `active` remain
  distinguishable with color intensity removed.
- **Accents clear of meaning.** `teal` and `orange` are claimed by no meaning
  role.
- **Five anchors, nothing else.**

`teal` sits close to `cyan`, which is acceptable — the rule an accent must
satisfy is that it cannot be mistaken for *state*, not that it must be far from
the primary. Where a categorical series needs the two adjacent, order them apart.

Under Celestial this reads as a cooler, more clinical instrument than
`blue-primary`. Under Cyberpunk it becomes arc-lit — cyan's `muted` step is that
theme's most legible neon.
