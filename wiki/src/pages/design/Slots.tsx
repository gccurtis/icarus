import slotsMd from "../../prose/design/slots.md?raw";
import { FileLink, Page, Table } from "../../components/common";
import { Sections } from "../../components/Sections";
import { ResolvedSwatches } from "../../components/swatches";
import { styles } from "../../data";

export const Slots = () => {
  const hues = [...new Set(styles.slotTable.map((slot) => slot.name.replace(/^--chromatic-/, "").split("-")[0]))];
  return (
    <Page crumbs={[{ to: "/design-system", label: "Design system" }]} title="Slot table" lede={<><FileLink id="app/src/lib/styles/chromatic-themes/slots.css" /> — {styles.slotTable.length} declarations over {hues.length} hues and {styles.slots.length} slots.</>}>
      <Sections
        markdown={slotsMd}
        after={{
          "what-a-slot-is": (
            <div className="role-grid">
              <span className="head" />
              {styles.slots.map((slot) => (
                <span key={slot} className="head">
                  {slot}
                </span>
              ))}
              {hues.map((hue) => (
                <span key={hue} style={{ display: "contents" }}>
                  <span className="role">{hue}</span>
                  {styles.slots.map((slot) => {
                    const declaration = styles.slotTable.find((entry) => entry.name === `--chromatic-${hue}-${slot}`);
                    return (
                      <span key={slot} className="cell" title={declaration ? `${declaration.name}: ${declaration.value}` : "not declared"}>
                        {declaration ? <ResolvedSwatches value={declaration.value} /> : "—"}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>
          ),
          "the-table": (
            <Table
              head={["slot", "declared value", "celestial · cyberpunk"]}
              rows={styles.slotTable.map((slot) => [
                <span key="n" id={slot.name}>
                  <code>{slot.name}</code>
                </span>,
                <code key="v">{slot.value}</code>,
                <ResolvedSwatches key="s" value={slot.value} />
              ])}
            />
          )
        }}
      />
    </Page>
  );
};
