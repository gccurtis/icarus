/**
 * The complete, allowlisted configuration payload that may cross into the
 * browser. Every field is required and numeric: the server route admits this
 * shape before it is serialized, so the client model never handles raw YAML or
 * an open-ended configuration bag.
 */
export type ClientConfigurationInput = {
  readonly revisions: {
    readonly changeSets: {
      readonly flushAfterOps: number;
      readonly flushAfterMs: number;
    };
    readonly sync: {
      readonly everyMs: number;
    };
  };
  readonly workspace: {
    readonly changeSets: {
      readonly flushAfterOps: number;
      readonly flushAfterMs: number;
    };
  };
  readonly presentation: {
    readonly stage: {
      readonly unitsHigh: number;
      readonly widthRem: number;
      readonly averageGlyphWidthEm: number;
    };
    readonly zoom: {
      readonly minimum: number;
      readonly maximum: number;
      readonly step: number;
    };
    readonly gutter: {
      readonly minimumRem: number;
      readonly maximumRem: number;
    };
  };
};

/** The finite set of reads the client configuration model supports. */
export type ConfigurationNumberKey =
  | "presentation.gutter.maximumRem"
  | "presentation.gutter.minimumRem"
  | "presentation.stage.averageGlyphWidthEm"
  | "presentation.stage.unitsHigh"
  | "presentation.stage.widthRem"
  | "presentation.zoom.maximum"
  | "presentation.zoom.minimum"
  | "presentation.zoom.step"
  | "revisions.changeSets.flushAfterMs"
  | "revisions.changeSets.flushAfterOps"
  | "revisions.sync.everyMs"
  | "workspace.changeSets.flushAfterMs"
  | "workspace.changeSets.flushAfterOps";
