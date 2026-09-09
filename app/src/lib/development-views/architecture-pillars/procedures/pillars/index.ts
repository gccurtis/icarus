import { ATOMIC_INVARIANTS } from "$development-views/architecture-pillars/procedures/pillars/atomic-invariants";
import { AUTHORITATIVE_DATA } from "$development-views/architecture-pillars/procedures/pillars/authoritative-data";
import { COHESIVE_UNITS } from "$development-views/architecture-pillars/procedures/pillars/cohesive-units";
import { GATED_CROSSINGS } from "$development-views/architecture-pillars/procedures/pillars/gated-crossings";
import { OWNED_LIFECYCLE } from "$development-views/architecture-pillars/procedures/pillars/owned-lifecycle";
import { PROCEDURAL_TRANSPARENCY } from "$development-views/architecture-pillars/procedures/pillars/procedural-transparency";
import { SCOPED_AUTHORITY } from "$development-views/architecture-pillars/procedures/pillars/scoped-authority";
import { STATE_OWNERSHIP } from "$development-views/architecture-pillars/procedures/pillars/state-ownership";
import type {
  ArchitecturePillar,
  CheckerCount,
  CheckerSpec,
  CheckerStatus
} from "$development-views/architecture-pillars/types";

export const PILLARS: readonly ArchitecturePillar[] = [
  STATE_OWNERSHIP,
  PROCEDURAL_TRANSPARENCY,
  SCOPED_AUTHORITY,
  OWNED_LIFECYCLE,
  ATOMIC_INVARIANTS,
  GATED_CROSSINGS,
  AUTHORITATIVE_DATA,
  COHESIVE_UNITS
];

export const ALL_CHECKERS: readonly CheckerSpec[] = PILLARS.flatMap((pillar) => pillar.checkers);

const STATUSES: readonly CheckerStatus[] = ["Enforced", "Partial", "Missing"];

export const CHECKER_COUNTS: readonly CheckerCount[] = STATUSES.map((status) => ({
  status,
  count: ALL_CHECKERS.filter((checker) => checker.status === status).length
}));

export const checkerCount = (status: CheckerStatus): number =>
  CHECKER_COUNTS.find((entry) => entry.status === status)?.count ?? 0;

export const pillarBySlug = (slug: string): ArchitecturePillar => {
  const pillar = PILLARS.find((candidate) => candidate.slug === slug);
  if (pillar === undefined) throw new Error(`Unknown architecture pillar: ${slug}`);
  return pillar;
};

export const statusClass = (status: CheckerStatus): string => status.toLowerCase();

export const nextPillar = (slug: string): ArchitecturePillar => {
  const at = PILLARS.findIndex((pillar) => pillar.slug === slug);
  if (at < 0) throw new Error(`Unknown architecture pillar: ${slug}`);
  return PILLARS[(at + 1) % PILLARS.length];
};

export {
  ATOMIC_INVARIANTS,
  AUTHORITATIVE_DATA,
  COHESIVE_UNITS,
  GATED_CROSSINGS,
  OWNED_LIFECYCLE,
  PROCEDURAL_TRANSPARENCY,
  SCOPED_AUTHORITY,
  STATE_OWNERSHIP
};
