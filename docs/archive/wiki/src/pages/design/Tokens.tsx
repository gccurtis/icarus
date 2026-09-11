import tokensMd from "../../prose/design/tokens.md?raw";
import { FileLink, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { LiveSwatch, ResolvedSwatches } from "../../components/swatches";
import { styles, type Declaration } from "../../data";

const Sample = ({ domain, declaration }: { domain: string; declaration: Declaration }) => {
  const name = declaration.name;
  switch (domain) {
    case "color":
      return (
        <span style={{ display: "inline-flex", gap: "calc(var(--token-spacing-unit) * 2)", alignItems: "center" }}>
          <LiveSwatch name={name} />
          <ResolvedSwatches value={declaration.value} />
        </span>
      );
    case "typography":
      if (name.startsWith("--token-font-")) return <span style={{ fontFamily: `var(${name})` }}>The quick brown fox</span>;
      if (name.endsWith("-leading")) return <span style={{ lineHeight: `var(${name})`, display: "inline-block", borderLeft: "2px solid var(--token-border-strong)", paddingLeft: 6 }}>leading</span>;
      return <span style={{ fontSize: `var(${name})`, lineHeight: 1.2 }}>Aa</span>;
    case "spacing":
      return <span style={{ display: "inline-block", width: `calc(var(${name}) * 8)`, height: `var(${name})`, background: "var(--token-color-primary-fill)" }} />;
    case "shape":
      return name.includes("shadow") ? <span style={{ display: "inline-block", width: 48, height: 28, borderRadius: "var(--token-radius-control)", background: "var(--token-surface-elevated)", boxShadow: `var(${name})` }} /> : <span style={{ display: "inline-block", width: 48, height: 28, borderRadius: `var(${name})`, background: "var(--token-color-primary-fill)" }} />;
    case "motion":
      return <code>{declaration.value}</code>;
    default:
      return null;
  }
};

export const Tokens = () => (
  <Page crumbs={[{ to: "/design-system", label: "Design system" }]} title="Semantic tokens" lede={`${styles.tokens.reduce((sum, domain) => sum + domain.declarations.length, 0)} tokens in ${styles.tokens.length} domains — the whole public surface of the styles tree.`}>
    <Sections
      markdown={tokensMd}
      after={Object.fromEntries(
        styles.tokens.map((domain) => [
          domain.domain,
          <div key={domain.domain}>
            <p>
              <FileLink id={domain.id} /> · {domain.declarations.length} tokens
            </p>
            <Table
              head={["token", "declared value", domain.domain === "color" ? "live · celestial · cyberpunk" : "sample"]}
              rows={domain.declarations.map((declaration) => [
                <span key="n" id={declaration.name}>
                  <code>{declaration.name}</code>
                </span>,
                <code key="v">{declaration.value}</code>,
                <Sample key="s" domain={domain.domain} declaration={declaration} />
              ])}
            />
          </div>
        ])
      )}
    />
  </Page>
);
