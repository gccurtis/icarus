# blue-primary

The default semantic set, bound to bare `:root`. An enumeration — see the
[set contract](README.md#the-contract) for what a set may decide.

| Anchor | Hue | Consumed by |
| --- | --- | --- |
| `primary` | `blue` | `--color-interactive-*`, `--color-primary-*` |
| `secondary` | `violet` | `--color-intelligence-*`, `--color-secondary-*` |
| `tertiary` | `cyan` | `--color-active-*` |
| `accent-1` | `teal` | `--color-accent-1-*` |
| `accent-2` | `pink` | `--color-accent-2-*` |

Each anchor expands to all seven [slots](../slots.md#the-seven-slots):
`--anchor-primary-surface` through `--anchor-primary-on-fill`, and so on.

## Contract check

- **Distinguishable identity hues.** `blue`, `violet`, and `cyan` are separated
  by hue rather than by intensity, so `interactive` and `active` remain
  distinguishable with intensity removed.
- **Accents clear of meaning.** `teal` and `pink` are claimed by no meaning
  role.
- **Five anchors, nothing else.** No role, value, or slot is declared here.

Under Celestial these resolve to Aether Blue, Vesper Violet, and Halo Cyan —
but those are [Celestial's names for its own values](../../../themes/celestial/theory.md#the-named-hues),
not part of this set. On another palette the same set produces different colors
doing the same jobs.
