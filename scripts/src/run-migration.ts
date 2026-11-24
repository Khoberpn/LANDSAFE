import { pool } from "@workspace/db";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  console.log("Applying Migration 0002: Government Data Integration...");
  const sqlPath = path.resolve(__dirname, "../../lib/db/migrations/0002_government_data_integration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sqlContent);
    await client.query("COMMIT");
    console.log("Migration 0002 applied successfully!");

    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log("Updated tables list:", tables.rows.map((r) => r.table_name));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error("Error executing migration:", err);
  process.exit(1);
});
