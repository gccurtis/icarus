# Surfaces, components, and motion

The shell should feel like a luminous instrument: calm central work, precise panels, obvious controls, explicit state, and motion that explains cause.

## Starting geometry

| Element | Starting value |
| --- | --- |
| Top bar | 44px |
| Tab strip | 36px |
| Context icon rail | 44px |
| Status surface | 24px |
| AI Agent compact | 48px |
| Context panel | 280px, 220–380px |
| Inspector | 320px, 280–440px |

These are prototype defaults, not immutable laws. Tune them against the first working document vertical.

Use a 4px base and 8px primary spacing rhythm. Panels generally use 12–16px internal padding; the center uses more air. Taurus should be soft, not bubbly: squared precision for grids and page seams, modest radii for controls and live objects, larger radii only for elevated overlays.

## Surface roles

- The app background creates a low-contrast atmospheric field.
- The work surface provides maximum reading comfort with minimal chrome.
- Context is slightly recessed and map-like.
- Inspector is precise, selected-object-specific, and often slightly cooler.
- AI Agent is quiet when idle and operational when focused.
- Status remains infrastructural and subordinate.

Avoid turning the interface into a stack of cards. Elevation should come primarily from border and restrained shadow in light mode, tonal separation and border in dark mode.

Document, context, and inspector regions may suppress visible browser scrollbar chrome when their bounded geometry makes overflow clear, but wheel, touch, keyboard, and focus-driven scrolling must remain intact.

## Component principles

- One primary action per region when possible.
- Inputs have visible boundaries; placeholder text never substitutes for a label.
- Dropdowns are keyboard-operable, predictable, and reserved for named secondary groups.
- Permanent destinations and closeable resource tabs are visually distinct.
- Tables support clear hover, selection, sorting, filtering, and readable dense metadata.
- Prompt blocks carry a restrained live-object treatment while their detail moves to the inspector.
- Agent changes have explicit attribution, review, acceptance, and reversion states.

## Motion

Motion clarifies spatial cause and state change; it is never spectacle.

- Micro feedback: roughly 80–120ms.
- Small transitions: roughly 120–180ms.
- Panel changes: roughly 180–240ms.
- Overlays: roughly 200–280ms.

Panels move toward the edge from which they collapse. AI Agent expansion rises from its bottom anchor. Prefer stable layout, calm ease-out, and subtle progress over bounce, item-by-item choreography, or perpetual spinning. Respect `prefers-reduced-motion` while keeping state explicit.

Source: [Taurus Surface, Component & Motion System](https://app.notion.com/p/392b6410e50281cf8603d9bc543182d9)
