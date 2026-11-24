import app from "./app";
import { logger } from "./lib/logger";
import { initLiaDatabase } from "./lib/lia/db-init";
import { syncEngine } from "./integrations/sync-engine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initLiaDatabase().catch((err) => {
  logger.warn({ err: err.message }, "Background LIA database init warning");
});

syncEngine.start().catch((err) => {
  logger.warn({ err: err.message }, "Background government data sync engine init warning");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
