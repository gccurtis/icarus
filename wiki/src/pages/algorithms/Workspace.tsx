import workspaceMd from "../../prose/algorithms/workspace.md?raw";
import { Box, Diagram, Edge, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { vocabulary } from "../../data";

const Ledger = () => (
  <Diagram viewBox="0 0 1180 300" caption="Every method ends in perform(op): apply to the collaborators, append to the log, clear the redo stack, buffer for the server. Undo applies the inverse and moves the op to the undone stack.">
    <Box x={20} y={30} w={200} h={70} tone="client" title="open · close · activate …" lines={["WorkspaceState method"]} />
    <Box x={280} y={30} w={200} h={70} tone="active" title="perform(state, op)" lines={["apply · log.push · undone = []", "buffer for the server"]} mono />
    <Box x={540} y={30} w={200} h={70} tone="plain" title="apply(state, op)" lines={["tab-list · tab-views"]} mono />
    <Box x={800} y={30} w={160} h={70} tone="plain" title="log" lines={["WorkspaceOp[]"]} mono />
    <Box x={1000} y={30} w={160} h={70} tone="plain" title="undone" lines={["WorkspaceOp[]"]} mono />
    <Edge d="M 220 65 L 278 65" tone="strong" />
    <Edge d="M 480 65 L 538 65" tone="strong" />
    <Edge d="M 480 50 C 600 -10, 700 -10, 798 50" tone="strong" />
    <Box x={280} y={170} w={200} h={70} tone="active" title="undo()" lines={["apply(invert(log.pop()))", "undone.push(op)"]} mono />
    <Box x={540} y={170} w={200} h={70} tone="active" title="redo()" lines={["apply(undone.pop())", "log.push(op)"]} mono />
    <Edge d="M 880 100 L 880 130 L 480 205" dashed />
    <Edge d="M 1080 100 L 1080 130 L 740 205" dashed />
    <Box x={800} y={170} w={360} h={70} tone="server" title="submitWorkspaceChanges" lines={[`after ${8} ops or ${750} ms · refused → adopt(), retry once`]} mono />
    <Edge d="M 380 100 L 380 140 L 798 205" dashed />
    <text x={20} y={280} className="muted">
      eight ops: open · close · activate · land · context · inspect · resize · zoom — each carries was and now, so invert() needs nothing else
    </text>
  </Diagram>
);

export const Workspace = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Workspace ledger" lede="Tabs, views and frames as a log of invertible ops, with two collaborators holding the current shape and a change set going to the server.">
    <Sections
      markdown={workspaceMd}
      after={{
        "the-ledger": <Ledger />,
        "opening-a-category": (
          <Table
            head={["category", "opens on", "default context", "rail"]}
            rows={Object.entries(vocabulary.opening).map(([category, opening]) => [<code key="c">{category}</code>, opening.content ? <code key="o">{opening.content}</code> : "", opening.context ? <code key="x">{opening.context}</code> : "none", <span key="r" style={{ fontFamily: "var(--token-font-mono)", fontSize: "var(--token-text-caption)" }}>{opening.rail.map((key) => key.split(".")[1]).join(" · ")}</span>])}
          />
        ),
        persistence: (
          <Table
            head={["what", "where", "when", "on refusal"]}
            rows={[
              ["open tabs, panel geometry", "localStorage, one key per project (storage v3)", "on change, through storage.saveWorkbench", "a version mismatch discards"],
              ["the ledger", "workspaceRevisions and workspaceSnapshots, through the workspace capability", `after ${String(vocabulary.startingFrame.contextWidth ? 8 : 8)} ops or 750 ms`, "adopt the server's state and retry once; then needs-review"]
            ]}
          />
        )
      }}
    />
  </Page>
);
