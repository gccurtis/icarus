import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const LOCAL_FILE = "local.yaml";

/**
 * Select only tracked YAML sections that live directly under configuration/.
 *
 * Git pathspec `*` also crosses directory separators unless glob magic is
 * requested explicitly. Filtering the returned paths ourselves keeps a newly
 * tracked fixture overlay from being mistaken for a base section.
 */
export const browserConfigurationSections = (trackedPaths) =>
  trackedPaths.flatMap((path) => {
    const match = /^configuration\/([^/]+\.yaml)$/u.exec(path);
    return match === null || match[1] === LOCAL_FILE ? [] : [match[1]];
  });

/**
 * Builds the browser fixture's configuration without ever reading local credentials.
 * The caller supplies Git-tracked, top-level sections; the selected fixture overlay
 * is the only nested file admitted.
 */
export const copyBrowserConfiguration = ({
  sourceDirectory,
  destinationDirectory,
  trackedSections,
  overlay,
  providerOrigin
}) => {
  mkdirSync(destinationDirectory, { recursive: true });
  for (const section of trackedSections) {
    if (
      basename(section) !== section ||
      !section.endsWith(".yaml") ||
      section === LOCAL_FILE
    ) {
      throw new Error(`browser-server: refused configuration section '${section}'`);
    }
    copyFileSync(join(sourceDirectory, section), join(destinationDirectory, section));
  }

  const destinationOverlay = join(destinationDirectory, overlay);
  mkdirSync(dirname(destinationOverlay), { recursive: true });
  writeFileSync(
    destinationOverlay,
    readFileSync(join(sourceDirectory, overlay), "utf8").replaceAll(
      "__ICARUS_BROWSER_PROVIDER_ORIGIN__",
      providerOrigin
    )
  );
};
