import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const password = "password123";
  const hash = await bcrypt.hash(password, 12);
  console.log("Generated hash:", hash);
  const match1 = await bcrypt.compare(password, hash);
  console.log("Match before DB:", match1);
  
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, "admin@landsafe.id"));
  console.log("Password updated successfully in DB");
  
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, "admin@landsafe.id"));
  const match2 = await bcrypt.compare(password, user.passwordHash);
  console.log("Match after DB read:", match2);
  pool.end();
}
main().catch(console.error);
