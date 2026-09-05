import { Link } from "react-router-dom";

import dataModelMd from "../prose/data-model.md?raw";
import { Box, Chip, Diagram, Edge, FileLink, Page, Stat, Table } from "../components/common";
import { Sections } from "../components/Sections";
import { meta, units } from "../data";

const layers = () => {
  const depth = new Map<string, number>();
  const compute = (name: string, seen: string[] = []): number => {
    if (depth.has(name)) return depth.get(name)!;
    if (seen.includes(name)) return 0;
    const domain = units.domains.find((candidate) => candidate.name === name);
    const value = domain && domain.declares.length > 0 ? 1 + Math.max(...domain.declares.map((dependency) => compute(dependency, [...seen, name]))) : 0;
    depth.set(name, value);
    return value;
  };
  for (const domain of units.domains) compute(domain.name);
  return depth;
};

const DomainGraph = () => {
  const depth = layers();
  const rows = new Map<number, string[]>();
  for (const domain of units.domains) {
    const level = depth.get(domain.name) ?? 0;
    rows.set(level, [...(rows.get(level) ?? []), domain.name]);
  }
  const levels = [...rows.keys()].sort((a, b) => a - b);
  const width = 1180;
  const rowHeight = 110;
  const positions = new Map<string, { x: number; y: number }>();
  const boxWidth = 150;
  levels.forEach((level, rowIndex) => {
    const names = rows.get(level)!;
    const gap = (width - 40 - names.length * boxWidth) / Math.max(1, names.length - 1);
    names.forEach((name, index) => {
      positions.set(name, { x: 20 + index * (boxWidth + (names.length === 1 ? 0 : gap)), y: 30 + (levels.length - 1 - rowIndex) * rowHeight });
    });
  });
  const height = 30 + levels.length * rowHeight + 20;
  return (
    <Diagram viewBox={`0 0 ${width} ${height}`} caption="The domain graph as declared in app/configuration/representation.yaml. An arrow points from a domain to one it may import; the check refuses an import that is not drawn here, and a cycle.">
      {units.domains.flatMap((domain) =>
        domain.declares.map((dependency) => {
          const from = positions.get(domain.name)!;
          const to = positions.get(dependency)!;
          return <Edge key={`${domain.name}-${dependency}`} d={`M ${from.x + boxWidth / 2} ${from.y + 56} C ${from.x + boxWidth / 2} ${from.y + 90}, ${to.x + boxWidth / 2} ${to.y - 30}, ${to.x + boxWidth / 2} ${to.y - 2}`} />;
        })
      )}
      {units.domains.map((domain) => {
        const at = positions.get(domain.name)!;
        return <Box key={domain.name} x={at.x} y={at.y} w={boxWidth} h={56} tone={domain.behavior.length > 0 ? "shared" : "plain"} title={domain.name} lines={[`${domain.types.length} types · ${domain.behavior.length} behaviour`]} />;
      })}
    </Diagram>
  );
};

export const DataModel = () => (
  <Page title="Data model" lede="Forty-two tables read from tables.ts, thirteen domains read from representation.yaml, and the path algebra the store speaks.">
    <div className="stats">
      <Stat figure={units.tables.length} label="tables" />
      <Stat figure={units.tables.reduce((sum, table) => sum + table.fields.length, 0)} label="fields" />
      <Stat figure={units.domains.length} label="domains" to="/trees/representation#domains" />
      <Stat figure={meta.seedTables.length} label="seeded tables" />
    </div>
    <Sections
      markdown={dataModelMd}
      after={{
        "the-domain-graph": (
          <>
            <DomainGraph />
            <Table
              head={["domain", "may import", "type files", "exported declarations"]}
              rows={units.domains.map((domain) => [
                <Link key="n" to={`/trees/representation#domain-${domain.name}`}>
                  {domain.name}
                </Link>,
                domain.declares.length === 0 ? <Chip key="d">nothing</Chip> : domain.declares.map((name) => <code key={name}>{name} </code>),
                domain.types.map((id) => (
                  <span key={id}>
                    <FileLink id={id} label={id.split("/").pop()} />{" "}
                  </span>
                )),
                <span key="s" style={{ fontFamily: "var(--token-font-mono)", fontSize: "var(--token-text-caption)" }}>
                  {domain.declarations.map((declaration) => declaration.name).join(", ")}
                </span>
              ])}
            />
          </>
        ),
        "the-tables": (
          <>
            <p className="chips">
              {units.tables.map((table) => (
                <a key={table.name} className="chip" href={`#table-${table.name}`}>
                  {table.name}
                </a>
              ))}
            </p>
            {units.tables.map((table) => (
              <section key={table.name} id={`table-${table.name}`}>
                <h3>
                  {table.name} {meta.seedTables.includes(table.name) && <Chip tone="shared">seeded</Chip>}
                </h3>
                <p className="mono" style={{ color: "var(--token-ink-muted)", fontSize: "var(--token-text-caption)" }}>
                  row type {table.rowType} · fields {table.fieldsType} · id prefix {table.name}:
                </p>
                <Table head={["field", "type", ""]} rows={table.fields.map((field) => [<code key="n">{field.name}</code>, <code key="t">{field.type}</code>, field.optional ? <Chip key="o">optional</Chip> : ""])} />
              </section>
            ))}
          </>
        ),
        "the-store": (
          <Table
            head={["operation", "takes", "answers", "capability procedure"]}
            rows={[
              [<code key="o">create(table, fields)</code>, "a table name and a storable object", "the minted Id", "store/create"],
              [<code key="o">read(path)</code>, "table · table.id · table.id.field…", "a table, a row or a field, tagged with its kind", "store/read"],
              [<code key="o">update(path, value)</code>, "a row or field path and a storable value", "nothing; the table file is rewritten", "store/update"],
              [<code key="o">remove(path)</code>, "a row or field path", "nothing; the table file is rewritten", "store/remove"]
            ]}
          />
        )
      }}
    />
  </Page>
);
