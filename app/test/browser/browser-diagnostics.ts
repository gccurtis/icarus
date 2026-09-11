import type { Page } from "./fixtures";

/** Every product workflow fails on browser, transport, or server diagnostics. */
export const watchBrowserDiagnostics = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED" && request.url().includes("/__data.json")) return;
    errors.push(`${failure} ${request.url()}`);
  });
  return errors;
};
