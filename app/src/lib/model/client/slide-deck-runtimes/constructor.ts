import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { SlideDeckRuntimes } from "$model/client/slide-deck-runtimes/definition.svelte";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes/types";

const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";
const SYNC_EVERY_MS = "revisions.sync.everyMs";

const UNITS_HIGH = "slideDeck.stage.unitsHigh";
const WIDTH_REM = "slideDeck.stage.widthRem";
const GLYPH_WIDTH = "slideDeck.stage.averageGlyphWidthEm";
const MINIMUM_ZOOM = "slideDeck.zoom.minimum";
const MAXIMUM_ZOOM = "slideDeck.zoom.maximum";
const ZOOM_STEP = "slideDeck.zoom.step";
const MINIMUM_GUTTER = "slideDeck.gutter.minimumRem";
const MAXIMUM_GUTTER = "slideDeck.gutter.maximumRem";

export const createSlideDeckRuntimes = (
  configuration: ConfigurationModel
): SlideDeckRuntimesModel =>
  new SlideDeckRuntimes({
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
