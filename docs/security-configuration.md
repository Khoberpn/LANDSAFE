# Security configuration

Set these values in the API server environment before starting it. Do not commit actual values.

- `SESSION_SECRET`: unique random secret of at least 32 UTF-8 bytes. The API fails to start without it. Rotating it invalidates all existing JWTs.
- `CORS_ORIGINS`: comma-separated trusted browser origins. Production defaults to no cross-origin browser access; same-origin frontend proxy remains usable.
- `LANDSAFE_IOT_SENSOR_TOKENS`: JSON object mapping numeric sensor IDs to distinct random tokens of at least 32 bytes, for example `{"1":"<unique-random-token-at-least-32-bytes>"}`. Give each ESP32 only its own token and send it as `x-sensor-token` with its matching `sensorId`.
- `LANDSAFE_SEED_PASSWORD`: unique test-only password, 12 to 72 UTF-8 bytes, required only when running `pnpm seed`. The seed script no longer embeds or prints a shared password. Previously seeded accounts are not rotated by this change.

`POST /api/measurements` also accepts a current operator or admin bearer token for controlled manual entry. Sensor timestamps must be ISO 8601 and within 15 minutes of server time. A repeated `(sensorId, timestamp)` returns HTTP 409. The API derives `locationId` from the registered sensor.

Serve the frontend and API over HTTPS. The API emits HSTS in production, but TLS termination and frontend headers must be configured at the deployment proxy. Run the API behind the same origin as the dashboard or configure `CORS_ORIGINS` explicitly.