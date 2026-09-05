import { Link } from "react-router-dom";

import overviewMd from "../../prose/design/overview.md?raw";
import { Box, Diagram, Edge, FileLink, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { LiveSwatch, ResolvedSwatches, Swatch } from "../../components/swatches";
import { styles } from "../../data";
import { resolveValue } from "../../resolve";

const StageDiagram = () => (
  <Diagram viewBox="0 0 1180 210" caption="Each stage declares its own prefix and reads the one behind it. A component sees only the third stage; the integrations re-export it to Tailwind and shadcn.">
    <Box x={20} y={30} w={250} h={110} tone="plain" title="1 · chromatic themes" lines={["--palette-<hue>-<step>", "--theme-<job>", "the only literal colours"]} mono />
    <Box x={320} y={30} w={230} h={110} tone="plain" title="2 · slots.css" lines={["--chromatic-<hue>-<slot>", "light-dark(faded, deep)", "reads --palette-*"]} mono />
    <Box x={600} y={30} w={250} h={110} tone="active" title="3 · semantic tokens" lines={["--token-color-<role>-<slot>", "--token-surface-*, ink, border", "typography · spacing · shape · motion"]} mono />
    <Box x={900} y={30} w={260} h={110} tone="shared" title="4 · integrations" lines={["@theme static → Tailwind", "shadcn bridge + variants", "reads --token-* only"]} mono />
    <Edge d="M 270 85 L 318 85" tone="strong" />
    <Edge d="M 550 85 L 598 85" tone="strong" />
    <Edge d="M 850 85 L 898 85" tone="strong" />
    <text x={725} y={175} textAnchor="middle" className="muted">
      public boundary — components, surfaces, views and this wiki name --token-* and nothing to its left
    </text>
    <path d="M 600 150 L 600 185" className="edge dashed" />
  </Diagram>
);

const ColourPath = () => {
  const celestial = styles.themes.find((theme) => theme.name === "celestial");
  const cyberpunk = styles.themes.find((theme) => theme.name === "cyberpunk");
  const slot = styles.slotTable.find((entry) => entry.name === "--chromatic-blue-border");
  const token = styles.tokens.flatMap((domain) => domain.declarations).find((declaration) => declaration.name === "--token-color-interactive-border");
  const tailwind = styles.integrations.find((integration) => integration.name === "tailwind")?.declarations.find((declaration) => declaration.value === "var(--token-color-interactive-border)");
  const steps = [
    { title: "celestial.css", code: "--palette-blue-normal", value: celestial?.palette.blue?.normal ?? "?", tone: "plain" },
    { title: "slots.css", code: "--chromatic-blue-border", value: slot?.value ?? "?", tone: "plain" },
    { title: "color.css", code: "--token-color-interactive-border", value: token?.value ?? "?", tone: "active" },
    { title: "tailwind.css", code: tailwind?.name ?? "?", value: tailwind?.value ?? "?", tone: "shared" },
    { title: "a component", code: "outline: 2px solid var(--token-color-interactive-border)", value: "or class=\"border-interactive-border\"", tone: "client" }
  ];
  return (
    <>
      <Diagram viewBox="0 0 1180 240" caption="One value, five files. The literal lives in the theme; every later file names the one before it. Under cyberpunk the same chain resolves to a different literal without any file but the theme changing.">
        {steps.map((step, index) => (
          <g key={step.code}>
            <Box x={20 + index * 232} y={40} w={216} h={100} tone={step.tone} title={step.title} lines={[step.code, step.value]} mono />
            {index < steps.length - 1 && <Edge d={`M ${236 + index * 232} 90 L ${250 + index * 232} 90`} tone="strong" />}
          </g>
        ))}
        <text x={20} y={200} className="muted">
          celestial resolves to {celestial ? resolveValue("var(--token-color-interactive-border)", celestial) : "?"} · cyberpunk resolves to {cyberpunk ? resolveValue("var(--token-color-interactive-border)", cyberpunk) : "?"}
        </text>
      </Diagram>
      <div className="demo-row">
        <span>the border, live:</span>
        <span className="demo-surface" style={{ outline: "2px solid var(--token-color-interactive-border)", outlineOffset: 2, background: "var(--token-color-interactive-surface)", color: "var(--token-color-interactive-text)" }}>
          interactive
        </span>
        <span>under celestial:</span>
        {celestial && <Swatch value={resolveValue("var(--token-color-interactive-border)", celestial)} />}
        <span>under cyberpunk:</span>
        {cyberpunk && <Swatch value={resolveValue("var(--token-color-interactive-border)", cyberpunk)} />}
      </div>
    </>
  );
};

const families: { family: string; roles: Record<string, string> }[] = [
  { family: "meaning", roles: styles.roles.meaning },
  { family: "identity", roles: styles.roles.identity },
  { family: "brand", roles: styles.roles.brand }
];

export const DesignOverview = () => (
  <Page title="Design system" lede="The cascade as a layered contract: palette to slot to token to component, in one direction, with the live values beside each step.">
    <p>
      <Link to="/design-system/themes">Themes</Link> · <Link to="/design-system/slots">Slots</Link> · <Link to="/design-system/tokens">Tokens</Link> · <Link to="/design-system/integrations">Integrations</Link> · <Link to="/trees/styles">The styles tree</Link>
    </p>
    <Sections
      markdown={overviewMd}
      after={{
        "four-stages-one-direction": <StageDiagram />,
        "how-a-colour-reaches-a-component": <ColourPath />,
        "roles-and-hues": (
          <Table
            head={["family", "role", "hue", "fill, live", "fill under each theme", "surface", "text"]}
            rows={families.flatMap(({ family, roles }) =>
              Object.entries(roles).map(([role, hue]) => [
                family,
                <code key="r">{role}</code>,
                <code key="h">{hue}</code>,
                <LiveSwatch key="l" name={`--token-color-${role}-fill`} />,
                <ResolvedSwatches key="t" value={`var(--token-color-${role}-fill)`} />,
                <span key="s" className="demo-surface" style={{ background: `var(--token-color-${role}-surface)`, borderColor: `var(--token-color-${role}-border)`, color: `var(--token-color-${role}-text)` }}>
                  {role}
                </span>,
                <span key="x" style={{ color: `var(--token-color-${role}-text)` }}>
                  {role} text
                </span>
              ])
            )}
          />
        ),
        "the-entry-file": (
          <Table
            head={["#", "line", "import", "stage"]}
            rows={styles.entryImports.map((record, index) => {
              const id = record.relative ? `app/src/lib/styles/${record.target.replace(/^\.\//, "")}` : null;
              const sheet = id ? styles.sheets.find((candidate) => candidate.id === id) : undefined;
              return [index + 1, record.line, id ? <FileLink key="f" id={id} label={record.target} /> : <code key="e">{record.target}</code>, sheet?.stage ?? "package"];
            })}
          />
        )
      }}
    />
  </Page>
);
