import configurationMd from "../prose/configuration.md?raw";
import { Page, Table } from "../components/common";
import { Sections } from "../components/Sections";
import { configuration, vocabulary } from "../data";

const valueAt = (path: string): unknown => {
  for (const file of configuration) {
    let node: unknown = file.value;
    for (const segment of path.split(".")) {
      if (node === null || typeof node !== "object") {
        node = undefined;
        break;
      }
      node = (node as Record<string, unknown>)[segment];
    }
    if (node !== undefined) return node;
  }
  return undefined;
};

export const Configuration = () => (
  <Page title="Configuration" lede="Seven YAML files, read once at startup, and the thirteen keys the browser is allowed to see.">
    <Sections
      markdown={configurationMd}
      after={{
        "the-files": (
          <>
            {configuration.map((file) => (
              <section key={file.name} id={file.name.replace(/\.yaml$/, "")}>
                <h3>
                  <code>{file.name}</code>
                </h3>
                <pre>{file.text.split("\n").filter((line) => !line.trim().startsWith("#")).join("\n").trim()}</pre>
              </section>
            ))}
          </>
        ),
        "what-the-browser-sees": <Table head={["published key", "value"]} rows={vocabulary.publishedKeys.map((key) => [<code key="k">{key}</code>, <code key="v">{String(valueAt(key))}</code>])} />
      }}
    />
  </Page>
);
