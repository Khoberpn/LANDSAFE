import { parsePositiveInt } from "../lib/validation";
import { Router } from "express";
import { db, locationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateLocationBody, UpdateLocationBody, GetLocationParams, UpdateLocationParams, DeleteLocationParams } from "@workspace/api-zod";

const router = Router();

router.get("/locations", authenticate, async (_req, res): Promise<void> => {
  const rows = await db.select().from(locationsTable).orderBy(locationsTable.name);
  res.json(rows.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: undefined,
  })));
});

router.post("/locations", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [loc] = await db.insert(locationsTable).values(parsed.data).returning();
  res.status(201).json({ ...loc, createdAt: loc!.createdAt.toISOString() });
});

router.get("/locations/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, parsed.data.id)).limit(1);
  if (!loc) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.patch("/locations/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateLocationBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [loc] = await db.update(locationsTable).set(bodyParsed.data).where(eq(locationsTable.id, paramParsed.data.id)).returning();
  if (!loc) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.delete("/locations/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(locationsTable).where(eq(locationsTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
