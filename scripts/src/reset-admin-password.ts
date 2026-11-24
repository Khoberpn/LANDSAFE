import bcrypt from "bcryptjs";
import { db, pool, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const MIN_BYTES = 12;
const MAX_BYTES = 72;

/**
 * Resets the password of an LANDSAFE account (admin by default).
 *
 * Usage:
 *   node --env-file=../artifacts/api-server/.env --import tsx ./src/reset-admin-password.ts [password] [email]
 *
 * Defaults to the built-in administrator account. The `updatedAt` column is
 * bumped so every previously issued JWT is invalidated (the API embeds
 * `authVersion` derived from `updatedAt`).
 */
async function resetAdminPassword() {
  const password = process.argv[2] ?? "Landsafe2026!Admin";
  const email = (process.argv[3] ?? "admin@landsafe.id").trim().toLowerCase();

  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < MIN_BYTES || bytes > MAX_BYTES) {
    throw new Error(`Password must be ${MIN_BYTES}-${MAX_BYTES} bytes (received ${bytes})`);
  }

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (!user) throw new Error(`No account found for ${email}`);

  const passwordHash = await bcrypt.hash(password, 12);
  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash,
      isActive: true,
      updatedAt: sql`GREATEST(${usersTable.updatedAt} + interval '1 millisecond', now())`,
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  const verified = await bcrypt.compare(password, updated.passwordHash);
  if (!verified) throw new Error("Password verification failed after update");

  console.log("🔐 Password reset berhasil:");
  console.log(`   ID       : ${updated.id}`);
  console.log(`   Nama     : ${updated.name}`);
  console.log(`   Email    : ${updated.email}`);
  console.log(`   Role     : ${updated.role}`);
  console.log(`   Aktif    : ${updated.isActive}`);
  console.log(`   Password : ${password}`);
  console.log("   Catatan  : seluruh sesi/token lama otomatis tidak berlaku.");
}

resetAdminPassword()
  .catch((err) => {
    console.error("❌ Reset password gagal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());