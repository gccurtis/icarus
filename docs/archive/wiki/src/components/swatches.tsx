import { styles, type ThemeUnit } from "../data";
import { isColour, resolveValue } from "../resolve";

export const Swatch = ({ value, title, size = 24 }: { value: string; title?: string; size?: number }) => (
  <span className="token-dot" title={title ?? value} style={{ width: size, height: size, background: value, verticalAlign: "middle" }} />
);

export const ResolvedSwatches = ({ value }: { value: string }) => (
  <span style={{ display: "inline-flex", gap: "calc(var(--token-spacing-unit) * 1)", alignItems: "center" }}>
    {styles.themes.map((theme) => {
      const resolved = resolveValue(value, theme);
      return isColour(resolved) ? <Swatch key={theme.name} value={resolved} title={`${theme.name}: ${resolved}`} size={18} /> : null;
    })}
  </span>
);

export const LiveSwatch = ({ name, size = 24 }: { name: string; size?: number }) => <Swatch value={`var(${name})`} title={`${name} under the current theme`} size={size} />;

export const Ramp = ({ theme, hue }: { theme: ThemeUnit; hue: string }) => {
  const steps = theme.palette[hue] ?? {};
  return (
    <div className="ramp">
      <span className="hue">{hue}</span>
      {Object.entries(steps).map(([step, value]) => (
        <span key={step} className="swatch-cell" title={`--palette-${hue}-${step}: ${value}`}>
          <span className="paint" style={{ background: value }} />
          <span className="name">{step}</span>
        </span>
      ))}
    </div>
  );
};
