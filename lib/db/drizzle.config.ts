import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/users.ts",
    "./src/schema/location.ts", 
    "./src/schema/sensors.ts",
    "./src/schema/measurement.ts", // Sesuaikan jika nama file Anda meansurement.ts (pakai 'n')
    "./src/schema/alert.ts",
    "./src/schema/devices.ts",
    "./src/schema/reports.ts",
    "./src/schema/audit.ts",
    "./src/schema/prediction.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});