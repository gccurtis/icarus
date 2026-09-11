import { resolveScope } from "$runtime/server/scope.server";
import type { Configuration } from "$runtime/server/start.server";
import type { LayoutServerLoad } from "./$types";

/**
 * Admits one published numeric value. Configuration faults fail on the server,
 * before an incomplete or mistyped transport object reaches the client model.
 */
const requiredPublishedNumber = (
  configuration: Configuration,
  key: string
): number => {
  const value = configuration.get(key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Published configuration key '${key}' must be a finite number — check configuration/`
    );
  }
  return value;
};

/**
 * The literal is the browser allowlist. It cannot accidentally serialize a
 * sibling secret, and its exact nested shape is inferred into LayoutServerData.
 */
const publish = (configuration: Configuration) => ({
  revisions: {
    changeSets: {
      flushAfterOps: requiredPublishedNumber(
        configuration,
        "revisions.changeSets.flushAfterOps"
      ),
      flushAfterMs: requiredPublishedNumber(
        configuration,
        "revisions.changeSets.flushAfterMs"
      )
    },
    sync: {
      everyMs: requiredPublishedNumber(configuration, "revisions.sync.everyMs")
    }
  },
  workspace: {
    changeSets: {
      flushAfterOps: requiredPublishedNumber(
        configuration,
        "workspace.changeSets.flushAfterOps"
      ),
      flushAfterMs: requiredPublishedNumber(
        configuration,
        "workspace.changeSets.flushAfterMs"
      )
    }
  },
  presentation: {
    stage: {
      unitsHigh: requiredPublishedNumber(configuration, "presentation.stage.unitsHigh"),
      widthRem: requiredPublishedNumber(configuration, "presentation.stage.widthRem"),
      averageGlyphWidthEm: requiredPublishedNumber(
        configuration,
        "presentation.stage.averageGlyphWidthEm"
      )
    },
    zoom: {
      minimum: requiredPublishedNumber(configuration, "presentation.zoom.minimum"),
      maximum: requiredPublishedNumber(configuration, "presentation.zoom.maximum"),
      step: requiredPublishedNumber(configuration, "presentation.zoom.step")
    },
    gutter: {
      minimumRem: requiredPublishedNumber(configuration, "presentation.gutter.minimumRem"),
      maximumRem: requiredPublishedNumber(configuration, "presentation.gutter.maximumRem")
    }
  }
});

/**
 * Hands the client instance its settings.
 *
 * A server load rather than a remote function, because these values must be in
 * hand *before* `buildClientModel` runs: the objects below read their thresholds
 * during their own construction, and a value that arrived after mount would make
 * every one of them cope with not having one yet.
 *
 * `+layout.ts` sets `ssr = false`, which turns off server *rendering* and not
 * server *loads* — the client router fetches this, so the data is present when
 * the layout script runs.
 */
export const load: LayoutServerLoad = async ({ locals, params }) => {
  await resolveScope(locals.session, params.project);

  return { configuration: publish(locals.model.configuration) };
};
