import chartsMd from "../../prose/algorithms/charts.md?raw";
import { Box, Diagram, Edge, Page } from "../../components/common";
import { Sections } from "../../components/Sections";
import { LiveSwatch } from "../../components/swatches";
import { vocabulary } from "../../data";

const Marks = () => {
  const data = [
    { category: "Q1", a: 30, b: 20, c: 10 },
    { category: "Q2", a: 45, b: 15, c: 20 },
    { category: "Q3", a: 25, b: 35, c: 15 },
    { category: "Q4", a: 50, b: 10, c: 25 }
  ];
  const plot = { x: 60, y: 30, w: 500, h: 200 };
  const band = plot.w / data.length;
  const inset = band * 0.18;
  const bandWidth = band - inset * 2;
  const max = 100;
  const lengthOf = (value: number) => (value / max) * plot.h;
  const classes = ["bar", "bar two", "bar three"];
  return (
    <Diagram viewBox="0 0 1180 270" caption="layoutBars, drawn: each segment is a Mark with an id of category::series and a box in plot coordinates. The stacked segment's label goes in its own middle, and a label that does not fit is dropped.">
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h - lengthOf(tick)} y2={plot.y + plot.h - lengthOf(tick)} className="grid" />
          <text x={plot.x - 8} y={plot.y + plot.h - lengthOf(tick) + 4} textAnchor="end" className="mono muted">
            {tick}
          </text>
        </g>
      ))}
      {data.map((row, index) => {
        let cursor = 0;
        const start = plot.x + index * band + inset;
        return (
          <g key={row.category}>
            {(["a", "b", "c"] as const).map((key, seriesIndex) => {
              const length = lengthOf(row[key]);
              const y = plot.y + plot.h - cursor - length;
              cursor += length;
              return (
                <g key={key}>
                  <rect x={start} y={y} width={bandWidth} height={length} className={classes[seriesIndex]} />
                  {length >= 16 && bandWidth >= 26 && (
                    <text x={start + bandWidth / 2} y={y + length / 2 + 4} textAnchor="middle" className="mono" style={{ fill: "var(--token-ink-on-fill)" }}>
                      {row[key]}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={start + bandWidth / 2} y={plot.y + plot.h + 18} textAnchor="middle" className="mono muted">
              {row.category}
            </text>
          </g>
        );
      })}
      <Box x={640} y={40} w={230} h={60} tone="plain" title="ChartSpec" lines={["type · data · x · y · series · settings"]} mono />
      <Box x={640} y={130} w={230} h={60} tone="active" title="layoutBars(...)" lines={["marks · bands · ticks · plot · max"]} mono />
      <Box x={920} y={40} w={240} h={60} tone="client" title="PlotBars.svelte" lines={["one <rect> per mark"]} mono />
      <Box x={920} y={130} w={240} h={60} tone="client" title="chart-selection.svelte.ts" lines={["selected mark ids"]} mono />
      <Edge d="M 755 100 L 755 128" tone="strong" />
      <Edge d="M 870 160 L 918 160" tone="strong" />
      <Edge d="M 870 70 L 918 70" dashed label="or chart.svelte (layerchart)" lx={894} ly={30} />
      <Edge d="M 1040 100 L 1040 128" dashed />
    </Diagram>
  );
};

export const Charts = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Charts" lede="A chart is a spec; a renderer is a function of it; a layout produces addressable marks before anything is drawn.">
    <Sections
      markdown={chartsMd}
      after={{
        "from-spec-to-marks": <Marks />,
        "series-colour": (
          <div className="demo-row">
            {vocabulary.seriesColors.map((color, index) => {
              const token = color.replace("var(--color-", "--token-color-").replace(/\)$/, "");
              return (
                <span key={color} className="demo-surface" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <LiveSwatch name={token} /> <code>{index + 1} · {color}</code>
                </span>
              );
            })}
          </div>
        )
      }}
    />
  </Page>
);
