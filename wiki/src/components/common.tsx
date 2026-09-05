import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { fileById, fileRoute, type FileEntry } from "../data";

export const Page = ({ crumbs, title, lede, children }: { crumbs?: { to?: string; label: string }[]; title: ReactNode; lede?: ReactNode; children: ReactNode }) => (
  <article className="page">
    {crumbs && crumbs.length > 0 && (
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={index}>
            {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
            {index < crumbs.length - 1 ? " / " : ""}
          </span>
        ))}
      </nav>
    )}
    <h1>{title}</h1>
    {lede && <p className="lede">{lede}</p>}
    {children}
  </article>
);

export const FileLink = ({ id, label, className }: { id: string; label?: ReactNode; className?: string }) => {
  const entry = fileById.get(id);
  if (!entry) return <span className={className ?? "path"} title="not extracted">{label ?? id}</span>;
  return (
    <Link className={className ?? "path"} to={fileRoute(id)}>
      {label ?? entry.app}
    </Link>
  );
};

export const FileList = ({ ids, strip }: { ids: string[]; strip?: string }) => (
  <ul className="section-list">
    {ids.map((id) => {
      const entry = fileById.get(id);
      return (
        <li key={id}>
          <FileLink id={id} label={strip && id.startsWith(strip) ? id.slice(strip.length) : undefined} />
          {entry && (
            <>
              {" "}
              <span className="chip">{entry.role}</span>
              {entry.blurb && <p style={{ margin: "calc(var(--token-spacing-unit) * 1) 0 0", color: "var(--token-ink-secondary)", fontSize: "var(--token-text-body-sm)" }}>{firstSentence(entry.blurb)}</p>}
            </>
          )}
        </li>
      );
    })}
  </ul>
);

export const firstSentence = (text: string): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const match = flat.match(/^(.{20,240}?[.!?])(\s|$)/);
  return match ? match[1] : flat.length > 240 ? `${flat.slice(0, 237)}…` : flat;
};

export const Callout = ({ kind, label, children }: { kind: "gap" | "defect" | "record" | "law" | "verified"; label?: string; children: ReactNode }) => (
  <aside className={`callout ${kind}`}>
    <span className="label">
      {label ?? { gap: "Gap", defect: "Defect", record: "Design record", law: "Law", verified: "Verified" }[kind]}
    </span>
    {children}
  </aside>
);

export const Chip = ({ tone, children }: { tone?: string; children: ReactNode }) => <span className={`chip ${tone ?? ""}`}>{children}</span>;

export const HomeChip = ({ home }: { home: string | null }) => <Chip tone={home ?? undefined}>{home ?? "no home"}</Chip>;

export const Stat = ({ figure, label, to }: { figure: ReactNode; label: string; to?: string }) => (
  <div className="stat">
    <span className="figure">{to ? <Link to={to}>{figure}</Link> : figure}</span>
    <span className="label">{label}</span>
  </div>
);

export const Diagram = ({ caption, children, viewBox, height }: { caption?: ReactNode; children: ReactNode; viewBox: string; height?: number }) => (
  <figure className="diagram">
    <svg viewBox={viewBox} role="img" aria-label={typeof caption === "string" ? caption : undefined} style={height ? { height } : undefined}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrow" />
        </marker>
        <marker id="arrow-strong" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrow strong" />
        </marker>
        <marker id="arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrow danger" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrow active" />
        </marker>
      </defs>
      {children}
    </svg>
    {caption && <figcaption>{caption}</figcaption>}
  </figure>
);

export const Box = ({ x, y, w, h, tone, title, lines = [], mono = false }: { x: number; y: number; w: number; h: number; tone?: string; title: string; lines?: string[]; mono?: boolean }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={6} className={`box ${tone ?? ""}`} />
    <text x={x + 10} y={y + 18} fontWeight={600}>
      {title}
    </text>
    {lines.map((line, index) => (
      <text key={index} x={x + 10} y={y + 34 + index * 14} className={mono ? "mono muted" : "muted"}>
        {line}
      </text>
    ))}
  </g>
);

export const Edge = ({ d, tone, dashed, label, lx, ly }: { d: string; tone?: "strong" | "danger" | "active"; dashed?: boolean; label?: string; lx?: number; ly?: number }) => (
  <g>
    <path d={d} className={`edge ${tone ?? ""} ${dashed ? "dashed" : ""}`} markerEnd={`url(#arrow${tone ? `-${tone}` : ""})`} />
    {label && (
      <text x={lx} y={ly} className="muted mono" textAnchor="middle">
        {label}
      </text>
    )}
  </g>
);

export const Table = ({ head, rows, className }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) => (
  <div className={`table-wrap ${className ?? ""}`}>
    <table>
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th key={index}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Kbd = ({ children }: { children: ReactNode }) => <span className="kbd">{children}</span>;

export const Disclosure = ({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) => (
  <details className="disclosure" open={open}>
    <summary>{summary}</summary>
    <div>{children}</div>
  </details>
);

export const Says = ({ children, who }: { children: ReactNode; who?: ReactNode }) => (
  <blockquote className="says">
    {who && <span className="who">{who}</span>}
    {children}
  </blockquote>
);

export const relativeTo = (entry: FileEntry, prefix: string): string => (entry.id.startsWith(prefix) ? entry.id.slice(prefix.length) : entry.app);
