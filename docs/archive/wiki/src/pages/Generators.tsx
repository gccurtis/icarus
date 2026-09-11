import generatorsMd from "../prose/generators.md?raw";
import { Chip, Page, Table } from "../components/common";
import { Prose } from "../components/Prose";
import { Sections } from "../components/Sections";
import { generators } from "../data";

const REWRITERS = new Set(["aliases", "imports", "categories"]);

export const Generators = () => {
  const commands = generators.generators.filter((generator) => !generator.shared && !REWRITERS.has(generator.name));
  const rewriters = generators.generators.filter((generator) => REWRITERS.has(generator.name));
  return (
    <Page title="Generators" lede="Every pnpm command that writes into the tree, with the usage line its own header prints.">
      <Sections
        markdown={generatorsMd}
        after={{
          "the-commands": (
            <>
              {commands.map((generator) => (
                <section key={generator.id} id={generator.name}>
                  <h3>
                    <code>pnpm {generator.command}</code> <Chip>{generator.group}</Chip>
                  </h3>
                  <p className="path">{generator.id}</p>
                  {generator.usage.length > 0 && <pre>{generator.usage.join("\n")}</pre>}
                  {generator.description.length > 0 && <Prose markdown={generator.description.join("\n\n")} />}
                </section>
              ))}
              <h3 id="shared">Shared by every generator</h3>
              {generators.generators
                .filter((generator) => generator.shared)
                .map((generator) => (
                  <section key={generator.id} id={generator.name}>
                    <h4>
                      <code>{generator.name}.mjs</code>
                    </h4>
                    <p className="path">{generator.id}</p>
                    {generator.description.length > 0 && <Prose markdown={generator.description.join("\n\n")} />}
                  </section>
                ))}
            </>
          ),
          "the-rewriters": (
            <>
              {rewriters.map((generator) => (
                <section key={generator.id} id={generator.name}>
                  <h3>
                    <code>pnpm {generator.command}</code> <Chip>{generator.group}</Chip>
                  </h3>
                  <p className="path">{generator.id}</p>
                  {generator.usage.length > 0 && <pre>{generator.usage.join("\n")}</pre>}
                  {generator.description.length > 0 && <Prose markdown={generator.description.join("\n\n")} />}
                </section>
              ))}
              {generators.otherScripts.map((script) => (
                <section key={script.id} id={script.name.replace(/\.mjs$/, "")}>
                  <h3>
                    <code>{script.name}</code>
                  </h3>
                  <p className="path">{script.id}</p>
                  {script.usage.length > 0 && <pre>{script.usage.join("\n")}</pre>}
                  {script.blurb && <Prose markdown={script.blurb} />}
                </section>
              ))}
            </>
          ),
          "what-proves-them": (
            <Table
              head={["file", "kind", "tests"]}
              rows={generators.scriptTests.map((test) => [
                <span key="f" className="path">
                  {test.id}
                </span>,
                test.test ? <Chip key="k" tone="test">test</Chip> : <Chip key="k">fixture</Chip>,
                <ul key="t" className="section-list">
                  {test.tests.map((name, index) => (
                    <li key={index}>
                      <Chip>{name.kind}</Chip> {name.name}
                    </li>
                  ))}
                </ul>
              ])}
            />
          )
        }}
      />
    </Page>
  );
};
