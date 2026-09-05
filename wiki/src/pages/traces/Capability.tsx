import capabilityMd from "../../prose/traces/capability.md?raw";
import { Box, Diagram, Edge, Page } from "../../components/common";
import { Sections } from "../../components/Sections";

const Path = () => {
  const hops = [
    { title: "document.svelte", lines: ["emit → translate"], tone: "client" },
    { title: "runtime.apply", lines: ["buffer · schedule"], tone: "active" },
    { title: "flush.ts", lines: ["coalesce · send"], tone: "active" },
    { title: "index.remote.ts", lines: ["command(…)"], tone: "client" },
    { title: "requireScope()", lines: ["scope.server.ts"], tone: "server" },
    { title: "validate", lines: ["validate-…"], tone: "server" },
    { title: "leader · apply", lines: ["stale? unresolved?"], tone: "server" },
    { title: "store", lines: ["create · update"], tone: "server" },
    { title: "the table file", lines: ["written whole"], tone: "plain" }
  ];
  const width = 1180;
  const boxWidth = 118;
  const gap = (width - 40 - hops.length * boxWidth) / (hops.length - 1);
  return (
    <Diagram viewBox={`0 0 ${width} 170`} caption="Nine hops. Blue is the browser, violet the server, cyan the runtime that buffers; the crossing is between the fourth and fifth boxes.">
      {hops.map((hop, index) => (
        <g key={hop.title}>
          <Box x={20 + index * (boxWidth + gap)} y={40} w={boxWidth} h={70} tone={hop.tone} title={hop.title} lines={hop.lines} mono />
          {index < hops.length - 1 && <Edge d={`M ${20 + index * (boxWidth + gap) + boxWidth} 75 L ${20 + (index + 1) * (boxWidth + gap) - 2} 75`} tone={index === 3 ? "danger" : "strong"} />}
        </g>
      ))}
      <text x={20 + 4 * (boxWidth + gap) - gap / 2} y={140} textAnchor="middle" className="muted mono">
        the one crossing
      </text>
    </Diagram>
  );
};

export const CapabilityTrace = () => (
  <Page crumbs={[{ label: "Traces" }]} title="Trace: submitDocumentChanges" lede="A keystroke followed to a row on disk, through every file it touches.">
    <Sections markdown={capabilityMd} after={{ "the-path": <Path /> }} />
  </Page>
);
