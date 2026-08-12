import { dirname } from "node:path";
import { fileURLToPath } from "node:url";


export const configurationDirectory: string = dirname(
  fileURLToPath(
    import.meta.resolve(`#configuration/${"server.yaml"}`)
  )
);
