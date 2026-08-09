import type { ApiHealth } from "@icarus/shared";

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
