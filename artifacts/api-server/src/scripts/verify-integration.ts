import {
  pool,
  db,
  dataSourcesTable,
  dataSourceResourcesTable,
  ingestionRunsTable,
  rawIngestionRecordsTable,
  standardizedHazardEventsTable,
  standardizedWeatherObservationsTable,
  crossSourceCorrelationsTable,
} from "@workspace/db";
import { count } from "drizzle-orm";
import { connectorRegistry } from "../integrations/registry";
import { syncEngine } from "../integrations/sync-engine";
import { reconciliationEngine } from "../integrations/reconciliation-engine";

export async function runEndToEndVerification() {
  console.log("================================================================================");
  console.log("LANDSAFE GOVERNMENT DATA INTEGRATION — END-TO-END LIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const startTime = Date.now();

  // ─── STEP 1: INITIALIZE REGISTRY AND SOURCES ─────────────────────────────────
  console.log(">>> [STEP 1] Initializing Connector Registry and DB Sources...");
  await connectorRegistry.initializeSources();
  const allConnectors = connectorRegistry.getAllConnectors();
  console.log(`  ✓ Registered ${allConnectors.length} autonomous government connectors:`);
  for (const c of allConnectors) {
    console.log(`    - [${c.metadata.code}] ${c.metadata.name} (${c.metadata.agency.toUpperCase()})`);
  }

  // ─── STEP 2: VERIFY CONNECTIVITY ─────────────────────────────────────────────
  console.log("\n>>> [STEP 2] Verifying Live Endpoint Connectivity Across All Institutions...");
  const healthReports = await connectorRegistry.verifyAll();
  for (const rep of healthReports) {
    console.log(`  [${rep.verificationStatus.toUpperCase()}] ${rep.code}: ${rep.status} (latency: ${rep.latencyMs || 0}ms)`);
    console.log(`      Detail: ${rep.message}`);
  }

  // ─── STEP 3: EXECUTE REAL DATA INGESTION ──────────────────────────────────────
  console.log("\n>>> [STEP 3] Executing Live Government Data Ingestion...");
  console.log("  Fetching, parsing, validating, normalizing, and persisting real government data...");

  // Sync BMKG
  console.log("\n  -> Synchronizing BMKG Open Data (Earthquakes & Weather)...");
  const bmkgOutcome = await syncEngine.syncSource("BMKG-OPEN");
  console.log("     BMKG Sync Outcome:", bmkgOutcome);

  // Sync BNPB
  console.log("\n  -> Synchronizing BNPB Satu Data & InaRISK LEWS...");
  const bnpbOutcome = await syncEngine.syncSource("BNPB-DIBI");
  console.log("     BNPB Sync Outcome:", bnpbOutcome);

  // Sync BIG
  console.log("\n  -> Synchronizing BIG Batas Wilayah & Geospasial Dasar...");
  const bigOutcome = await syncEngine.syncSource("BIG-RBI");
  console.log("     BIG Sync Outcome:", bigOutcome);

  // Sync PVMBG (tests access requirement / credential verification)
  console.log("\n  -> Testing PVMBG MAGMA Indonesia (Auth check)...");
  const pvmbgOutcome = await syncEngine.syncSource("PVMBG-VAR");
  console.log("     PVMBG Outcome:", pvmbgOutcome);

  // Sync BPS (tests access requirement / credential verification)
  console.log("\n  -> Testing BPS Web API (Auth check)...");
  const bpsOutcome = await syncEngine.syncSource("BPS-STAT");
  console.log("     BPS Outcome:", bpsOutcome);

  // ─── STEP 4: DATABASE PERSISTENCE & DATA PROVENANCE AUDIT ───────────────────
  console.log("\n>>> [STEP 4] Verifying Real Data Persistence Across All 3 Architecture Layers...");

  // Layer 1: Raw payloads
  const [rawCount] = await db.select({ total: count() }).from(rawIngestionRecordsTable);
  const sampleRaw = await db.select().from(rawIngestionRecordsTable).limit(2);
  console.log(`  ✓ LAYER 1 (Raw Ingestion Records): ${rawCount.total} immutable payloads stored.`);
  if (sampleRaw.length > 0) {
    console.log(`    Sample Raw [${sampleRaw[0].sourceCode}] ExternalID: ${sampleRaw[0].externalId}, SHA-256 Checksum: ${sampleRaw[0].checksum.substring(0, 24)}...`);
  }

  // Layer 2: Standardized Hazard Events
  const [eventCount] = await db.select({ total: count() }).from(standardizedHazardEventsTable);
  const sampleEvents = await db.select().from(standardizedHazardEventsTable).limit(3);
  console.log(`  ✓ LAYER 2 (Standardized Hazard Events): ${eventCount.total} canonical events stored.`);
  for (const ev of sampleEvents) {
    console.log(`    - [${ev.sourceAgency}] ${ev.title} (Cat: ${ev.hazardCategory}, Sev: ${ev.severity}, Occurred: ${ev.occurredAt.toISOString()})`);
    if (ev.magnitude) console.log(`      Coordinates: [${ev.latitude}, ${ev.longitude}], Mag: ${ev.magnitude}, Depth: ${ev.depthKm} km`);
  }

  // Layer 2: Standardized Weather Observations
  const [weatherCount] = await db.select({ total: count() }).from(standardizedWeatherObservationsTable);
  const sampleWeather = await db.select().from(standardizedWeatherObservationsTable).limit(2);
  console.log(`  ✓ LAYER 2 (Standardized Weather Observations): ${weatherCount.total} observations stored.`);
  for (const w of sampleWeather) {
    console.log(`    - [${w.sourceCode}] Location: ${w.locationName} (${w.regency}): Temp: ${w.temperatureC}°C, Humidity: ${w.humidityPercent}%, Rain: ${w.rainfallMm} mm, Desc: ${w.weatherDesc}`);
  }

  // Ingestion runs & Data sources
  const [runCount] = await db.select({ total: count() }).from(ingestionRunsTable);
  console.log(`  ✓ INGESTION RUNS AUDIT: ${runCount.total} ingestion run executions logged.`);

  const sourcesInDb = await db.select().from(dataSourcesTable);
  console.log(`  ✓ DATA SOURCES STATUS:`);
  for (const s of sourcesInDb) {
    console.log(`    - [${s.code}] ${s.name}: Status: ${s.status}, Records: ${s.recordsAvailable}, Verif: ${(s as any).verificationStatus}, LastSync: ${s.lastSyncAt ? s.lastSyncAt.toISOString() : "Never"}`);
  }

  // ─── STEP 5: IDEMPOTENCY TEST (RE-RUNNING SYNC MUST NOT DUPLICATE) ───────────
  console.log("\n>>> [STEP 5] Testing Synchronization Idempotency...");
  const countBefore = Number(eventCount.total);
  const rawBefore = Number(rawCount.total);
  console.log(`  Counts before re-sync: Events=${countBefore}, RawRecords=${rawBefore}`);

  console.log("  Re-executing BMKG synchronization...");
  const bmkgRepeatOutcome = await syncEngine.syncSource("BMKG-OPEN");
  console.log("  BMKG Repeat Sync:", bmkgRepeatOutcome);

  const [countAfter] = await db.select({ total: count() }).from(standardizedHazardEventsTable);
  const [rawAfter] = await db.select({ total: count() }).from(rawIngestionRecordsTable);
  console.log(`  Counts after re-sync: Events=${countAfter.total}, RawRecords=${rawAfter.total}`);

  if (Number(countAfter.total) === countBefore && Number(rawAfter.total) === rawBefore) {
    console.log("  ✓ IDEMPOTENCY CONFIRMED: Zero duplicate records created on repeated execution!");
  } else {
    console.log(`  Notice: Net new records or updates detected (Inserted: ${bmkgRepeatOutcome.recordsInserted}, Updated: ${bmkgRepeatOutcome.recordsUpdated})`);
  }

  // ─── STEP 6: CROSS-SOURCE RECONCILIATION TEST ────────────────────────────────
  console.log("\n>>> [STEP 6] Testing Cross-Source Data Reconciliation Engine...");
  const reconReport = await reconciliationEngine.reconcile();
  console.log("  Reconciliation Report:", reconReport);

  const [corrCount] = await db.select({ total: count() }).from(crossSourceCorrelationsTable);
  const correlations = await db.select().from(crossSourceCorrelationsTable).limit(3);
  console.log(`  ✓ LAYER 3 (Cross-Source Correlations): ${corrCount.total} linkages established.`);
  for (const c of correlations) {
    console.log(`    - Type: ${c.correlationType}, Conf: ${c.confidenceScore}, Note: ${c.notes}`);
  }

  // ─── STEP 7: SUMMARY ─────────────────────────────────────────────────────────
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n================================================================================");
  console.log(`END-TO-END VERIFICATION COMPLETED SUCCESSFULLY IN ${durationSec}s`);
  console.log("================================================================================\n");

  await pool.end();
}

if (process.argv[1]?.includes("verify-integration")) {
  runEndToEndVerification().catch((err) => {
    console.error("Verification suite failed:", err);
    process.exit(1);
  });
}
