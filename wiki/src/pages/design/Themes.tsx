import themesMd from "../../prose/design/themes.md?raw";
import { Chip, FileLink, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { Ramp, Swatch } from "../../components/swatches";
import { styles } from "../../data";
import { resolveValue } from "../../resolve";

const Theme = ({ name }: { name: string }) => {
  const theme = styles.themes.find((candidate) => candidate.name === name);
  if (!theme) return null;
  return (
    <>
      <div className="chips">
        <Chip tone={theme.scheme === "dark" ? "server" : "client"}>color-scheme: {theme.scheme}</Chip>
        {theme.bindsRoot && <Chip tone="active">binds :root</Chip>}
        <Chip>{Object.keys(theme.palette).length} ramps</Chip>
        <Chip>{theme.themeTokens.length} theme tokens</Chip>
      </div>
      <p>
        <FileLink id={theme.css} /> {theme.document && <>· <FileLink id={theme.document} /></>}
      </p>
      <h4>Palette</h4>
      {Object.keys(theme.palette).map((hue) => (
        <Ramp key={hue} theme={theme} hue={hue} />
      ))}
      <h4>Theme tokens</h4>
      <Table
        head={["token", "value", "resolves to"]}
        rows={theme.themeTokens.map((token) => {
          const resolved = resolveValue(token.value, theme);
          return [<code key="n">{token.name}</code>, <code key="v">{token.value}</code>, <span key="r"><Swatch value={resolved} size={18} /> <code>{resolved}</code></span>];
        })}
      />
    </>
  );
};

export const Themes = () => (
  <Page crumbs={[{ to: "/design-system", label: "Design system" }]} title="Chromatic themes" lede="Two themes, the same 104 declarations each, read from the files.">
    <Sections
      markdown={themesMd}
      after={{
        celestial: <Theme name="celestial" />,
        cyberpunk: <Theme name="cyberpunk" />
      }}
    />
  </Page>
);
