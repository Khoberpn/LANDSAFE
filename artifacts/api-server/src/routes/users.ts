import { parsePositiveInt } from "../lib/validation";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateUserBody, UpdateUserBody, UpdateUserParams, DeleteUserParams } from "@workspace/api-zod";

const router = Router();
function validPassword(password: string): boolean {
  const bytes = Buffer.byteLength(password, "utf8");
  return bytes >= 12 && bytes <= 72;
}
function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validProfile(email: string, name: string): boolean {
  return validEmail(email) && name.trim().length > 0 && name.length <= 120;
}

function fmt(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    lastLogin: u.lastLogin?.toISOString() ?? null,
  };
}

router.get("/users", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(rows.map(fmt));
});

router.post("/users", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!validPassword(parsed.data.password) || !validProfile(parsed.data.email, parsed.data.name)) {
    res.status(400).json({ error: "Invalid user details" }); return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    email: parsed.data.email.trim().toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role as any,
    passwordHash,
  }).returning();
  res.status(201).json(fmt(user));
});

router.patch("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateUserParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateUserBody.strict().safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  if (Object.keys(bodyParsed.data).length === 0 ||
      (bodyParsed.data.password !== undefined && !validPassword(bodyParsed.data.password)) ||
      (bodyParsed.data.email !== undefined && !validEmail(bodyParsed.data.email)) ||
      (bodyParsed.data.name !== undefined && (bodyParsed.data.name.trim().length === 0 || bodyParsed.data.name.length > 120))) {
    res.status(400).json({ error: "Invalid user details" }); return;
  }
  if (paramParsed.data.id === req.user!.userId &&
      (bodyParsed.data.isActive === false || (bodyParsed.data.role && bodyParsed.data.role !== "admin") ||
       bodyParsed.data.password !== undefined)) {
    res.status(400).json({ error: "Cannot remove your own admin access" }); return;
  }
  const updates: Record<string, any> = { ...bodyParsed.data };
  if (bodyParsed.data.email) updates.email = bodyParsed.data.email.trim().toLowerCase();
  updates.updatedAt = sql`GREATEST(${usersTable.updatedAt} + interval '1 millisecond', now())`;
  if (bodyParsed.data.password) {
    updates.passwordHash = await bcrypt.hash(bodyParsed.data.password, 12);
    delete updates.password;
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, paramParsed.data.id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(user));
});

router.delete("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteUserParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (parsed.data.id === req.user!.userId) {
    res.status(400).json({ error: "Cannot delete your own account" }); return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
