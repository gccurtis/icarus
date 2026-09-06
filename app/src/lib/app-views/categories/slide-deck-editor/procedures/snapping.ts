import type { Frame } from "$representation/data/types/slide-decks/body";

export type Guide = { readonly axis: "x" | "y"; readonly at: number; readonly label: string };

export type Targets = {
  readonly xs: readonly { at: number; label: string }[];
  readonly ys: readonly { at: number; label: string }[];
};

export const targetsOf = (siblings: readonly Frame[]): Targets => {
  const xs = [
    { at: 0, label: "slide edge" },
    { at: 0.5, label: "slide centre" },
    { at: 1, label: "slide edge" }
  ];
  const ys = [
    { at: 0, label: "slide edge" },
    { at: 0.5, label: "slide centre" },
    { at: 1, label: "slide edge" }
  ];
  for (const frame of siblings) {
    xs.push({ at: frame.x, label: "left edge" }, { at: frame.x + frame.width / 2, label: "centre" }, { at: frame.x + frame.width, label: "right edge" });
    ys.push({ at: frame.y, label: "top edge" }, { at: frame.y + frame.height / 2, label: "middle" }, { at: frame.y + frame.height, label: "bottom edge" });
  }
  return { xs, ys };
};

const nearest = (
  candidates: readonly { at: number; own: number; label: string }[],
  threshold: number
) => {
  let best: { delta: number; at: number; label: string } | undefined;
  for (const candidate of candidates) {
    const delta = candidate.at - candidate.own;
    if (Math.abs(delta) > threshold) continue;
    if (best === undefined || Math.abs(delta) < Math.abs(best.delta)) best = { delta, at: candidate.at, label: candidate.label };
  }
  return best;
};

export const snapped = (
  frame: Frame,
  targets: Targets,
  threshold: number
): { frame: Frame; guides: Guide[] } => {
  const ownXs = [frame.x, frame.x + frame.width / 2, frame.x + frame.width];
  const ownYs = [frame.y, frame.y + frame.height / 2, frame.y + frame.height];

  const x = nearest(
    targets.xs.flatMap((target) => ownXs.map((own) => ({ at: target.at, own, label: target.label }))),
    threshold
  );
  const y = nearest(
    targets.ys.flatMap((target) => ownYs.map((own) => ({ at: target.at, own, label: target.label }))),
    threshold
  );

  const guides: Guide[] = [];
  if (x) guides.push({ axis: "x", at: x.at, label: x.label });
  if (y) guides.push({ axis: "y", at: y.at, label: y.label });

  return {
    frame: { ...frame, x: frame.x + (x?.delta ?? 0), y: frame.y + (y?.delta ?? 0) },
    guides
  };
};
