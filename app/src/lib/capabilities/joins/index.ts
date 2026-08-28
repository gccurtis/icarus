/**
 * The id behind a title.
 *
 * A row in the project's work names its subject; the table that actually holds
 * that subject keys it by an id of its own. "Why did Feeder 12 fail twice?" is
 * `r-feeder` among the project's resources and `th-feeder` among the research
 * threads, and the title is the only join the mock data carries.
 *
 * Making the join in one place matters twice over. Without it a thread reached
 * from the work table and the same thread reached from the threads map would be
 * two tabs; and a finding inspected from the work table would arrive at the
 * lens carrying an id no research table answers for, which is a panel showing
 * the wrong finding rather than an error anyone would notice.
 *
 * ── FORWARD DECLARATION ────────────────────────────────────────────────────
 * The real form has no joins in it. A resource row carries the id of whatever it
 * stands for, so [`opening`](opening.ts) and [`inspecting`](inspecting.ts) read
 * that id off the row they were handed and this file goes away.
 */
import { RESOURCES } from "$capabilities/cast";
import { analyses, findings, threads } from "$capabilities/library";

export const threadFor = (name: string): string | undefined =>
  threads().current.find((row) => row.title === name)?.id;

export const findingFor = (name: string): string | undefined =>
  findings().current.find((row) => row.title === name)?.id;

export const analysisFor = (name: string): string | undefined =>
  analyses().current.find((row) => row.name === name)?.id;

/**
 * The other direction: the project's row for something a specialist table holds.
 *
 * `undefined` is a real answer and callers have to draw it. Not everything with
 * a research record is a resource of the project, and a control that opened
 * "the resource" for one that is not would open whichever resource happened to
 * sort first.
 */
export const resourceFor = (name: string): string | undefined =>
  RESOURCES.find((row) => row.name === name)?.id;
