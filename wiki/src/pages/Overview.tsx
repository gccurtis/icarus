import { Link } from "react-router-dom";

import overview from "../prose/overview.md?raw";
import { Page, Stat } from "../components/common";
import { Sections } from "../components/Sections";
import { checks, files, meta, tests, units, TREE_ORDER, TREE_TITLES } from "../data";
import { PAGES } from "./registry";

const TREE_BLURBS: Record<string, string> = {
  representation: "Types that emit nothing, pure behaviour, and the store's table declarations.",
  capabilities: "What the server can be asked to do, entered at index.remote.ts.",
  model: "Objects with a lifetime: runtimes, workspace state, the store.",
  runtime: "Two composition roots that build the graph once.",
  components: "Authored vocabularies and vendored shadcn parts. Props in, events out.",
  styles: "Themes, slots, tokens and integrations, in one cascade.",
  surfaces: "The eight frames of the screen.",
  "app-views": "What a tab shows, keyed by path.",
  "development-views": "Demos and review tools under /demo that ship nowhere."
};

export const Overview = () => (
  <Page title="Icarus, from the tree" lede="A wiki of app/src, generated from the code and written beside it. Every file, every check, every token, every table.">
    <div className="stats">
      <Stat figure={meta.totalFiles} label="files under app/src" to="/browse/representation" />
      <Stat figure={checks.checks.length} label="lint checks" to="/checks" />
      <Stat figure={units.tables.length} label="tables" to="/data-model" />
      <Stat figure={tests.length} label="test files" to="/tests" />
      <Stat figure={PAGES.length} label="pages" />
    </div>
    <Sections
      markdown={overview}
      after={{
        "the-nine-trees": (
          <div className="cards">
            {TREE_ORDER.map((tree) => {
              const count = meta.counts[tree];
              const documents = files.filter((entry) => entry.tree === tree && entry.kind === "document").length;
              return (
                <Link key={tree} className="card" to={`/trees/${tree}`}>
                  <h3>{TREE_TITLES[tree]}</h3>
                  <p>{TREE_BLURBS[tree]}</p>
                  <span className="meta">
                    {count?.files ?? 0} files · {documents} documents · {tests.filter((test) => test.tree === tree).length} tests
                  </span>
                </Link>
              );
            })}
          </div>
        )
      }}
    />
  </Page>
);
