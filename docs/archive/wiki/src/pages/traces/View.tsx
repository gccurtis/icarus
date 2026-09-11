import viewMd from "../../prose/traces/view.md?raw";
import { Box, Diagram, Edge, Page } from "../../components/common";
import { Sections } from "../../components/Sections";

const Path = () => {
  const hops = [
    { title: "views.ts", lines: ["CONTEXT_VIEWS names the key"], tone: "shared" },
    { title: "layout.svelte", lines: ["categories/document-editor/context/"], tone: "client" },
    { title: "opening.ts", lines: ["OPENING.rail · context"], tone: "shared" },
    { title: "rail-entries.ts", lines: ["label + icon"], tone: "client" },
    { title: "workspaceState.open()", lines: ["open · activate ops"], tone: "active" },
    { title: "context.svelte", lines: ["glob → component"], tone: "client" },
    { title: "the panel", lines: ["reads state by id"], tone: "plain" }
  ];
  const width = 1180;
  const boxWidth = 150;
  const gap = (width - 40 - hops.length * boxWidth) / (hops.length - 1);
  return (
    <Diagram viewBox={`0 0 ${width} 150`} caption="Seven hops from the key to the pixels. Green is the representation, blue the views and surfaces, cyan the workspace ledger.">
      {hops.map((hop, index) => (
        <g key={hop.title}>
          <Box x={20 + index * (boxWidth + gap)} y={40} w={boxWidth} h={70} tone={hop.tone} title={hop.title} lines={hop.lines} mono />
          {index < hops.length - 1 && <Edge d={`M ${20 + index * (boxWidth + gap) + boxWidth} 75 L ${20 + (index + 1) * (boxWidth + gap) - 2} 75`} tone="strong" />}
        </g>
      ))}
    </Diagram>
  );
};

export const ViewTrace = () => (
  <Page crumbs={[{ label: "Traces" }]} title="Trace: document-editor.layout" lede="A context view followed from its key to the rail pin that opens it.">
    <Sections markdown={viewMd} after={{ "the-path": <Path /> }} />
  </Page>
);
