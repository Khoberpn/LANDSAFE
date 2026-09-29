import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, generateToken } from "../middlewares/auth";
import { LoginBody } from "@workspace/api-zod";

const router = Router();
const WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function limited(key: string, maximum: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > maximum;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.strict().safeParse(req.body);
  if (!parsed.success || parsed.data.email.length > 254 || parsed.data.password.length > 128 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.email)) {
    res.status(400).json({ error: "Invalid login request" });
    return;
  }
  const { password, rememberMe } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (limited(`ip:${ip}`, 20) || limited(`account:${ip}:${email}`, 5)) {
    res.setHeader("Retry-After", "900");
    res.status(429).json({ error: "Too many login attempts" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const [updated] = await db.update(usersTable).set({
    lastLogin: new Date(),
    updatedAt: sql`GREATEST(${usersTable.updatedAt} + interval '1 millisecond', now())`,
  }).where(eq(usersTable.id, user.id)).returning();
  attempts.delete(`account:${ip}:${email}`);
  const token = generateToken({
    userId: updated.id, email: updated.email, role: updated.role,
    authVersion: updated.updatedAt.getTime(),
  }, rememberMe);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    token,
    user: {
      id: updated.id, email: updated.email, name: updated.name, role: updated.role,
      isActive: updated.isActive, createdAt: updated.createdAt.toISOString(),
      lastLogin: updated.lastLogin?.toISOString() ?? null,
    },
  });
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  await db.update(usersTable).set({
    updatedAt: sql`GREATEST(${usersTable.updatedAt} + interval '1 millisecond', now())`,
  }).where(eq(usersTable.id, req.user!.userId));
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true });
});

router.post("/auth/change-password", authenticate, async (req, res): Promise<void> => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "currentPassword,newPassword" ||
      typeof body.currentPassword !== "string" || body.currentPassword.length < 1 ||
      body.currentPassword.length > 128 || typeof body.newPassword !== "string" ||
      Buffer.byteLength(body.newPassword, "utf8") < 12 ||
      Buffer.byteLength(body.newPassword, "utf8") > 72) {
    res.status(400).json({ error: "Invalid password change request" }); return;
  }
  const [user] = await db.select({ passwordHash: usersTable.passwordHash })
    .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" }); return;
  }
  if (await bcrypt.compare(body.newPassword, user.passwordHash)) {
    res.status(400).json({ error: "New password must be different" }); return;
  }
  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await db.update(usersTable).set({
    passwordHash,
    updatedAt: sql`GREATEST(${usersTable.updatedAt} + interval '1 millisecond', now())`,
  }).where(eq(usersTable.id, req.user!.userId));
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    id: user.id, email: user.email, name: user.name, role: user.role,
    isActive: user.isActive, createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  });
});

export default router; 
