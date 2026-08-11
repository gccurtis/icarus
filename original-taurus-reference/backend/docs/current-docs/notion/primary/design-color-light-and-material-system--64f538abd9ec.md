---
title: "Design - Color, Light & Material System"
notion_page_id: "64f538abd9ec4a8d82591c66c7e17a49"
notion_url: "https://app.notion.com/64f538abd9ec4a8d82591c66c7e17a49"
project: "Taurus Yesod"
role: "Primary"
format: "Document"
created: "2026-07-13 08:58:19Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design - Color, Light & Material System

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="✦" color="blue_bg">
	**Reviewed for Taurus Yesod — governing color, light, and material authority as of July 28, 2026.** The current Taurus Alpha palette is retained as the implementation baseline. Changes begin here, then flow into Alpha's token mirror and code.
</callout>
> **Mandate:** color and light should make Taurus feel luminous, dimensional, quiet, and exact. The palette should suggest a celestial instrument without turning the work surface into an illustration.
# Decision
Keep the current Taurus Alpha color direction while clarifying two first-class chromatic environments:
- **Celestial** remains the default light environment.
- **Night** is the product-language name for the dark environment.
- Celestial retains the current pearl/tan direction and gains explicit permission for cool metallic-blue and restrained sunset reflection. It is not an all-white theme.
- Night receives its own blue structural surface ladder and independently validated semantic aliases. It is not a polarity transform of Celestial.
- Both environments use the same brand families, semantic meanings, typography, geometry, layout, interaction, and motion.
The existing warm neutrals and semantic accents remain directionally correct. The palette already does important work well: the pearl field avoids sterile white; the indigo/cyan/violet family creates a celestial-technical register; amber introduces human judgment and warmth; semantic colors remain sparse enough to orient attention. This revision expands that foundation into a complete brand set, neutral ramp, chromatic spectrum, semantic alias system, named-gradient system, and explicit theme-invariance contract.
These values remain subject to accessibility, real-content, display, and user validation. Alpha should continue using its present implementation until its style mirror is deliberately synchronized; any identifier migration belongs to that deliberate implementation pass rather than this design-canon change.
# Color-psychology position
Taurus does not assign universal emotions to isolated hues. Research indicates that color effects depend on context, culture, task, lightness, chroma, saturation, brightness, and surrounding colors. A blue is not inherently trustworthy; a violet is not inherently intelligent.
The system therefore uses color as a **learned semantic language**:
- roles remain stable;
- meaning is reinforced by text, icon, shape, or position;
- chromatic emphasis is rare enough to remain informative;
- palette evaluation happens in complete screens with realistic content.
[Color Psychology: Effects of Perceiving Color](https://doi.org/10.1146/annurev-psych-010213-115035) provides the general caution against context-free claims. [Color and emotion: effects of hue, saturation, and brightness](https://doi.org/10.1007/s00426-017-0880-8) supports treating these dimensions together rather than attributing an effect to hue alone.
# Theme character
## Celestial
Celestial is the cloud-citadel under an atmospheric sky, not a field of featureless white. Its surfaces can reflect the environment: warm pearl and tan, clearer luminous work planes, cool or chromed blue, and restrained sunset warmth.
- the canvas is warm and low-glare rather than stark;
- the work plane is the clearest and most stable surface;
- supporting panels are slightly denser and quieter;
- boundaries emerge through tonal steps, position, and light before hard outlines;
- dark ink creates sustained-reading clarity;
- chromatic color appears where identity, orientation, state, or emphasis requires it.
Taurus Alpha's current pearl/tan background is directionally correct. Celestial must not become sterile Apple-like white, nostalgic cream, decorative pastel, literal cloud imagery, or low-contrast haze.
## Night
Night is the same citadel translated into cyberspace. Curves read as flows of data; the environment feels inhabitable, precise, and optimized for concentrated work. Its character is cybernetic without becoming theatrical.
- blue structural surfaces remain visibly differentiated instead of collapsing into black;
- text and controls are luminous enough to locate immediately without glowing;
- semantic colors are slightly sharper for recognition, but sparse and controlled;
- the work plane remains central and calmer than its states;
- the environment should feel like an extension of the body into a techno-optimized workspace.
*Neuromancer* is a Night-specific reference for cyberspace and focused technical flow. It is not a license for grime, danger, hacker clichés, neon decoration, visible machinery, terminal styling, or a gaming HUD.
Night changes color only. It does not introduce denser layout, sharper geometry, additional motion, decorative grids, circuit patterns, floating particles, or different disclosure behavior.
# Brand palette
The brand set is separate from the semantic state system. It establishes Taurus's identity and provides stable anchors for the larger spectrum.
<table header-row="true">
<tr>
<td>Brand role</td>
<td>Name</td>
<td>Value</td>
<td>Character</td>
</tr>
<tr>
<td>Primary</td>
<td>Aether Blue</td>
<td>`#3657C9`</td>
<td>clear action, orientation, celestial depth</td>
</tr>
<tr>
<td>Secondary</td>
<td>Vesper Violet</td>
<td>`#6F49D8`</td>
<td>intelligence, synthesis, elevated capability</td>
</tr>
<tr>
<td>Accent 1</td>
<td>Halo Cyan</td>
<td>`#0087B8`</td>
<td>focus, liveness, lucid energy</td>
</tr>
<tr>
<td>Accent 2</td>
<td>Aureate Amber</td>
<td>`#8A5A13`</td>
<td>judgment, warmth, human attention</td>
</tr>
<tr>
<td>Signature white</td>
<td>Luminous White</td>
<td>`#FFFEFA`</td>
<td>pearl light without sterile white</td>
</tr>
<tr>
<td>Signature black</td>
<td>Deep Ink</td>
<td>`#05070A`</td>
<td>deep endpoint without pure black</td>
</tr>
</table>
These roles are not interchangeable:
- primary and secondary establish identity;
- accents provide contrast and directed emphasis;
- signature white and black are the endpoints used to derive tonal ramps;
- semantic states may reference brand colors, but brand placement does not automatically carry semantic meaning.
# Neutral and surface ramp
The structural ramps carry most of the interface. Celestial uses warm atmospheric neutrals; Night uses a visible blue-cyberspace ladder. Neither ramp competes with content.
## Celestial structural ramp
```plain text
celestial-1    #FFFEFA  luminous white / work and elevated surface
celestial-2    #F7F4EC  warm pearl canvas
celestial-3    #EEEAE0  cloud-tan supporting panel
celestial-4    #E4DFD4  quiet raised or selected neutral
celestial-5    #D8D3C4  subtle boundary
celestial-6    #B9B3A1  strong decorative boundary / disabled outline
celestial-7    #6C716C  muted text and icon
celestial-8    #3A424D  secondary text
celestial-9    #1D2329  primary text
celestial-10   #0B0F14  deepest neutral

signature-white  #FFFEFA
signature-black  #05070A
```
## Night structural ramp
```plain text
night-1       #F4F7FC  primary text / brightest routine foreground
night-2       #CCD6E5  secondary text
night-3       #9AA9BF  muted text
night-4       #6F86A6  accessible subdued text / disabled foreground
night-5       #4C6B92  strong required boundary
night-6       #2D4666  subtle decorative boundary
night-7       #243C61  selected or active surface
night-8       #1D3150  elevated surface
night-9       #162640  supporting panel
night-10      #101D33  primary work surface
night-canvas  #0B1628  surrounding canvas
night-deep    #07111F  deepest endpoint / on bright action
```
Surface aliases:
```yaml
celestial:
  canvas: celestial-2
  work: celestial-1
  panel: celestial-3
  elevated: signature-white
  selected: celestial-4
night:
  canvas: night-canvas
  work: night-10
  panel: night-9
  elevated: night-8
  selected: night-7
```
The surface ladders establish area hierarchy. A small contrast step between adjacent large surfaces is intentional; any boundary required to identify or operate a component must use the dedicated strong boundary, fill, shape, label, or focus treatment.
# Complete chromatic spectrum
Taurus defines eight chromatic families so product UI, charts, annotations, resource signatures, and future capabilities never need an arbitrary one-off color.
Each family has ten tones:
```plain text
1   palest atmospheric tint
2   soft fill
3   light
4   elevated mid-light
5   normal / canonical family anchor
6   text-safe normal where tone 5 is insufficient
7   emphasized
8   strong
9   deep
10  deepest chromatic shade
```
Canonical aliases:
```yaml
light: 3
normal: 5
strong: 8
soft-fill: 2
deep: 10
```
## Red
```plain text
red-1  #FCEBE5    red-2  #F6D4CB    red-3  #EEB5AA    red-4  #DD8274
red-5  #C0362C    red-6  #A63129    red-7  #8A2C25    red-8  #6A2520
red-9  #4C1E1B    red-10 #321716
```
## Orange
```plain text
orange-1  #F9EEE5  orange-2  #F2DACD  orange-3  #E8C0AC  orange-4  #D49576
orange-5  #B85C2C  orange-6  #9F5129  orange-7  #844426  orange-8  #653621
orange-9  #48291C  orange-10 #301D16
```
## Yellow / Aureate
This is a restrained gold-yellow rather than fluorescent yellow so it remains compatible with pearl surfaces and the AstroTech character.
```plain text
yellow-1  #F3EDE3  yellow-2  #E5D8C8  yellow-3  #D2BEA4  yellow-4  #B39169
yellow-5  #8A5A13  yellow-6  #784F16  yellow-7  #634317  yellow-8  #4C3517
yellow-9  #372715  yellow-10 #251C12
```
## Green
```plain text
green-1  #E9F0E7  green-2  #CFE0D0  green-3  #ADCBB2  green-4  #74A782
green-5  #1E7A46  green-6  #1C6A3E  green-7  #1A5936  green-8  #16452C
green-9  #123322  green-10 #0E231A
```
## Cyan
```plain text
cyan-1  #EAF2F4    cyan-2  #D0E4EC    cyan-3  #AFD1E2    cyan-4  #74B1D0
cyan-5  #0087B8    cyan-6  #0A76A0    cyan-7  #0F6285    cyan-8  #114C67
cyan-9  #10374B    cyan-10 #0D2634
```
## Blue
```plain text
blue-1  #E9EEF7    blue-2  #CFDAF2    blue-3  #ADC0EC    blue-4  #7794DE
blue-5  #3657C9    blue-6  #2F4DAF    blue-7  #284191    blue-8  #1F3371
blue-9  #172752    blue-10 #101C38
```
## Violet
```plain text
violet-1  #EFEDF9  violet-2  #DBD8F6  violet-3  #C3BCF2  violet-4  #9B8DE8
violet-5  #6F49D8  violet-6  #6041BC  violet-7  #50389C  violet-8  #3D2D78
violet-9  #2C2257  violet-10 #1D193B
```
## Magenta
```plain text
magenta-1  #F7EBED  magenta-2  #EED3DD  magenta-3  #E0B5C9  magenta-4  #C882A7
magenta-5  #A43E7C  magenta-6  #8E376D  magenta-7  #76305B  magenta-8  #5B2748
magenta-9  #411E35  magenta-10 #2C1726
```
# Tonal-ramp derivation
Tone 5 is the chosen family anchor. The remaining tones are derived in OKLCH so changes are perceptually smoother than direct RGB interpolation.
<table>
<tr>
<td>Tone</td>
<td>Derivation</td>
</tr>
<tr>
<td>---:</td>
<td>---</td>
</tr>
<tr>
<td>1</td>
<td>10% anchor + 90% signature white</td>
</tr>
<tr>
<td>2</td>
<td>22% anchor + 78% signature white</td>
</tr>
<tr>
<td>3</td>
<td>38% anchor + 62% signature white</td>
</tr>
<tr>
<td>4</td>
<td>65% anchor + 35% signature white</td>
</tr>
<tr>
<td>5</td>
<td>100% anchor</td>
</tr>
<tr>
<td>6</td>
<td>88% anchor + 12% signature black</td>
</tr>
<tr>
<td>7</td>
<td>74% anchor + 26% signature black</td>
</tr>
<tr>
<td>8</td>
<td>58% anchor + 42% signature black</td>
</tr>
<tr>
<td>9</td>
<td>42% anchor + 58% signature black</td>
</tr>
<tr>
<td>10</td>
<td>28% anchor + 72% signature black</td>
</tr>
</table>
```typescript
const toneRecipe = {
  1: { anchor: 0.10, endpoint: "white" },
  2: { anchor: 0.22, endpoint: "white" },
  3: { anchor: 0.38, endpoint: "white" },
  4: { anchor: 0.65, endpoint: "white" },
  5: { anchor: 1.00, endpoint: "anchor" },
  6: { anchor: 0.88, endpoint: "black" },
  7: { anchor: 0.74, endpoint: "black" },
  8: { anchor: 0.58, endpoint: "black" },
  9: { anchor: 0.42, endpoint: "black" },
  10: { anchor: 0.28, endpoint: "black" },
} as const;

function deriveTone(anchor: OklchColor, tone: keyof typeof toneRecipe): OklchColor {
  const recipe = toneRecipe[tone];
  if (recipe.endpoint === "anchor") return anchor;
  const endpoint = recipe.endpoint === "white"
    ? signatureWhite
    : signatureBlack;
  return mixOklch(anchor, endpoint, recipe.anchor);
}
```
The checked-in hex values are canonical fallbacks. A generator must reproduce them within rounding tolerance; it may not silently substitute a different interpolation model.
# Palette-use rules
- Tone 3 is the standard `light` alias for low-emphasis fields, diagram regions, and selected backgrounds.
- Tone 5 is the standard `normal` alias for icons, non-text emphasis, charts, and branded objects.
- Tone 8 is the standard `strong` alias for high-emphasis text, boundaries, or deep chromatic surfaces.
- Tone 2 is preferred for semantic soft fills.
- Text contrast is validated against the actual background; aliases do not waive contrast requirements.
- On Luminous White, every tone-5 anchor meets 4.5:1 except `cyan-5`; use `cyan-6` for ordinary cyan text.
- A full spectrum does not authorize rainbow decoration. Multiple families appear together only when the information model requires categorical distinction.
- Chart series use shape, label, line style, or direct annotation in addition to color.
# Spatial gradients
Tonal ramps and spatial gradients are different systems. A tonal ramp provides reusable single colors. A spatial gradient combines those tones across an area.
Named brand gradients:
```css
--gradient-aether:
  linear-gradient(135deg, var(--blue-8) 0%, var(--blue-5) 58%, var(--cyan-3) 100%);

--gradient-vesper:
  linear-gradient(135deg, var(--violet-8) 0%, var(--violet-5) 58%, var(--magenta-3) 100%);

--gradient-aureate:
  linear-gradient(135deg, var(--yellow-8) 0%, var(--yellow-5) 58%, var(--orange-3) 100%);

--gradient-aurora:
  linear-gradient(135deg, var(--cyan-5) 0%, var(--blue-5) 48%, var(--violet-5) 100%);
```
Night atmospheric fields are color-only translations, not new visual structures:
```css
--gradient-night-aether:
  linear-gradient(135deg, #1D3150 0%, #243C61 58%, rgb(63 214 255 / 0.18) 100%);

--gradient-night-flow:
  linear-gradient(110deg, rgb(63 214 255 / 0.10), rgb(126 152 255 / 0.08), rgb(177 148 255 / 0.10));
```
Usage:
- `aether` is the default branded gradient;
- `vesper` is reserved for intelligence, synthesis, and selected presentation surfaces;
- `aureate` is reserved for human judgment, review, and warm ceremonial moments;
- `aurora` is ceremonial and must not become a routine panel background;
- Night fields may suggest data flow through color direction, but never add lines, grids, particles, circuitry, or ambient animation;
- gradients never sit behind dense body text, cells, formulas, or required controls;
- routine-work gradient opacity remains low and local;
- a flat-color fallback must preserve hierarchy and meaning.
# Semantic role contract
Semantic roles consume the palette. They do not create independent colors.
<table header-row="true">
<tr>
<td>Semantic role</td>
<td>Palette source</td>
<td>Meaning</td>
</tr>
<tr>
<td>Primary action</td>
<td>`blue-5`</td>
<td>user-invoked primary action</td>
</tr>
<tr>
<td>Secondary action</td>
<td>`violet-5`</td>
<td>elevated secondary capability or synthesis</td>
</tr>
<tr>
<td>Focus / live boundary</td>
<td>`cyan-5`</td>
<td>current focus, active connection, resolving state</td>
</tr>
<tr>
<td>Information</td>
<td>`blue-5`</td>
<td>neutral information requiring attention</td>
</tr>
<tr>
<td>Intelligence</td>
<td>`violet-5`</td>
<td>derived or AI-assisted origin when origin matters</td>
</tr>
<tr>
<td>Judgment / warning</td>
<td>`yellow-5`</td>
<td>human review, pending decision, unresolved attention</td>
</tr>
<tr>
<td>Success</td>
<td>`green-5`</td>
<td>valid, safe, complete, synchronized</td>
</tr>
<tr>
<td>Danger / error</td>
<td>`red-5`</td>
<td>destructive, failed, invalid, unsafe</td>
</tr>
<tr>
<td>Change / revision</td>
<td>`orange-5`</td>
<td>modification, revision, or migration</td>
</tr>
<tr>
<td>Highlight / annotation</td>
<td>`magenta-5`</td>
<td>explicit annotation or categorical emphasis</td>
</tr>
</table>
Soft, normal, and strong semantic aliases resolve through the common tone system:
```yaml
semantic:
  danger:
    soft: red-2
    light: red-3
    normal: red-5
    strong: red-8
  success:
    soft: green-2
    light: green-3
    normal: green-5
    strong: green-8
  warning:
    soft: yellow-2
    light: yellow-3
    normal: yellow-5
    strong: yellow-8
  info:
    soft: blue-2
    light: blue-3
    normal: blue-5
    strong: blue-8
  focus:
    soft: cyan-2
    light: cyan-3
    normal: cyan-5
    text: cyan-6
    strong: cyan-8
  intelligence:
    soft: violet-2
    light: violet-3
    normal: violet-5
    strong: violet-8
  revision:
    soft: orange-2
    light: orange-3
    normal: orange-5
    strong: orange-8
  annotation:
    soft: magenta-2
    light: magenta-3
    normal: magenta-5
    strong: magenta-8
```
Rules:
- color is never the only state cue;
- primary and secondary brand roles do not imply primary and secondary semantic severity;
- AI-authored content is not automatically violet; use intelligence color only when provenance or derivation is relevant;
- focus cyan is not generic information blue;
- warning means judgment is required; danger means failure, invalidity, destruction, or loss;
- chart-series colors are categorical and must not accidentally imply semantic state.
# Exact theme role tokens
## Celestial
```css
--color-surface-canvas:        var(--celestial-2);  /* #F7F4EC */
--color-surface-work:          var(--celestial-1);  /* #FFFEFA */
--color-surface-panel:         var(--celestial-3);  /* #EEEAE0 */
--color-surface-elevated:      var(--signature-white);
--color-surface-selected:      var(--celestial-4);  /* #E4DFD4 */

--color-text-primary:          var(--celestial-9);  /* #1D2329 */
--color-text-secondary:        var(--celestial-8);  /* #3A424D */
--color-text-muted:            var(--celestial-7);  /* #6C716C */

--color-border-subtle:         var(--celestial-5);  /* #D8D3C4 */
--color-border-strong:         var(--celestial-6);  /* #B9B3A1 */

--color-action-primary:        var(--blue-5);
--color-action-secondary:      var(--violet-5);
--color-on-action:             var(--signature-white);
--color-focus:                 var(--cyan-5);
--color-focus-text:            var(--cyan-6);
--color-intelligence:          var(--violet-5);
--color-attention:             var(--yellow-5);
--color-success:               var(--green-5);
--color-danger:                var(--red-5);
--color-revision:              var(--orange-5);
--color-annotation:            var(--magenta-5);
```
## Night
Night preserves every semantic family while using independently chosen perceptual equivalents.
```css
--color-surface-canvas:        #0B1628;
--color-surface-work:          #101D33;
--color-surface-panel:         #162640;
--color-surface-elevated:      #1D3150;
--color-surface-selected:      #243C61;

--color-text-primary:          #F4F7FC;
--color-text-secondary:        #CCD6E5;
--color-text-muted:            #9AA9BF;
--color-text-subdued:          #6F86A6;

--color-border-subtle:         #2D4666;
--color-border-strong:         #4C6B92;

--color-action-primary:        #7E98FF;
--color-action-secondary:      #B194FF;
--color-on-action:             #07111F;
--color-focus:                 #3FD6FF;
--color-intelligence:          #B194FF;
--color-attention:             #F1B84A;
--color-success:               #45D99A;
--color-danger:                #FF6B72;
--color-revision:              #FF9662;
--color-annotation:            #F37FBD;
```
These are theme-specific aliases, not additional palette families. The role meaning never changes between Celestial and Night.
# Contrast audit
Ratios below are WCAG relative-luminance calculations against the primary work surface.
## Theme-role audit
<table>
<tr>
<td>Token</td>
<td>Celestial</td>
<td>Night</td>
<td>Rule</td>
</tr>
<tr>
<td>---</td>
<td>---:</td>
<td>---:</td>
<td>---</td>
</tr>
<tr>
<td>Primary text</td>
<td>15.71:1</td>
<td>15.70:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>Secondary text</td>
<td>10.07:1</td>
<td>11.49:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>Muted text</td>
<td>4.94:1</td>
<td>7.07:1</td>
<td>normal text allowed; do not reduce opacity</td>
</tr>
<tr>
<td>Night subdued text</td>
<td>—</td>
<td>4.53:1</td>
<td>minimum routine text role; disabled state still needs non-color cues</td>
</tr>
<tr>
<td>Primary action</td>
<td>6.19:1</td>
<td>6.28:1</td>
<td>normal text and controls allowed</td>
</tr>
<tr>
<td>Focus / live</td>
<td>4.03:1</td>
<td>9.85:1</td>
<td>Celestial `cyan-5` is not ordinary small text</td>
</tr>
<tr>
<td>Intelligence</td>
<td>5.75:1</td>
<td>6.86:1</td>
<td>normal text allowed when semantically necessary</td>
</tr>
<tr>
<td>Judgment</td>
<td>5.86:1</td>
<td>9.39:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>Success</td>
<td>5.30:1</td>
<td>9.35:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>Danger</td>
<td>5.47:1</td>
<td>6.10:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>Revision</td>
<td>4.52:1</td>
<td>7.86:1</td>
<td>normal text allowed; Celestial has minimal margin</td>
</tr>
<tr>
<td>Annotation</td>
<td>5.85:1</td>
<td>6.89:1</td>
<td>normal text allowed</td>
</tr>
<tr>
<td>On-action text</td>
<td>6.19:1</td>
<td>7.05:1</td>
<td>button text allowed</td>
</tr>
<tr>
<td>Subtle border</td>
<td>1.48:1</td>
<td>1.75:1</td>
<td>decorative separation only</td>
</tr>
<tr>
<td>Strong border</td>
<td>2.08:1</td>
<td>3.07:1</td>
<td>Night may identify required component boundaries; Celestial needs another cue</td>
</tr>
</table>
Night surface contrasts against the work plane are intentionally gentle because they describe large-area hierarchy: canvas 1.07:1, panel 1.11:1, elevated 1.29:1, and selected 1.52:1. They are not substitutes for required component boundaries, focus rings, text, icons, or state labels.
## Chromatic anchor audit on Luminous White
<table>
<tr>
<td>Family anchor</td>
<td>Contrast</td>
<td>Ordinary text</td>
</tr>
<tr>
<td>---</td>
<td>---:</td>
<td>---</td>
</tr>
<tr>
<td>`red-5`</td>
<td>5.47:1</td>
<td>allowed</td>
</tr>
<tr>
<td>`orange-5`</td>
<td>4.52:1</td>
<td>allowed, with minimal margin</td>
</tr>
<tr>
<td>`yellow-5`</td>
<td>5.86:1</td>
<td>allowed</td>
</tr>
<tr>
<td>`green-5`</td>
<td>5.30:1</td>
<td>allowed</td>
</tr>
<tr>
<td>`cyan-5`</td>
<td>4.03:1</td>
<td>not allowed for ordinary text; use `cyan-6` at 5.06:1</td>
</tr>
<tr>
<td>`blue-5`</td>
<td>6.19:1</td>
<td>allowed</td>
</tr>
<tr>
<td>`violet-5`</td>
<td>5.75:1</td>
<td>allowed</td>
</tr>
<tr>
<td>`magenta-5`</td>
<td>5.85:1</td>
<td>allowed</td>
</tr>
</table>
Tone 3 is a fill/background role. Signature Black has at least 11:1 contrast against every tone-3 chromatic value in the current spectrum.
Subtle borders in both themes and Celestial's strong neutral boundary are intentionally quiet and do not reach the 3:1 non-text contrast threshold. Night's strong boundary reaches 3.07:1 against the work surface. Therefore:
- a required control boundary uses Night's strong boundary or combines fill, shape, label, state, or another component-specific cue;
- Celestial required controls never depend on the neutral border alone;
- focus uses the dedicated focus token at adequate thickness;
- selected and error states do not depend on neutral borders;
- disabled controls remain understandable without becoming invisible;
- every foreground/background combination is tested directly even when it uses a named alias.
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the binding floor. This audit does not replace browser, zoom, forced-colors, or assistive-technology testing.
# Light grammar
Light is evidence of structure or state. It is not ambient decoration.
## Permitted
- a local edge highlight on focus, active selection, or a newly resolved object;
- a restrained radial field behind ceremonial, entry, or empty-state compositions;
- a short-lived transition that traces origin to destination;
- dimensional separation on a true overlay;
- a faint resource signature that does not reduce content contrast.
## Prohibited
- persistent glow around ordinary panels;
- several simultaneous colored halos;
- bloom behind body text or data;
- animated aurora or nebula fields in the working state;
- color gradients used to communicate a state without a discrete cue;
- luminous AI treatment on every derived object.
## Required light-token slots
Values are candidates to calibrate against realistic screens:
```yaml
light:
  edge:
    rest-opacity: 0
    hover-opacity: 0.06
    focus-opacity: 0.18
    resolved-opacity: 0.12
  ambient:
    routine-max-opacity: 0.06
    ceremonial-max-opacity: 0.12
  duration:
    appear: 150ms
    resolve: 220ms
    ceremonial: 420ms
```
No ambient light token may lower text or essential-control contrast.
# Material grammar
Taurus materials sit between pearl paper, illuminated stone, precision glass, and seamless high-science surfaces. No one metaphor should become literal.
## Work surface
- opaque or effectively opaque;
- stable under scrolling and editing;
- highest local clarity;
- minimal texture;
- no backdrop blur behind dense content.
## Supporting panel
- slightly denser than the canvas;
- separated primarily by surface step and layout;
- subtle border permitted as decorative reinforcement;
- no independent shadow unless it truly overlaps the work.
## Overlay
- visually detached from its source;
- may use controlled translucency and blur if performance and contrast survive;
- requires a scrim and clear focus boundary;
- must not make background text appear actionable.
## Responsive layer
A responsive layer describes behavior and contour, not biological material. It:
- belongs to a source object;
- unfolds locally;
- has a softened outer contour and precise internal layout;
- returns cleanly to its origin;
- moves smoothly and remains completely still at rest.
## Candidate material tokens
```yaml
material:
  work:
    opacity: 1
    backdrop-blur: 0
  panel:
    opacity: 1
    backdrop-blur: 0
  overlay:
    celestial-opacity: 0.94
    night-opacity: 0.94
    backdrop-blur: 16px
    scrim-opacity: 0.32
  shadow:
    panel: none
    overlay: "0 18px 50px rgb(5 7 10 / 0.18)"
```
Blur is an enhancement, not a dependency. The opaque fallback must preserve the same hierarchy.
# Texture and atmospheric-field rules
- Named spatial gradients are atmospheric, never informational.
- Routine-work gradient fields should remain below approximately six percent local opacity unless the gradient is itself a branded object.
- Avoid opposing saturated hues behind content.
- Use one apparent source of light per composition.
- Fine grain may be tested only on large non-content fields at near-imperceptible opacity; it is off by default.
- No texture may interfere with screenshots, OCR, selection, chart reading, or low-vision zoom.
# Document-first token contract
The canonical record is semantic, machine-readable, and independent of any one CSS architecture. Alpha's CSS is a generated or manually synchronized implementation mirror.
```yaml
version: yesod-2026-07-28.3
authority: "Design - Color, Light & Material System"

themes:
  celestial:
    mode: light
    role: "atmospheric cloud citadel"
    surface: { canvas: "#F7F4EC", work: "#FFFEFA", panel: "#EEEAE0", elevated: "#FFFEFA", selected: "#E4DFD4" }
  night:
    mode: dark
    role: "focused cyberspace"
    surface: { canvas: "#0B1628", work: "#101D33", panel: "#162640", elevated: "#1D3150", selected: "#243C61" }

brand:
  primary: blue-5
  secondary: violet-5
  accent-1: cyan-5
  accent-2: yellow-5
  white: "#FFFEFA"
  black: "#05070A"

aliases:
  soft: 2
  light: 3
  normal: 5
  strong: 8
  deep: 10

families:
  red:     { anchor: "#C0362C" }
  orange:  { anchor: "#B85C2C" }
  yellow:  { anchor: "#8A5A13" }
  green:   { anchor: "#1E7A46" }
  cyan:    { anchor: "#0087B8" }
  blue:    { anchor: "#3657C9" }
  violet:  { anchor: "#6F49D8" }
  magenta: { anchor: "#A43E7C" }

semantic:
  action-primary: blue
  action-secondary: violet
  focus: cyan
  info: blue
  intelligence: violet
  warning: yellow
  success: green
  danger: red
  revision: orange
  annotation: magenta

theme-invariants:
  - shell-topology
  - component-geometry
  - typography
  - spacing-and-density
  - interaction-and-disclosure
  - resource-signatures
  - motion-timing-and-easing
```
The implementation may add component aliases, RGB fallbacks, or compatibility aliases. It may not:
- change a brand or semantic role silently;
- introduce a raw color without mapping it to a documented family, theme alias, or explicit exception;
- derive Night by mathematical inversion;
- use a tone alias without testing the actual foreground/background pair;
- treat a gradient as semantic state;
- create a new color family inside an individual component;
- change layout, geometry, typography, disclosure, or motion as a side effect of theme.
# Change protocol
1. Record the experiential, information, or accessibility reason in Yesod.
2. Identify whether the change affects brand, family anchor, tone recipe, semantic alias, surface, material, or spatial gradient.
3. Regenerate all ten tones for an affected anchor.
4. Check Celestial and Night independently across all resource types.
5. Calculate contrast for text, focus, state, and required boundaries.
6. Update the canonical values and version on this page.
7. Sync Alpha's style documentation and implementation in one change.
8. Run screenshot, browser, forced-colors, reduced-transparency, and real-content review.
9. Feed implementation findings back into Yesod.
# Validation scenes
Every palette change must be inspected in:
- long-form document editing;
- a dense spreadsheet with selection, formula, validation, charts, images, and overlays;
- a slide deck with stage surround and object handles;
- long chat with code, citations, attachments, errors, and streaming;
- context and inspector panels together;
- empty, loading, offline, conflict, destructive, warning, revision, and success states;
- charts with three, five, and eight categorical series;
- 200% and 400% zoom where applicable;
- bright and dim displays;
- Celestial, Night, forced colors, and reduced transparency.
# Validation questions
- Does the interface remain easy to read and easy to stay with?
- Does color reduce search or create additional competition?
- Can every semantic state be recognized without hue?
- Are primary and secondary actions still obvious?
- Do chart colors remain distinguishable with direct labels and color-vision simulations?
- Does Celestial feel atmospheric and high-science without becoming white-only, sterile, or decorative?
- Does Night feel focused and cybernetic without becoming black, neon, theatrical, or visually dense?
- Do both themes preserve the same geometry, disclosure, and motion?
- Do gradients add depth without pulling attention away from the work?
# Settled decisions
- IBM Plex is the Taurus product-interface type family; it is not a palette experiment.
- Celestial remains the default light environment; it is atmospheric, not all-white.
- Night is the canonical dark environment and product-language name.
- Night is a blue, visible, hyper-focused cyberspace environment—not a black inversion, neon terminal, or separate visual system.
- Theme changes are color-only. Geometry, typography, layout, disclosure, resource signatures, and motion remain invariant.
- The eight chromatic families and two structural surface ramps are the canonical reusable color supply.
- Tones 3, 5, and 8 are the canonical `light`, `normal`, and `strong` chromatic aliases.
- Routine work uses flat surfaces and restrained chroma; spatial gradients are named, limited, and never required for meaning.
# Remaining validation work
- validate the tone recipes and Night equivalents across common LCD and OLED displays;
- test categorical palette ordering under common forms of color-vision deficiency;
- verify that Aureate Yellow remains visibly yellow/gold rather than reading as brown in complete screens;
- test overlay translucency only after an opaque fallback is established.

