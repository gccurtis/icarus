/**
 * What this frontend expects back from the backend's /health endpoint. The
 * backend owns the payload; this is our independent declaration of it, so the
 * two are no longer checked against each other by the compiler.
 */
interface ApiHealth {
  service: "backend";
  status: "ok";
  timestamp: string;
}

const statusEl = document.querySelector<HTMLParagraphElement>("#status");

const render = (message: string): void => {
  if (!statusEl) return;
  statusEl.textContent = message;
};

const loadHealth = async (): Promise<void> => {
  try {
    const response = await fetch("http://localhost:4000/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const health = (await response.json()) as ApiHealth;
    render(`Backend status: ${health.status} at ${health.timestamp}`);
  } catch (error) {
    render(`Backend unreachable: ${String(error)}`);
  }
};

void loadHealth();
