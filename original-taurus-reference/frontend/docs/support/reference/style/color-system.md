# Color system

> Status: design baseline with provisional theme defaults. Validate every token against real Alpha surfaces.

Color is a cognitive map for action, state, authorship, liveness, and trust. It should express angelic luminosity and astro-tech precision without becoming generic white-and-blue minimalism or saturated cyberpunk.

## Brand roles

| Role | Starting color | Use |
| --- | --- | --- |
| Aether Blue | `#3657C9` | Primary action and selected primary navigation. |
| Astro Navy | `#0B0F14` | Deep surfaces and highest-emphasis light-theme text. |
| Halo Cyan | `#0087B8` | Focus, live connection, resolution, and sync. |
| Vesper Violet | `#6F49D8` | AI, prompt blocks, memory, formulas, and derived intelligence. |
| Aureate Amber | `#8A5A13` | Pending judgment, staleness, attention, and review. |

Green means applied, accepted, valid, or safe. Red is reserved for destructive, failed, rejected, or denied states.

These values are starting tokens, not permission to scatter brand colors throughout the interface.

## Celestial Light

The historical design corpus proposed this as the default. It remains the leading light-theme reference, not a settled runtime default.

| Token | Starting value |
| --- | --- |
| App canvas | `#F7F4EC` |
| Work surface | `#FFFEFA` |
| Panel surface | `#EEEAE0` |
| Primary text | `#1D2329` |
| Secondary text | `#3A424D` |
| Muted text | `#6C716C` |
| Subtle border | `#D8D3C4` |
| Strong border | `#B9B3A1` |

Long-form work should feel like pearl paper or illuminated stone, not a sterile pure-white canvas.

## Eclipse

The current scaffold starts dark, making this the immediate implementation reference. The first real shell should determine whether Eclipse remains the default or becomes the alternate.

| Token | Starting value |
| --- | --- |
| App canvas | `#05070A` |
| Work surface | `#0B0F14` |
| Panel surface | `#111827` |
| Elevated surface | `#172033` |
| Primary text | `#F7F4EC` |
| Secondary text | `#D8D3C4` |
| Subtle border | `#2A3445` |
| Strong border | `#42506A` |

Dark mode should remain dimensional and readable rather than collapsing into pure black.

## Usage laws

- Blue is action, not decoration.
- Violet is intelligence, not ordinary navigation.
- Cyan is liveness and focus.
- Amber means human judgment is required.
- Red means failure, denial, or destruction—not mere absence.
- Green means confirmed or safe—not generic positivity.
- Glow is allowed only when it carries state.
- Color never works alone; pair it with copy, icons, position, border, or shape.

## Accessibility

Normal text should meet at least 4.5:1 contrast. Large text and meaningful non-text UI should meet at least 3:1. Focus needs a clearly visible perimeter and contrast against the unfocused state. Validate the working token combinations rather than assuming palette values are safe in every pairing.

Source: [Taurus Color System](https://app.notion.com/p/392b6410e50281518059cfef8ed07488)
