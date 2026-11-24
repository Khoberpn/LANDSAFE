import { db, pool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { sql } from "drizzle-orm";

/**
 * Migration and Seed Script for Evacuation Route Intelligence Module
 */

async function ensureTables() {
  console.log("Checking and creating evacuation tables in PostgreSQL if not present...");

  // Enums
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE route_type AS ENUM ('primary', 'alternative');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE hazard_exposure AS ENUM ('none', 'low', 'moderate', 'high');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE route_status AS ENUM ('draft', 'analysis', 'field_verification', 'review', 'approved', 'published', 'archived');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE road_condition AS ENUM ('good', 'fair', 'poor', 'damaged', 'impassable', 'unknown');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  // Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evacuation_routes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      route_code TEXT NOT NULL UNIQUE,
      origin_name TEXT NOT NULL,
      origin_latitude REAL NOT NULL,
      origin_longitude REAL NOT NULL,
      destination_name TEXT NOT NULL,
      destination_latitude REAL NOT NULL,
      destination_longitude REAL NOT NULL,
      destination_facility_id INTEGER,
      region_name TEXT NOT NULL,
      province TEXT NOT NULL DEFAULT 'Central Java',
      hazard_type hazard_type NOT NULL,
      route_type route_type NOT NULL DEFAULT 'primary',
      distance_km REAL NOT NULL DEFAULT 0,
      estimated_time_minutes INTEGER NOT NULL DEFAULT 0,
      max_capacity_persons INTEGER NOT NULL DEFAULT 0,
      elevation_gain_m REAL DEFAULT 0,
      road_surface TEXT,
      is_accessible BOOLEAN NOT NULL DEFAULT false,
      hazard_exposure hazard_exposure NOT NULL DEFAULT 'none',
      route_status route_status NOT NULL DEFAULT 'draft',
      route_geometry JSONB NOT NULL DEFAULT '[]'::jsonb,
      evaluation_notes TEXT,
      public_description TEXT,
      created_by INTEGER,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMPTZ,
      approved_by INTEGER,
      approved_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS route_segments (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL,
      segment_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      start_latitude REAL NOT NULL,
      start_longitude REAL NOT NULL,
      end_latitude REAL NOT NULL,
      end_longitude REAL NOT NULL,
      distance_km REAL NOT NULL DEFAULT 0,
      road_condition road_condition NOT NULL DEFAULT 'unknown',
      road_width TEXT,
      hazard_notes TEXT,
      is_blocked BOOLEAN NOT NULL DEFAULT false,
      blockage_reason TEXT,
      last_inspected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS route_verifications (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL,
      inspector_id INTEGER NOT NULL,
      inspector_name TEXT NOT NULL,
      inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      overall_condition road_condition NOT NULL,
      road_accessible BOOLEAN NOT NULL DEFAULT true,
      signage_adequate BOOLEAN NOT NULL DEFAULT false,
      shelter_ready BOOLEAN NOT NULL DEFAULT false,
      lighting_available BOOLEAN NOT NULL DEFAULT false,
      drainage_adequate BOOLEAN NOT NULL DEFAULT false,
      findings TEXT NOT NULL,
      recommendations TEXT,
      geotag_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
      gps_track JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS evacuation_scenarios (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      hazard_type hazard_type NOT NULL,
      region_name TEXT NOT NULL,
      parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
      candidate_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendation TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("✓ Tables and enums verified in database.");
}

async function seedEvacuationData() {
  console.log("Seeding evacuation routes, segments, verifications, and scenarios...");

  const [existingRoute] = await db
    .select({ id: schema.evacuationRoutesTable.id })
    .from(schema.evacuationRoutesTable)
    .limit(1);

  if (existingRoute) {
    console.log("Evacuation routes already seeded. Skipping initial seed.");
    return;
  }

  // Find operator and admin users for attribution
  const users = await db.select({ id: schema.usersTable.id, role: schema.usersTable.role }).from(schema.usersTable);
  const adminUser = users.find((u) => u.role === "admin") ?? users[0];
  const operatorUser = users.find((u) => u.role === "operator") ?? adminUser;

  // Find some existing facilities
  const facilities = await db
    .select({
      id: schema.facilitiesTable.id,
      name: schema.facilitiesTable.name,
      type: schema.facilitiesTable.type,
      regionName: schema.facilitiesTable.regionName,
    })
    .from(schema.facilitiesTable);

  const baturShelter = facilities.find((f) => f.name.includes("Batur"))?.id ?? null;
  const wanayasaShelter = facilities.find((f) => f.name.includes("Wanayasa"))?.id ?? null;
  const cilacapGor = facilities.find((f) => f.name.includes("GOR Cilacap"))?.id ?? null;
  const moewardiHospital = facilities.find((f) => f.name.includes("Moewardi"))?.id ?? null;
  const merapiRouteFac = facilities.find((f) => f.name.includes("Merapi"))?.id ?? null;
  const bantulShelter = facilities.find((f) => f.name.includes("Bantul"))?.id ?? null;
  const lombokGor = facilities.find((f) => f.name.includes("Lombok"))?.id ?? null;

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  // 1. SEED ROUTES
  const ROUTES_DATA = [
    {
      name: "Jalur Utama Evakuasi Lereng Sijeruk — Shelter Batur",
      routeCode: "EVR-BJN-001",
      originName: "Dusun Sijeruk, Desa Banjarmangu",
      originLatitude: -7.362,
      originLongitude: 109.625,
      destinationName: "Balai Desa Batur — Shelter Utama",
      destinationLatitude: -7.34,
      destinationLongitude: 109.66,
      destinationFacilityId: baturShelter,
      regionName: "Banjarnegara Utara",
      province: "Central Java",
      hazardType: "landslide" as const,
      routeType: "primary" as const,
      distanceKm: 6.8,
      estimatedTimeMinutes: 22,
      maxCapacityPersons: 1200,
      elevationGainM: 110,
      roadSurface: "Aspal hotmix halus, diperkuat talud beton",
      isAccessible: true,
      hazardExposure: "low" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-7.362, 109.625],
        [-7.358, 109.632],
        [-7.353, 109.641],
        [-7.348, 109.65],
        [-7.343, 109.656],
        [-7.34, 109.66],
      ],
      evaluationNotes: "Rute prioritas hasil rekomendasi survei BPBD Jawa Tengah 2026. Jalur telah dipasangi rambu evakuasi fluorescent setiap 200m.",
      publicDescription: "Jalur evakuasi resmi resmi BPBD Banjarnegara untuk warga Dusun Sijeruk & Banjarmangu menuju Shelter Batur. Jalan aspal lebar dengan penerangan surya.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(14),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(10),
      publishedAt: daysAgo(9),
      version: 1,
    },
    {
      name: "Jalur Alternatif Perbukitan Karangkobar — SDN 2 Wanayasa",
      routeCode: "EVR-BJN-002",
      originName: "Dusun Sijeruk, Desa Banjarmangu",
      originLatitude: -7.362,
      originLongitude: 109.625,
      destinationName: "SD Negeri 2 Wanayasa",
      destinationLatitude: -7.31,
      destinationLongitude: 109.71,
      destinationFacilityId: wanayasaShelter,
      regionName: "Banjarnegara Utara",
      province: "Central Java",
      hazardType: "landslide" as const,
      routeType: "alternative" as const,
      distanceKm: 9.4,
      estimatedTimeMinutes: 34,
      maxCapacityPersons: 650,
      elevationGainM: 185,
      roadSurface: "Beton semen rabat & sebagian makadam",
      isAccessible: false,
      hazardExposure: "moderate" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-7.362, 109.625],
        [-7.355, 109.638],
        [-7.342, 109.658],
        [-7.33, 109.68],
        [-7.32, 109.695],
        [-7.31, 109.71],
      ],
      evaluationNotes: "Jalur cadangan apabila jalan utama tertutup material runtuhan tebing km 4. Hanya disarankan untuk kendaraan 4WD dan pejalan kaki siaga.",
      publicDescription: "Rute alternatif kedua menuju SDN 2 Wanayasa bila jalur utama Batur terhalang. Medan menanjak, berhati-hati saat hujan deras.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(12),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(8),
      publishedAt: daysAgo(7),
      version: 1,
    },
    {
      name: "Koridor Evakuasi Tsunami Pesisir Teluk Penyu — GOR Cilacap",
      routeCode: "EVR-CLP-001",
      originName: "Kawasan Pesisir Pantai Teluk Penyu & Kampung Nelayan",
      originLatitude: -7.745,
      originLongitude: 109.022,
      destinationName: "GOR Cilacap Selatan",
      destinationLatitude: -7.73,
      destinationLongitude: 109.01,
      destinationFacilityId: cilacapGor,
      regionName: "Cilacap Selatan",
      province: "Central Java",
      hazardType: "tsunami" as const,
      routeType: "primary" as const,
      distanceKm: 3.2,
      estimatedTimeMinutes: 12,
      maxCapacityPersons: 3500,
      elevationGainM: 14,
      roadSurface: "Aspal 4 lajur dua arah (Jl. Laut & Jl. Nusantara)",
      isAccessible: true,
      hazardExposure: "low" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-7.745, 109.022],
        [-7.741, 109.019],
        [-7.737, 109.015],
        [-7.733, 109.012],
        [-7.73, 109.01],
      ],
      evaluationNotes: "Waktu tempuh berjalan kaki 25 menit, kendaraan 8-12 menit. Jalur vertikal bebas hambatan jembatan rentan roboh.",
      publicDescription: "Rute evakuasi cepat tsunami Teluk Penyu menuju Tempat Evakuasi Sementara (TES) GOR Cilacap. Rambu tsunami tower terpasang sepanjang jalan.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(20),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(16),
      publishedAt: daysAgo(15),
      version: 1,
    },
    {
      name: "Jalur Evakuasi Banjir Rob Genuk — Lapangan Simpang Lima",
      routeCode: "EVR-SMG-001",
      originName: "Kelurahan Trimulyo & Terboyo Wetan, Genuk",
      originLatitude: -6.955,
      originLongitude: 110.468,
      destinationName: "Lapangan Simpang Lima & Posko Terpadu",
      destinationLatitude: -6.99,
      destinationLongitude: 110.42,
      destinationFacilityId: null,
      regionName: "Semarang Timur",
      province: "Central Java",
      hazardType: "flood" as const,
      routeType: "primary" as const,
      distanceKm: 8.5,
      estimatedTimeMinutes: 28,
      maxCapacityPersons: 4000,
      elevationGainM: 25,
      roadSurface: "Arteri primer aspal beton peninggian 60cm",
      isAccessible: true,
      hazardExposure: "moderate" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-6.955, 110.468],
        [-6.962, 110.455],
        [-6.971, 110.442],
        [-6.982, 110.431],
        [-6.99, 110.42],
      ],
      evaluationNotes: "Telah dikoordinasikan dengan Dinas Perhubungan Kota Semarang untuk rekayasa satu arah saat status Siaga Darurat Banjir.",
      publicDescription: "Jalur evakuasi utama banjir rob wilayah pantura Genuk menuju dataran tinggi pusat kota Semarang.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(25),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(22),
      publishedAt: daysAgo(20),
      version: 1,
    },
    {
      name: "Jalur Evakuasi Bencana Erupsi KRB III Merapi — RSUD Tidar",
      routeCode: "EVR-MGL-001",
      originName: "Desa Dukun & Srumbung (Radius 7 Km)",
      originLatitude: -7.568,
      originLongitude: 110.365,
      destinationName: "RSUD Tidar Magelang & Titik Kumpul Aman",
      destinationLatitude: -7.47,
      destinationLongitude: 110.21,
      destinationFacilityId: null,
      regionName: "Magelang Utara",
      province: "Central Java",
      hazardType: "volcanic" as const,
      routeType: "primary" as const,
      distanceKm: 18.2,
      estimatedTimeMinutes: 42,
      maxCapacityPersons: 2800,
      elevationGainM: -420,
      roadSurface: "Jalan provinsi aspal hotmix lebar 7 meter",
      isAccessible: true,
      hazardExposure: "high" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-7.568, 110.365],
        [-7.545, 110.332],
        [-7.52, 110.295],
        [-7.495, 110.252],
        [-7.47, 110.21],
      ],
      evaluationNotes: "Jalur keluar searah barat laut menjauhi bukaan kawah Kali Gendol/Woro. Jembatan Srumbung telah diperkuat terhadap aliran lahar dingin.",
      publicDescription: "Rute resmi evakuasi erupsi Gunung Merapi sektor barat daya menuju fasilitas rujukan medis RSUD Tidar Kota Magelang.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(30),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(26),
      publishedAt: daysAgo(25),
      version: 2,
    },
    {
      name: "Jalur Evakuasi Gempa Patahan Opak — SMPN 1 Bantul",
      routeCode: "EVR-BTL-001",
      originName: "Kecamatan Pleret & Imogiri (Sesar Opak)",
      originLatitude: -7.892,
      originLongitude: 110.395,
      destinationName: "SMP Negeri 1 Bantul (Gedung Tahan Gempa)",
      destinationLatitude: -7.94,
      destinationLongitude: 110.34,
      destinationFacilityId: bantulShelter,
      regionName: "Bantul Selatan",
      province: "DI Yogyakarta",
      hazardType: "earthquake" as const,
      routeType: "primary" as const,
      distanceKm: 7.6,
      estimatedTimeMinutes: 20,
      maxCapacityPersons: 1500,
      elevationGainM: 12,
      roadSurface: "Aspal kabupaten kondisi prima",
      isAccessible: true,
      hazardExposure: "low" as const,
      routeStatus: "published" as const,
      routeGeometry: [
        [-7.892, 110.395],
        [-7.905, 110.381],
        [-7.918, 110.365],
        [-7.93, 110.352],
        [-7.94, 110.34],
      ],
      evaluationNotes: "Struktur SMPN 1 Bantul telah disertifikasi Kementerian PUPR sebagai bangunan tahan gempa magnitudo 8.0.",
      publicDescription: "Jalur evakuasi gempa bumi warga lereng patahan Opak menuju titik shelter aman struktur kokoh SMPN 1 Bantul.",
      createdBy: operatorUser?.id,
      reviewedBy: operatorUser?.id,
      reviewedAt: daysAgo(18),
      approvedBy: adminUser?.id,
      approvedAt: daysAgo(15),
      publishedAt: daysAgo(14),
      version: 1,
    },
    // IN-PROGRESS BPBD WORKFLOW ROUTES (Draft, Review, Field Verification for testing)
    {
      name: "Rencana Rute Khusus Truk Tanggap Darurat Kali Genting",
      routeCode: "EVR-BJN-003",
      originName: "Pusat Evakuasi Desa Kalilunjar",
      originLatitude: -7.38,
      originLongitude: 109.64,
      destinationName: "Pusdalops BPBD Banjarnegara",
      destinationLatitude: -7.4,
      destinationLongitude: 109.69,
      destinationFacilityId: null,
      regionName: "Banjarnegara Utara",
      province: "Central Java",
      hazardType: "landslide" as const,
      routeType: "alternative" as const,
      distanceKm: 5.9,
      estimatedTimeMinutes: 19,
      maxCapacityPersons: 800,
      elevationGainM: 45,
      roadSurface: "Makadam & aspal desa",
      isAccessible: false,
      hazardExposure: "moderate" as const,
      routeStatus: "field_verification" as const,
      routeGeometry: [
        [-7.38, 109.64],
        [-7.386, 109.655],
        [-7.393, 109.672],
        [-7.4, 109.69],
      ],
      evaluationNotes: "Menunggu verifikasi lapangan pasca hujan deras kemarin; dilaporkan retakan jalan sepanjang 15m di Dusun Penusupan.",
      publicDescription: null,
      createdBy: operatorUser?.id,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      publishedAt: null,
      version: 1,
    },
    {
      name: "Draf Rute Baru Shelter Tsunami Kroya Timur",
      routeCode: "EVR-CLP-002",
      originName: "Kecamatan Binangun Pesisir",
      originLatitude: -7.69,
      originLongitude: 109.18,
      destinationName: "Stasiun Kroya & Aula Terbuka",
      destinationLatitude: -7.63,
      destinationLongitude: 109.25,
      destinationFacilityId: null,
      regionName: "Cilacap Selatan",
      province: "Central Java",
      hazardType: "tsunami" as const,
      routeType: "alternative" as const,
      distanceKm: 11.2,
      estimatedTimeMinutes: 32,
      maxCapacityPersons: 1600,
      elevationGainM: 20,
      roadSurface: "Aspal mulus",
      isAccessible: true,
      hazardExposure: "none" as const,
      routeStatus: "draft" as const,
      routeGeometry: [
        [-7.69, 109.18],
        [-7.67, 109.2],
        [-7.65, 109.225],
        [-7.63, 109.25],
      ],
      evaluationNotes: "Draf awal inisiasi BPBD Cilacap untuk pemetaan zona evakuasi baru 2026.",
      publicDescription: null,
      createdBy: operatorUser?.id,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      publishedAt: null,
      version: 1,
    },
  ];

  const createdRoutes = [];
  for (const r of ROUTES_DATA) {
    const [row] = await db.insert(schema.evacuationRoutesTable).values(r as schema.InsertEvacuationRoute).returning();
    if (row) createdRoutes.push(row);
  }
  console.log(`✓ ${createdRoutes.length} evacuation routes inserted.`);

  // 2. SEED SEGMENTS FOR ROUTES
  const primaryBjn = createdRoutes.find((r) => r.routeCode === "EVR-BJN-001");
  if (primaryBjn) {
    await db.insert(schema.routeSegmentsTable).values([
      {
        routeId: primaryBjn.id,
        segmentOrder: 1,
        name: "Ruas Jl. Sijeruk - Pertigaan Banjarmangu",
        startLatitude: -7.362,
        startLongitude: 109.625,
        endLatitude: -7.353,
        endLongitude: 109.641,
        distanceKm: 2.1,
        roadCondition: "good",
        roadWidth: "two_lane",
        hazardNotes: "Talud sisi barat stabil, tidak ada tanda rayapan tanah.",
        isBlocked: false,
        lastInspectedAt: daysAgo(5),
      },
      {
        routeId: primaryBjn.id,
        segmentOrder: 2,
        name: "Ruas Jembatan Kali Blimbing - Wanayasa",
        startLatitude: -7.353,
        startLongitude: 109.641,
        endLatitude: -7.345,
        endLongitude: 109.654,
        distanceKm: 2.7,
        roadCondition: "fair",
        roadWidth: "two_lane",
        hazardNotes: "Penerangan jalan lengkap, aspal ada sambungan ekspansi.",
        isBlocked: false,
        lastInspectedAt: daysAgo(5),
      },
      {
        routeId: primaryBjn.id,
        segmentOrder: 3,
        name: "Ruas Tanjakan Batur - Balai Desa Shelter",
        startLatitude: -7.345,
        startLongitude: 109.654,
        endLatitude: -7.34,
        endLongitude: 109.66,
        distanceKm: 2.0,
        roadCondition: "good",
        roadWidth: "wide",
        hazardNotes: "Akses lebar menuju pelataran parkir logistik & tenda.",
        isBlocked: false,
        lastInspectedAt: daysAgo(5),
      },
    ]);
  }

  const tsunamiClp = createdRoutes.find((r) => r.routeCode === "EVR-CLP-001");
  if (tsunamiClp) {
    await db.insert(schema.routeSegmentsTable).values([
      {
        routeId: tsunamiClp.id,
        segmentOrder: 1,
        name: "Ruas Pesisir Teluk Penyu - Perempatan Jl. Laut",
        startLatitude: -7.745,
        startLongitude: 109.022,
        endLatitude: -7.738,
        endLongitude: 109.016,
        distanceKm: 1.4,
        roadCondition: "good",
        roadWidth: "wide",
        hazardNotes: "Zona genangan rendaman tsunami; harus segera dilalui dalam < 10 menit.",
        isBlocked: false,
        lastInspectedAt: daysAgo(10),
      },
      {
        routeId: tsunamiClp.id,
        segmentOrder: 2,
        name: "Ruas Jl. Nusantara - Gerbang Utama GOR Cilacap",
        startLatitude: -7.738,
        startLongitude: 109.016,
        endLatitude: -7.73,
        endLongitude: 109.01,
        distanceKm: 1.8,
        roadCondition: "good",
        roadWidth: "wide",
        hazardNotes: "Elevasi tanah naik ke +14 meter dpl, aman dari hempasan tsunami.",
        isBlocked: false,
        lastInspectedAt: daysAgo(10),
      },
    ]);
  }

  const unverifiedBjn = createdRoutes.find((r) => r.routeCode === "EVR-BJN-003");
  if (unverifiedBjn) {
    await db.insert(schema.routeSegmentsTable).values([
      {
        routeId: unverifiedBjn.id,
        segmentOrder: 1,
        name: "Ruas Dusun Penusupan Km 2",
        startLatitude: -7.38,
        startLongitude: 109.64,
        endLatitude: -7.39,
        endLongitude: 109.665,
        distanceKm: 2.9,
        roadCondition: "damaged",
        roadWidth: "narrow",
        hazardNotes: "Ada retakan memanjang 15m kedalaman 30cm pasca hujan lebat.",
        isBlocked: true,
        blockageReason: "Amblesan badan jalan; hanya bisa dilalui roda dua darurat.",
        lastInspectedAt: daysAgo(2),
      },
      {
        routeId: unverifiedBjn.id,
        segmentOrder: 2,
        name: "Ruas Sambungan Pusdalops",
        startLatitude: -7.39,
        startLongitude: 109.665,
        endLatitude: -7.4,
        endLongitude: 109.69,
        distanceKm: 3.0,
        roadCondition: "good",
        roadWidth: "two_lane",
        hazardNotes: "Akses lancar.",
        isBlocked: false,
        lastInspectedAt: daysAgo(2),
      },
    ]);
  }
  console.log("✓ Route segments inserted.");

  // 3. SEED ROUTE VERIFICATIONS
  if (primaryBjn) {
    await db.insert(schema.routeVerificationsTable).values({
      routeId: primaryBjn.id,
      inspectorId: operatorUser?.id ?? 1,
      inspectorName: "Budi Santoso, S.T. (Tim Reaksi Cepat BPBD Banjarnegara)",
      inspectionDate: daysAgo(6),
      overallCondition: "good",
      roadAccessible: true,
      signageAdequate: true,
      shelterReady: true,
      lightingAvailable: true,
      drainageAdequate: true,
      findings: "Inspeksi gabungan bersama Koramil & Polsek. Jalur mulus, rambu penunjuk arah baru terpasang jelas setiap persimpangan. Selokan kiri kanan jalan telah dinormalisasi.",
      recommendations: "Lakukan pengecekan berkala sensor tiltmeter di titik lereng km 3.2 menjelang puncak musim penghujan.",
      geotagPhotos: [
        {
          url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80",
          latitude: -7.353,
          longitude: 109.641,
          caption: "Rambu evakuasi fluorescent di Jembatan Kali Blimbing",
        },
        {
          url: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=600&auto=format&fit=crop&q=80",
          latitude: -7.34,
          longitude: 109.66,
          caption: "Pelataran dan aula Shelter Balai Desa Batur siap tampung pengungsi",
        },
      ],
      gpsTrack: [
        [-7.362, 109.625],
        [-7.358, 109.632],
        [-7.353, 109.641],
        [-7.348, 109.65],
        [-7.343, 109.656],
        [-7.34, 109.66],
      ],
    });
  }

  if (tsunamiClp) {
    await db.insert(schema.routeVerificationsTable).values({
      routeId: tsunamiClp.id,
      inspectorId: operatorUser?.id ?? 1,
      inspectorName: "Siti Rahayu, M.Si. (Kasi Pencegahan BPBD Cilacap)",
      inspectionDate: daysAgo(11),
      overallCondition: "good",
      roadAccessible: true,
      signageAdequate: true,
      shelterReady: true,
      lightingAvailable: true,
      drainageAdequate: true,
      findings: "Simulasi mandiri warga nelayan Teluk Penyu berjalan lancar dengan waktu evakuasi rata-rata 14 menit ke GOR Cilacap. Sirine EWS tsunami terdengar jelas radius 2 km.",
      recommendations: "Pangkas ranting pohon peneduh di ruas Jl. Laut agar tidak menutupi papan peringatan tinggi gelombang.",
      geotagPhotos: [
        {
          url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=600&auto=format&fit=crop&q=80",
          latitude: -7.741,
          longitude: 109.019,
          caption: "Papan penunjuk arah Tempat Evakuasi Sementara (TES) Tsunami",
        },
      ],
      gpsTrack: [
        [-7.745, 109.022],
        [-7.741, 109.019],
        [-7.737, 109.015],
        [-7.733, 109.012],
        [-7.73, 109.01],
      ],
    });
  }
  console.log("✓ Route verifications inserted.");

  // 4. SEED SCENARIOS
  await db.insert(schema.evacuationScenariosTable).values([
    {
      name: "Simulasi Kontingensi Curah Hujan Ekstrem 250mm/hari — Lereng Sijeruk",
      description: "Analisis rute evakuasi komparatif bila ruas utama terdampak longsor sedang di km 4.",
      hazardType: "landslide",
      regionName: "Banjarnegara Utara",
      parameters: {
        rainfallIntensityMm: 250,
        groundSaturationPercent: 88,
        affectedVillages: ["Sijeruk", "Banjarmangu", "Kebutuh"],
        targetPopulation: 1450,
        blockedRoadProbability: 0.72,
      },
      candidateRoutes: [
        {
          routeId: primaryBjn?.id,
          name: "Jalur Utama Batur (EVR-BJN-001)",
          score: 84.5,
          travelTime: 22,
          hazardExposure: "low",
          notes: "Rute tercepat & paling landai, namun perlu pantauan sensor tiltmeter di km 4.",
        },
        {
          routeId: createdRoutes.find((r) => r.routeCode === "EVR-BJN-002")?.id,
          name: "Jalur Alternatif Wanayasa (EVR-BJN-002)",
          score: 72.0,
          travelTime: 34,
          hazardExposure: "moderate",
          notes: "Cadangan apabila material longsor menutup jembatan Kali Blimbing.",
        },
      ],
      recommendation: "Gunakan Rute Utama Batur sebagai instruksi resmi prioritas 1. Siagakan tim loader PUPR di simpang Banjarmangu untuk antisipasi material limpasan tebing.",
      status: "completed",
      createdBy: operatorUser?.id,
    },
    {
      name: "Simulasi Tsunami Megathrust Magnitudo 8.8 — Pantai Selatan Jawa",
      description: "Simulasi waktu jeda evakuasi (golden time) 20 menit sebelum gelombang pasang mencapai bibir pantai.",
      hazardType: "tsunami",
      regionName: "Cilacap Selatan",
      parameters: {
        earthquakeMagnitude: 8.8,
        tsunamiWaveHeightM: 12.5,
        estimatedArrivalTimeMin: 21,
        evacuationMode: "Campuran (Jalan Kaki & Sepeda Motor)",
        evacueeCount: 4200,
      },
      candidateRoutes: [
        {
          routeId: tsunamiClp?.id,
          name: "Koridor GOR Cilacap (EVR-CLP-001)",
          score: 91.2,
          travelTime: 12,
          hazardExposure: "low",
          notes: "Rute paling optimal dengan kapasitas tampung TES tertinggi dan elevasi aman.",
        },
      ],
      recommendation: "Instruksikan warga meninggalkan kendaraan roda empat di rumah untuk menghindari kemacetan di persimpangan Jl. Laut.",
      status: "completed",
      createdBy: operatorUser?.id,
    },
  ]);
  console.log("✓ Evacuation scenarios inserted.");

  console.log("🎉 Evacuation intelligence module seed completed successfully!");
}

async function main() {
  try {
    await ensureTables();
    await seedEvacuationData();
  } catch (err) {
    console.error("Migration/seed error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
