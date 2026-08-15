#!/usr/bin/env node
/**
 * Companion ramps: for each hue a semantic set uses as its primary, the four
 * identity anchors that set needs, generated at a fixed angular distance in the
 * direction of the primary's wheel neighbours.
 *
 *     pnpm new-style-companions
 *
 * Why generated rather than authored: an anchor picked by choosing a whole other
 * ramp jumps as far as the gap between ramps happens to be — 21.7° from amber to
 * yellow, 68.1° from violet to pink — so the same role lands a different
 * perceptual distance from primary in every set. Solving `t` per pair for a
 * fixed angle makes the step identical everywhere, which is what lets one rule
 * describe every set.
 *
 * Lightness and hue could be derived from the step alone — measured across the
 * ten ramps, hue drifts under 6° between steps and lightness holds a tight curve
 * — but chroma cannot: `normal` ranges 0.105 to 0.207 because hues differ in the
 * chroma they can reach at a given lightness. Interpolating between the two
 * neighbouring ramps carries chroma correctly for free.
 *
 * Everything written is bounded by generated markers. Nothing outside them is
 * touched, and every generated ramp is checked against the same contrast
 * thresholds the style contract test applies to the authored ones.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot =
  process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const stylesRoot = join(packageRoot, "src", "lib", "styles");

/** The hues a set uses as its primary, and the roles filled at each distance. */
export const PRIMARIES = ["blue", "cyan", "pink"];
export const ANCHORS = [
  { role: "tertiary", degrees: -10 },
  { role: "secondary", degrees: 10 },
  { role: "accent-1", degrees: -20 },
  { role: "accent-2", degrees: 20 }
];

const STEPS = ["faded", "light", "muted", "normal", "emphasized", "strong", "deep"];
const HUES = ["red", "orange", "amber", "yellow", "green", "teal", "cyan", "blue", "violet", "pink"];
const START = "  /* generated:companions:start */";
const END = "  /* generated:companions:end */";

// ------------------------------------------------------------------ color ----

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const toLab = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
};

const toHex = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return (
    "#" +
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ]
      .map((v) => Math.round(Math.min(1, Math.max(0, unlin(v))) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
};

const toLch = ([L, A, B]) => {
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), h < 0 ? h + 360 : h];
};
const fromLch = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
const arc = (from, to) => {
  let d = to - from;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ------------------------------------------------------------------ theme ----

const themeFacts = (css) => {
  const step = (hue, name) => css.match(new RegExp(`--palette-${hue}-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`cycle resolving ${name}`);
    seen.add(name);
    const value = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) throw new Error(`missing ${name}`);
    const ref = value.match(/^var\((--[a-z0-9-]+)\)$/);
    return ref ? resolve(ref[1], seen) : value;
  };
  const wheel = HUES.map((name) => ({ name, h: toLch(toLab(step(name, "normal")))[2] })).sort((a, b) => a.h - b.h);
  return {
    step,
    wheel,
    dark: /color-scheme:\s*dark/.test(css),
    work: resolve("--theme-surface-work"),
    onFill: resolve("--theme-ink-on-fill")
  };
};

/** One companion ramp, plus whether it satisfies the contrast contract. */
export const companionRamp = (facts, base, degrees) => {
  const index = facts.wheel.findIndex((entry) => entry.name === base);
  const neighbour = facts.wheel[(index + (degrees < 0 ? -1 : 1) + facts.wheel.length) % facts.wheel.length].name;
  const gap = arc(facts.step(base, "normal") && toLch(toLab(facts.step(base, "normal")))[2], toLch(toLab(facts.step(neighbour, "normal")))[2]);
  const t = Math.min(1, Math.abs(degrees / gap));

  const ramp = {};
  for (const name of STEPS) {
    const [L1, C1, h1] = toLch(toLab(facts.step(base, name)));
    const [L2, C2, h2] = toLch(toLab(facts.step(neighbour, name)));
    ramp[name] = toHex(fromLch([L1 + (L2 - L1) * t, C1 + (C2 - C1) * t, h1 + arc(h1, h2) * t]));
  }

  const checks = {
    border: contrast(ramp.normal, facts.work),
    text: contrast(facts.dark ? ramp.light : ramp.strong, facts.work),
    onFill: contrast(facts.dark ? ramp.muted : ramp.emphasized, facts.onFill)
  };
  return {
    ramp,
    neighbour,
    ok: checks.border >= 2.95 && checks.text >= 6.95 && checks.onFill >= 4.45,
    checks
  };
};

// ------------------------------------------------------------------ write ----

const replaceBlock = (source, body) => {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1) {
    throw new Error("generated:companions markers are missing");
  }
  return source.slice(0, start + START.length) + "\n" + body + "\n" + source.slice(end);
};

const failures = [];

const paletteBlock = (facts) => {
  const lines = [];
  for (const base of PRIMARIES) {
    for (const { role, degrees } of ANCHORS) {
      const { ramp, neighbour, ok, checks } = companionRamp(facts, base, degrees);
      if (!ok) {
        failures.push(
          `${base}-${role}: border ${checks.border.toFixed(2)}, text ${checks.text.toFixed(2)}, on-fill ${checks.onFill.toFixed(2)}`
        );
      }
      lines.push(`  /* ${base} ${degrees > 0 ? "+" : ""}${degrees}° toward ${neighbour} */`);
      for (const name of STEPS) lines.push(`  --palette-${base}-${role}-${name}: ${ramp[name]};`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd();
};

const slotBlock = () => {
  const jobs = [
    ["surface", "faded", "deep"],
    ["surface-hover", "light", "strong"],
    ["border", "normal", "normal"],
    ["fill", "emphasized", "muted"],
    ["fill-hover", "strong", "light"],
    ["text", "strong", "light"]
  ];
  const lines = [];
  for (const base of PRIMARIES) {
    for (const { role } of ANCHORS) {
      const key = `${base}-${role}`;
      lines.push(`  /* ${key} */`);
      for (const [job, light, dark] of jobs) {
        lines.push(
          `  --chromatic-${key}-${job}: light-dark(var(--palette-${key}-${light}), var(--palette-${key}-${dark}));`
        );
      }
      lines.push(`  --chromatic-${key}-on-fill: var(--theme-ink-on-fill);`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd();
};

for (const theme of ["celestial", "cyberpunk"]) {
  const path = join(stylesRoot, "chromatic-themes", theme, `${theme}.css`);
  if (!existsSync(path)) continue;
  const css = readFileSync(path, "utf8");
  writeFileSync(path, replaceBlock(css, paletteBlock(themeFacts(css))));
  console.log(`companions: ${theme} palette updated`);
}

const slotsPath = join(stylesRoot, "chromatic-themes", "slots.css");
writeFileSync(slotsPath, replaceBlock(readFileSync(slotsPath, "utf8"), slotBlock()));
console.log("companions: slots updated");

if (failures.length > 0) {
  console.error(`\ncompanions: ${failures.length} generated ramp(s) miss the contrast contract\n`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`companions: ${PRIMARIES.length * ANCHORS.length} ramps per theme, all within the contrast contract`);
