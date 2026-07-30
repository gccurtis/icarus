import Fastify from "fastify";
import type { ApiHealth } from "@icarus/shared";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 4000);

app.get("/health", async () => {
  const payload: ApiHealth = {
    service: "backend",
    status: "ok",
    timestamp: new Date().toISOString()
  };

  return payload;
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ host: "0.0.0.0", port });
    app.log.info(`Backend listening on http://localhost:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
