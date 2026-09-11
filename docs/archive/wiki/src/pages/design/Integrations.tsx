import integrationsMd from "../../prose/design/integrations.md?raw";
import { Chip, Disclosure, FileLink, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { ResolvedSwatches } from "../../components/swatches";
import { fileById, styles } from "../../data";

const Integration = ({ name }: { name: string }) => {
  const integration = styles.integrations.find((candidate) => candidate.name === name);
  if (!integration) return null;
  return (
    <>
      <p>
        {integration.files.map((id, index) => (
          <span key={id}>
            {index > 0 && " · "}
            <FileLink id={id} label={id.split("/").pop()} />
            {fileById.get(id)?.generated && <Chip tone="test"> generated</Chip>}
          </span>
        ))}
      </p>
      <Disclosure summary={`${integration.declarations.length} declarations`}>
        <Table
          head={["name", "value", "file", "resolves"]}
          rows={integration.declarations.map((declaration) => [<code key="n">{declaration.name}</code>, <code key="v">{declaration.value}</code>, declaration.file.split("/").pop(), <ResolvedSwatches key="s" value={declaration.value} />])}
        />
      </Disclosure>
    </>
  );
};

export const Integrations = () => (
  <Page crumbs={[{ to: "/design-system", label: "Design system" }]} title="Integrations" lede="How Tailwind and shadcn see the tokens, and why neither sees anything behind them.">
    <Sections markdown={integrationsMd} after={{ tailwind: <Integration name="tailwind" />, shadcn: <Integration name="shadcn" /> }} />
  </Page>
);
