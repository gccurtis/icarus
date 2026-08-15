import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * `GET /health` — process identity and the moment it answered.
 *
 * Operational only. It opens no database and probes no provider, so a 200 means
 * the process is up and routing rather than healthy in a deeper sense. A
 * database probe here would make it fail during a database restart, which is
 * usually not what a load balancer should act on.
 *
 * A real HTTP endpoint rather than a capability surface: capabilities are
 * reached by calling functions, and this is reached by a machine that only
 * speaks HTTP.
 */
export const GET: RequestHandler = () =>
  json({ service: "icarus", status: "ok", timestamp: new Date().toISOString() });
