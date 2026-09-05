import viewsMd from "../prose/views.md?raw";
import { Chip, FileLink, Page, Stat, Table } from "../components/common";
import { Sections } from "../components/Sections";
import { units, vocabulary } from "../data";

const built = (file: string | null) => (file ? <FileLink id={file} label={file.split("/").pop()} /> : <Chip tone="test">placeholder</Chip>);

export const Views = () => (
  <Page title="View vocabulary" lede="Every key the workspace can name, read from the two vocabulary files and matched against the tree.">
    <div className="stats">
      <Stat figure={vocabulary.categories.length} label="categories" />
      <Stat figure={`${vocabulary.contentViews.filter((view) => view.file).length} / ${vocabulary.contentViews.length}`} label="content views built" />
      <Stat figure={`${vocabulary.contextViews.filter((view) => view.file).length} / ${vocabulary.contextViews.length}`} label="context views built" />
      <Stat figure={`${vocabulary.inspectorViews.filter((view) => view.file).length} / ${vocabulary.inspectorViews.length}`} label="inspector lenses built" />
    </div>
    <p>
      <FileLink id={vocabulary.keysFile} /> · <FileLink id={vocabulary.viewKeysFile} />
    </p>
    <Sections
      markdown={viewsMd}
      after={{
        categories: (
          <Table
            head={["category", "singleton", "opens on", "default context", "rail", "tab icon", "document"]}
            rows={vocabulary.categories.map((category) => {
              const unit = units.categories.find((candidate) => candidate.name === category.key);
              return [
                <span key="k" id={category.key.replace(".", "-")}>
                  <code>{category.key}</code>
                </span>,
                category.singleton ? <Chip key="s" tone="active">singleton</Chip> : "",
                category.opening?.content ? <code key="c">{category.opening.content}</code> : "",
                category.opening?.context ? <code key="x">{category.opening.context}</code> : <Chip key="x">none</Chip>,
                `${category.opening?.rail.length ?? 0} entries`,
                vocabulary.categoryEntries[category.key] ? <code key="i">{vocabulary.categoryEntries[category.key]}</code> : "",
                unit?.document ? <FileLink key="d" id={unit.document} label={`${category.key}.md`} /> : ""
              ];
            })}
          />
        ),
        "content-views": <Table head={["key", "file"]} rows={vocabulary.contentViews.map((view) => [<span key="k" id={view.key.replace(".", "-")}><code>{view.key}</code></span>, built(view.file)])} />,
        "context-views": (
          <Table
            head={["key", "file", "on a rail", "label", "icon"]}
            rows={vocabulary.contextViews.map((view) => [
              <span key="k" id={view.key.replace(".", "-")}>
                <code>{view.key}</code>
              </span>,
              built(view.file),
              view.onRail ? <Chip key="r" tone="shared">rail</Chip> : "",
              view.label ?? "",
              view.icon ? <code key="i">{view.icon}</code> : ""
            ])}
          />
        ),
        "inspector-lenses": <Table head={["key", "file"]} rows={vocabulary.inspectorViews.map((view) => [<span key="k" id={view.key.replace(".", "-")}><code>{view.key}</code></span>, built(view.file)])} />,
        commands: (
          <Table
            head={["command id", "default chord"]}
            rows={vocabulary.commandIds.map((id) => [<code key="i">{id}</code>, Object.entries(vocabulary.defaultBindings).find(([, command]) => command === id)?.[0] ?? <Chip key="n">unbound</Chip>])}
          />
        )
      }}
    />
  </Page>
);
