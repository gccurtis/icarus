import revisionsMd from "../../prose/algorithms/revisions.md?raw";
import { Box, Diagram, Edge, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";

const States = () => (
  <Diagram viewBox="0 0 1180 360" caption="The sync states of a resource runtime and what moves it between them, read from flush.ts, sync.ts and rebase.ts. offline is declared in the type and set by nothing under src/.">
    <Box x={20} y={40} w={160} h={60} tone="plain" title="loading" lines={["attached, no body yet"]} />
    <Box x={250} y={40} w={160} h={60} tone="shared" title="saved" lines={["buffer empty"]} />
    <Box x={480} y={40} w={160} h={60} tone="client" title="saving" lines={["change set in flight"]} />
    <Box x={710} y={40} w={170} h={60} tone="attention" title="rebasing" lines={["refused stale · retry once"]} />
    <Box x={950} y={40} w={200} h={60} tone="danger" title="needs-review" lines={["refused twice, or unresolved"]} />
    <Box x={480} y={260} w={160} h={60} tone="danger" title="error" lines={["the call threw"]} />
    <Box x={950} y={260} w={200} h={60} tone="plain" title="offline" lines={["declared, never set"]} />
    <Edge d="M 180 70 L 248 70" tone="strong" label="sync()" lx={214} ly={60} />
    <Edge d="M 410 70 L 478 70" tone="strong" label="flush()" lx={444} ly={60} />
    <Edge d="M 640 70 L 708 70" tone="danger" label="stale" lx={674} ly={60} />
    <Edge d="M 880 70 L 948 70" tone="danger" label="refused again" lx={914} ly={30} />
    <Edge d="M 560 100 L 560 258" tone="danger" label="throws" lx={528} ly={210} />
    <Edge d="M 480 92 C 440 130, 380 130, 340 102" tone="active" label="accepted" lx={410} ly={150} />
    <Edge d="M 795 100 C 760 190, 420 190, 345 104" dashed label="retry accepted" lx={700} ly={182} />
    <Edge d="M 1050 100 L 1050 258" dashed />
    <Edge d="M 950 92 C 900 220, 360 235, 300 104" dashed label="sync() after settling keeps needs-review" lx={640} ly={230} />
    <Edge d="M 640 290 C 760 300, 900 200, 1010 102" dashed label="revert → re-read leader" lx={800} ly={320} />
  </Diagram>
);

export const Revisions = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Revisions" lede="Buffer, coalesce, flush, rebase: how a resource runtime keeps its edit buffer honest against the server's change sets.">
    <Sections
      markdown={revisionsMd}
      after={{
        "the-shape-of-a-runtime": <States />,
        thresholds: (
          <Table
            head={["key", "value", "read by"]}
            rows={[
              [<code key="k">revisions.changeSets.flushAfterOps</code>, "50", "document, presentation and spreadsheet runtime constructors"],
              [<code key="k">revisions.changeSets.flushAfterMs</code>, "2000", "the same"],
              [<code key="k">revisions.sync.everyMs</code>, "5000", "attach(): the re-read interval while attached"],
              [<code key="k">workspace.changeSets.flushAfterOps</code>, "8", "workspace state"],
              [<code key="k">workspace.changeSets.flushAfterMs</code>, "750", "workspace state"]
            ]}
          />
        )
      }}
    />
  </Page>
);
