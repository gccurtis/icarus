import slideDeckMd from "../../prose/algorithms/slide-deck.md?raw";
import { Box, Diagram, Edge, Page } from "../../components/common";
import { Sections } from "../../components/Sections";

const Stage = () => (
  <Diagram viewBox="0 0 1180 300" caption="A frame is fractional; the stage converts at its boundary. The same frame draws correctly at any zoom and either aspect ratio.">
    <rect x={40} y={30} width={480} height={270} className="box plain" rx={4} />
    <text x={52} y={50} className="mono muted">
      slide · units 1280 × 720 (16:9) · drawn at widthRem × zoom
    </text>
    <rect x={40 + 480 * 0.1} y={30 + 270 * 0.15} width={480 * 0.5} height={270 * 0.2} className="box active" rx={2} />
    <text x={40 + 480 * 0.1 + 8} y={30 + 270 * 0.15 + 22} className="mono">
      element · frame {"{ x: 0.1, y: 0.15, width: 0.5, height: 0.2 }"}
    </text>
    <Box x={600} y={40} w={250} h={60} tone="client" title="toPixels(frame, units)" lines={["x · width, y · height"]} mono />
    <Box x={600} y={130} w={250} h={60} tone="client" title="toFrame(pixels, units)" lines={["after dragend"]} mono />
    <Box x={900} y={40} w={260} h={60} tone="plain" title="Konva.Rect / Konva.Text" lines={["one node per element"]} mono />
    <Box x={900} y={130} w={260} h={60} tone="active" title="withElementFrame(…)" lines={["{ body, ops: [set frame] }"]} mono />
    <Box x={900} y={220} w={260} h={60} tone="active" title="runtime.apply(ops)" lines={["slide-deck-runtimes"]} mono />
    <Edge d="M 850 70 L 898 70" tone="strong" />
    <Edge d="M 1030 100 L 1030 128" tone="strong" label="dragend" lx={1090} ly={118} />
    <Edge d="M 900 160 L 852 160" tone="strong" />
    <Edge d="M 1030 190 L 1030 218" tone="strong" />
    <Edge d="M 520 60 L 598 70" dashed />
  </Diagram>
);

export const SlideDeck = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Slide deck editor" lede="Konva as a projection: fractional frames, stage metrics in rem, pure procedures that return the next deck and the ops that describe it.">
    <Sections markdown={slideDeckMd} after={{ "the-stage": <Stage /> }} />
  </Page>
);
