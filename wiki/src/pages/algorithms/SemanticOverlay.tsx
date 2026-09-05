import semanticOverlayMd from "../../prose/algorithms/semantic-overlay.md?raw";
import { Box, Diagram, Edge, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { vocabulary } from "../../data";

const changes = [0.08, 0.12, 0.31, 0.22, 0.14, 0.1, 0.16, 0.42, 0.3, 0.18, 0.12, 0.2, 0.26, 0.19, 0.11, 0.09, 0.35, 0.24, 0.13, 0.07];

const Field = () => {
  const width = 1180;
  const left = 60;
  const right = 40;
  const top = 30;
  const bottom = 60;
  const height = 300;
  const plot = { x: left, y: top, w: width - left - right, h: height - top - bottom };
  const step = plot.w / (changes.length - 1);
  const yOf = (value: number) => plot.y + plot.h - (value / 0.5) * plot.h;
  const threshold = 0.28;
  const peaks = [2, 7, 16];
  const path = changes.map((value, index) => `${index === 0 ? "M" : "L"} ${plot.x + index * step} ${yOf(value)}`).join(" ");
  return (
    <Diagram viewBox={`0 0 ${width} ${height}`} caption="An illustrative candidate-boundary field, not real data: semantic change at each boundary between aligned spans. Peaks own basins; a peak becomes a cut when it is stationary under attraction, clears the change threshold, is prominent enough, and holds enough of the field's mass.">
      <line x1={plot.x} y1={yOf(threshold)} x2={plot.x + plot.w} y2={yOf(threshold)} className="threshold" />
      <text x={plot.x + plot.w - 4} y={yOf(threshold) - 6} textAnchor="end" className="muted mono">
        changeThreshold
      </text>
      <path d={path} className="curve" />
      {changes.map((value, index) => (
        <circle key={index} cx={plot.x + index * step} cy={yOf(value)} r={peaks.includes(index) ? 6 : 3} className={peaks.includes(index) ? (index === 2 ? "peak rejected" : "peak") : "arrow"} />
      ))}
      <text x={plot.x + 2 * step} y={yOf(changes[2]) - 14} textAnchor="middle" className="mono muted">
        pulled toward the stronger peak
      </text>
      <text x={plot.x + 7 * step} y={yOf(changes[7]) - 14} textAnchor="middle" className="mono">
        cut
      </text>
      <text x={plot.x + 16 * step} y={yOf(changes[16]) - 14} textAnchor="middle" className="mono">
        cut
      </text>
      <text x={plot.x} y={height - 20} className="muted">
        token position →
      </text>
      <text x={plot.x - 8} y={plot.y + 10} textAnchor="end" className="muted mono" transform={`rotate(-90 ${plot.x - 8} ${plot.y + 10})`}>
        1 − cosine
      </text>
    </Diagram>
  );
};

const Pipeline = () => (
  <Diagram viewBox="0 0 1180 130" caption="prepareTranslation is everything between the provider's token field and its dense-vector request; completeTranslation attaches the vectors.">
    <Box x={20} y={30} w={190} h={70} tone="server" title="provider" lines={["token labels + vectors"]} />
    <Box x={260} y={30} w={200} h={70} tone="shared" title="alignTokenField" lines={["labels → source spans"]} mono />
    <Box x={510} y={30} w={210} h={70} tone="shared" title="segmentAlignedField" lines={["candidates → basins → cuts"]} mono />
    <Box x={770} y={30} w={180} h={70} tone="shared" title="slicesByCoordinates" lines={["span texts"]} mono />
    <Box x={1000} y={30} w={160} h={70} tone="server" title="provider" lines={["dense vector per span"]} />
    <Edge d="M 210 65 L 258 65" tone="strong" />
    <Edge d="M 460 65 L 508 65" tone="strong" />
    <Edge d="M 720 65 L 768 65" tone="strong" />
    <Edge d="M 950 65 L 998 65" tone="strong" />
  </Diagram>
);

export const SemanticOverlay = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Semantic overlay" lede="From a body to segments with vectors: encoding, alignment, a field of candidate boundaries, and basins under distance-discounted attraction.">
    <Sections
      markdown={semanticOverlayMd}
      after={{
        "what-it-does": <Pipeline />,
        "basins-and-boundaries": <Field />,
        configuration: <Table head={["field", "type"]} rows={vocabulary.translationConfiguration.map((field) => [<code key="n">{field.name}</code>, <code key="t">{field.type}</code>])} />
      }}
    />
  </Page>
);
