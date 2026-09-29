import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const allowedOrigins = new Set((process.env.CORS_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean));
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(pinoHttp({
  logger,
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: false,
}));
app.use(express.json({ limit: "32kb", strict: true }));
app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "Not found" }); });

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error?.type === "entity.too.large" ? 413 :
    error instanceof SyntaxError && "body" in error ? 400 : 500;
  if (status === 500) logger.error({ err: error }, "API request failed");
  if (!res.headersSent) res.status(status).json({ error: status === 413 ? "Request too large" : status === 400 ? "Invalid JSON" : "Internal server error" });
};
app.use(handleError);

export default app;