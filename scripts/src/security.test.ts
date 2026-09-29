import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer } from "node:net";
import { test, before, after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiDir = resolve(root, "artifacts/api-server");
const secret = "security-regression-only-secret-1234567890";
const sensorToken = "sensor-one-regression-token-1234567890";
let child: ChildProcess;
let base: string;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}/api`;
  child = spawn(process.execPath, [resolve(apiDir, "dist/index.mjs")], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "postgresql://test:test@127.0.0.1:65432/test",
      SESSION_SECRET: secret, NODE_ENV: "production", PORT: String(port), CORS_ORIGINS: "https://trusted.example",
      LANDSAFE_IOT_SENSOR_TOKENS: JSON.stringify({ 1: sensorToken }) },
    stdio: "ignore",
    windowsHide: true,
  });
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error(`API exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("API did not start");
});

after(() => { child?.kill(); });

function signedToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

test("missing, demo, invalid, expired, and modified tokens are rejected", async () => {
  const basePayload = { userId: 1, authVersion: Date.now(), iss: "landsafe-api", aud: "landsafe-dashboard" };
  const expired = signedToken({ ...basePayload, exp: Math.floor(Date.now() / 1000) - 10 });
  const validSignature = signedToken({ ...basePayload, exp: Math.floor(Date.now() / 1000) + 60 });
  const parts = validSignature.split(".");
  const modified = `${parts[0]}.${Buffer.from(JSON.stringify({ ...basePayload, userId: 999 })).toString("base64url")}.${parts[2]}`;
  for (const token of [undefined, "demo-token-admin", "invalid", expired, modified]) {
    const response = await fetch(`${base}/audit`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    assert.equal(response.status, 401, token);
  }
});

test("protected routes and measurement ingestion reject anonymous requests", async () => {
  for (const path of ["/users", "/dashboard/stats", "/alerts", "/devices", "/reports", "/measurements"]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 401, path);
  }
  const response = await fetch(`${base}/measurements`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sensorId: 1, timestamp: new Date().toISOString(), rainfall: 1 }) });
  assert.equal(response.status, 401);
});

test("sensor tokens cannot authenticate a different sensor", async () => {
  for (const [sensorId, token] of [[1, "wrong-token"], [2, sensorToken]] as const) {
    const response = await fetch(`${base}/measurements`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-sensor-token": token },
      body: JSON.stringify({ sensorId, timestamp: new Date().toISOString(), rainfall: 1 }) });
    assert.equal(response.status, 401);
  }
});
test("API hides implementation details, limits bodies, and restricts CORS", async () => {
  const response = await fetch(`${base}/healthz`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(response.headers.get("x-powered-by"), null);
  const trusted = await fetch(`${base}/healthz`, { headers: { Origin: "https://trusted.example" } });
  assert.equal(trusted.headers.get("access-control-allow-origin"), "https://trusted.example");
  const malformed = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "Invalid JSON" });
  const unexpected = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "x", role: "admin" }) });
  assert.equal(unexpected.status, 400);
  const large = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "x".repeat(33_000) }) });
  assert.equal(large.status, 413);
});

test("role guard denies insufficient roles", async () => {
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:65432/test";
  process.env.SESSION_SECRET = secret;
  const { requireRole } = await import(pathToFileURL(resolve(apiDir, "src/middlewares/auth.ts")).href);
  let status = 0;
  let nextCalled = false;
  const req = { user: { userId: 1, email: "test@example.invalid", role: "public", authVersion: 1 } };
  const res = { status(value: number) { status = value; return this; }, json() { return this; } };
  requireRole("admin")(req as any, res as any, () => { nextCalled = true; });
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});
test("IDs, limits, and measurement timestamps reject malformed values", async () => {
  const { parsePositiveInt, parseBoundedLimit, parseMeasurementQuery } = await import(pathToFileURL(resolve(apiDir, "src/lib/validation.ts")).href);
  assert.equal(parsePositiveInt("1junk"), null);
  assert.equal(parsePositiveInt("-1"), null);
  assert.equal(parsePositiveInt("1.5"), null);
  assert.equal(parseBoundedLimit("0", 100, 1000), null);
  assert.equal(parseBoundedLimit("1001", 100, 1000), null);
  assert.equal(parseMeasurementQuery({ from: "bad" }), null);
  assert.equal(parseMeasurementQuery({ sensorId: "1", limit: "10" })?.sensorId, 1);
});