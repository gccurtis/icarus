import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { PresentationRuntimes } from "$model/client/presentation-runtimes/definition.svelte";
import type { PresentationRuntimesModel } from "$model/client/presentation-runtimes/types";

const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";
const SYNC_EVERY_MS = "revisions.sync.everyMs";

const UNITS_HIGH = "presentation.stage.unitsHigh";
const WIDTH_REM = "presentation.stage.widthRem";
const GLYPH_WIDTH = "presentation.stage.averageGlyphWidthEm";
const MINIMUM_ZOOM = "presentation.zoom.minimum";
const MAXIMUM_ZOOM = "presentation.zoom.maximum";
const ZOOM_STEP = "presentation.zoom.step";
const MINIMUM_GUTTER = "presentation.gutter.minimumRem";
const MAXIMUM_GUTTER = "presentation.gutter.maximumRem";

export const createPresentationRuntimes = (
  configuration: ConfigurationModel
): PresentationRuntimesModel =>
  new PresentationRuntimes({
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS),
    syncEveryMs: requiredNumber(configuration, SYNC_EVERY_MS)
  }, {
    unitsHigh: requiredNumber(configuration, UNITS_HIGH),
    widthRem: requiredNumber(configuration, WIDTH_REM),
    averageGlyphWidthEm: requiredNumber(configuration, GLYPH_WIDTH),
    minimumZoom: requiredNumber(configuration, MINIMUM_ZOOM),
    maximumZoom: requiredNumber(configuration, MAXIMUM_ZOOM),
    zoomStep: requiredNumber(configuration, ZOOM_STEP),
    minimumGutterRem: requiredNumber(configuration, MINIMUM_GUTTER),
    maximumGutterRem: requiredNumber(configuration, MAXIMUM_GUTTER)
  });
