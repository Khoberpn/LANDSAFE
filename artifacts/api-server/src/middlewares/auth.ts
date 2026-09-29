import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload as VerifiedJwt } from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const secret = process.env.SESSION_SECRET;
if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 bytes");
}
const JWT_SECRET: string = secret;
const ISSUER = "landsafe-api";
const AUDIENCE = "landsafe-dashboard";

export interface JwtPayload {
  userId: number;
  email: string;
  role: "public" | "operator" | "admin";
  authVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? "");
  if (!match) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let token: VerifiedJwt | string;
  try {
    token = jwt.verify(match[1], JWT_SECRET, {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (typeof token === "string" || !Number.isSafeInteger(token.userId) || token.userId <= 0 ||
      !Number.isSafeInteger(token.authVersion) || token.authVersion <= 0) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    const [user] = await db.select({
      id: usersTable.id, email: usersTable.email, role: usersTable.role,
      isActive: usersTable.isActive, updatedAt: usersTable.updatedAt,
    }).from(usersTable).where(eq(usersTable.id, token.userId)).limit(1);
    if (!user || !user.isActive || user.updatedAt.getTime() !== token.authVersion) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = { userId: user.id, email: user.email, role: user.role, authVersion: token.authVersion };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Array<"public" | "operator" | "admin">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function generateToken(payload: JwtPayload, rememberMe = false): string {
  return jwt.sign({ userId: payload.userId, authVersion: payload.authVersion }, JWT_SECRET, {
    algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE,
    expiresIn: rememberMe ? "7d" : "8h",
  });
}