import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting seed...");

  // ─── 1. USERS ────────────────────────────────────────────────────────────────
  console.log("👤 Seeding users...");
  const seedPassword = "password123";
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const userData: schema.InsertUser[] = [
    { email: "admin@landsafe.id", name: "Administrator BNPB", passwordHash, role: "admin", isActive: true },
    { email: "operator1@landsafe.id", name: "Budi Santoso", passwordHash, role: "operator", isActive: true },
    { email: "operator2@landsafe.id", name: "Siti Rahayu", passwordHash, role: "operator", isActive: true },
    { email: "publik@landsafe.id", name: "Warga Umum", passwordHash, role: "public", isActive: true },
  ];
  const insertedUsers = await db
    .insert(schema.usersTable)
    .values(userData)
    .onConflictDoNothing()
    .returning();
  const users = await db
    .select()
    .from(schema.usersTable)
    .where(inArray(schema.usersTable.email, userData.map((user) => user.email)));
  console.log(`  ✓ ${insertedUsers.length} users inserted, ${users.length} available`);

  // ─── 2. LOCATIONS ────────────────────────────────────────────────────────────
  console.log("📍 Seeding locations...");
  const locationData = [
    { name: "Banjarnegara Utara", district: "Banjarnegara", latitude: -7.3897, longitude: 109.6937, elevation: 350, riskLevel: "danger" as const, description: "Lereng terjal dengan riwayat longsor berulang" },
    { name: "Merapi Selatan", district: "Sleman", latitude: -7.6078, longitude: 110.4434, elevation: 862, riskLevel: "alert" as const, description: "Kawasan rawan lahar dan longsoran material vulkanik" },
    { name: "Wonosobo Tengah", district: "Wonosobo", latitude: -7.3606, longitude: 109.9067, elevation: 780, riskLevel: "watch" as const, description: "Daerah perbukitan dengan curah hujan tinggi" },
    { name: "Magelang Barat", district: "Magelang", latitude: -7.4805, longitude: 110.1828, elevation: 320, riskLevel: "normal" as const, description: "Dataran rendah dekat sungai Progo" },
    { name: "Purworejo Selatan", district: "Purworejo", latitude: -7.7155, longitude: 110.0171, elevation: 210, riskLevel: "normal" as const, description: "Kawasan pertanian dengan drainase baik" },
    { name: "Temanggung Timur", district: "Temanggung", latitude: -7.3213, longitude: 110.1861, elevation: 620, riskLevel: "watch" as const, description: "Lereng Sindoro dengan kecuraman sedang" },
    { name: "Kebumen Utara", district: "Kebumen", latitude: -7.5800, longitude: 109.6520, elevation: 175, riskLevel: "alert" as const, description: "Perbukitan gamping dengan potensi longsor" },
    { name: "Cilacap Timur", district: "Cilacap", latitude: -7.7151, longitude: 109.1311, elevation: 48, riskLevel: "normal" as const, description: "Pesisir pantai, pantauan abrasi" },
    { name: "Purbalingga Barat", district: "Purbalingga", latitude: -7.3908, longitude: 109.3638, elevation: 195, riskLevel: "watch" as const, description: "Daerah transisi perbukitan dan dataran" },
    { name: "Banyumas Utara", district: "Banyumas", latitude: -7.3688, longitude: 109.2299, elevation: 310, riskLevel: "normal" as const, description: "Kawasan hutan lindung kaki Slamet" },
  ];

  const existingLocations = await db
    .select()
    .from(schema.locationsTable)
    .where(inArray(schema.locationsTable.name, locationData.map((location) => location.name)));
  const existingLocationNames = new Set(existingLocations.map((location) => location.name));
  const missingLocations = locationData.filter((location) => !existingLocationNames.has(location.name));
  const insertedLocations = missingLocations.length > 0
    ? await db.insert(schema.locationsTable).values(missingLocations).returning()
    : [];
  const seededLocations = [...existingLocations, ...insertedLocations];
  const locations = locationData.map((location) => {
    const match = seededLocations.find((candidate) => candidate.name === location.name);
    if (!match) throw new Error(`Location ${location.name} could not be seeded`);
    return match;
  });
  console.log(`  ✓ ${insertedLocations.length} locations inserted, ${locations.length} available`);

  // ─── 3. SENSORS ──────────────────────────────────────────────────────────────
  console.log("📡 Seeding sensors...");
  const sensorData: schema.InsertSensor[] = [];
  const sensorTypes: schema.InsertSensor["sensorType"][] = [
    "rainfall", "soil_moisture", "tilt", "acceleration", "temperature",
  ];
  locations.forEach((loc, li) => {
    sensorTypes.forEach((type, ti) => {
      const code = `SNS-${String(li + 1).padStart(2, "0")}${String(ti + 1).padStart(2, "0")}`;
      const isOffline = li === 1 && ti === 2; // Merapi Selatan sensor tilt = offline
      sensorData.push({
        locationId: loc.id,
        sensorCode: code,
        sensorType: type,
        status: isOffline ? "offline" : "online",
        batteryLevel: isOffline ? 12 : Math.round(60 + Math.random() * 40),
        signalStrength: isOffline ? 0 : Math.round(70 + Math.random() * 30),
        firmwareVersion: "v2.3.1",
        lastSeen: isOffline ? new Date(Date.now() - 3 * 3600 * 1000) : new Date(),
      });
    });
  });
  const insertedSensors = await db.insert(schema.sensorsTable).values(sensorData).onConflictDoNothing().returning();
  const sensors = await db
    .select()
    .from(schema.sensorsTable)
    .where(inArray(schema.sensorsTable.sensorCode, sensorData.map((sensor) => sensor.sensorCode)));
  console.log(`  ✓ ${insertedSensors.length} sensors inserted, ${sensors.length} available`);

  // ─── 4. MEASUREMENTS ─────────────────────────────────────────────────────────
  console.log("📈 Seeding measurements...");
  const [existingMeasurement] = await db
    .select({ id: schema.measurementsTable.id })
    .from(schema.measurementsTable)
    .limit(1);
  const measurementData: schema.InsertMeasurement[] = [];
  if (!existingMeasurement) {
    const measurementNow = Date.now();
    sensors.forEach((sensor, sensorIndex) => {
      for (let hour = 47; hour >= 0; hour -= 1) {
        const phase = (47 - hour) / 5 + sensorIndex * 0.35;
        const rainfall = Math.max(0, 7 + Math.sin(phase) * 6 + (sensor.locationId % 4) * 2);
        const soilMoisture = Math.min(98, 48 + Math.sin(phase / 2) * 12 + (sensor.locationId % 5) * 4);
        measurementData.push({
          sensorId: sensor.id,
          locationId: sensor.locationId,
          timestamp: new Date(measurementNow - hour * 3_600_000),
          rainfall: Number(rainfall.toFixed(2)),
          soilMoisture: Number(soilMoisture.toFixed(2)),
          tiltAngle: Number((0.3 + Math.sin(phase / 3) * 0.12).toFixed(3)),
          acceleration: Number((0.01 + Math.abs(Math.sin(phase)) * 0.02).toFixed(3)),
          temperature: Number((24 + Math.sin(phase / 4) * 4).toFixed(2)),
          humidity: Number((72 + Math.sin(phase / 3) * 10).toFixed(2)),
          batteryVoltage: Number((12.6 - (47 - hour) * 0.006).toFixed(2)),
          solarCharging: hour >= 7 && hour <= 17 ? 2.4 : 0,
          signalQuality: sensor.status === "offline" ? 0 : sensor.signalStrength,
        });
      }
    });
    await db.insert(schema.measurementsTable).values(measurementData);
  }
  console.log(`  ✓ ${measurementData.length} measurements inserted`);

  // ─── 5. DEVICES ──────────────────────────────────────────────────────────────
  console.log("💻 Seeding devices...");
  const deviceData: schema.InsertDevice[] = locations.map((loc, i) => ({
    deviceId: `DEV-JATENG-${String(i + 1).padStart(3, "0")}`,
    locationId: loc.id,
    firmwareVersion: "v2.3.1",
    status: i === 1 ? ("offline" as const) : ("online" as const),
    batteryLevel: i === 1 ? 8 : Math.round(65 + Math.random() * 35),
    signalStrength: i === 1 ? 0 : Math.round(72 + Math.random() * 28),
    lastCommunication: i === 1 ? new Date(Date.now() - 4 * 3600 * 1000) : new Date(),
    installationDate: new Date("2024-01-15"),
    notes: i === 1 ? "Unit offline — sedang dalam perbaikan" : "Beroperasi normal",
  }));
  const devices = await db.insert(schema.devicesTable).values(deviceData).onConflictDoNothing().returning();
  console.log(`  ✓ ${devices.length} devices inserted`);

  // ─── 5. ALERTS ───────────────────────────────────────────────────────────────
  console.log("🚨 Seeding alerts...");
  const now = new Date();
  const h = (hrs: number) => new Date(now.getTime() - hrs * 3600 * 1000);

  const alertData: (typeof schema.alertsTable.$inferInsert)[] = [
    { locationId: locations[0].id, alertType: "ground_movement", priority: "critical", status: "active", message: "Pergerakan tanah terdeteksi melebihi ambang batas 15mm — evakuasi segera disarankan", createdAt: h(0.5) },
    { locationId: locations[0].id, alertType: "rainfall_warning", priority: "high", status: "active", message: "Curah hujan ekstrem 87mm/jam selama 3 jam — potensi longsor sangat tinggi", createdAt: h(1) },
    { locationId: locations[1].id, alertType: "sensor_offline", priority: "high", status: "active", message: "Sensor SNS-0203 (Tilt) offline — sinyal hilang sejak 09:12 WIB", createdAt: h(2) },
    { locationId: locations[6].id, alertType: "threshold_exceeded", priority: "high", status: "acknowledged", message: "Kadar air tanah 94% — melebihi batas aman untuk jenis tanah lempung", createdAt: h(3), acknowledgedAt: h(2.5) },
    { locationId: locations[2].id, alertType: "rainfall_warning", priority: "medium", status: "active", message: "Peringatan curah hujan sedang — 45mm/jam, pantau perkembangan", createdAt: h(4) },
    { locationId: locations[5].id, alertType: "threshold_exceeded", priority: "medium", status: "acknowledged", message: "Kemiringan lereng meningkat 2.3° dari baseline — perlu inspeksi lapangan", createdAt: h(5), acknowledgedAt: h(4) },
    { locationId: locations[1].id, alertType: "battery_low", priority: "low", status: "active", message: "DEV-JATENG-002: Level baterai kritis 8% — segera kirim tim penggantian", createdAt: h(6) },
    { locationId: locations[3].id, alertType: "emergency_notification", priority: "low", status: "resolved", message: "Notifikasi darurat terkirim ke 250 warga Magelang Barat", createdAt: h(8), resolvedAt: h(7.5) },
    { locationId: locations[0].id, alertType: "earthquake", priority: "critical", status: "resolved", message: "Gempa M3.2 terdeteksi di kedalaman 8km — pantau potensi longsoran lanjutan", createdAt: h(12), resolvedAt: h(11) },
    { locationId: locations[8].id, alertType: "sensor_offline", priority: "medium", status: "resolved", message: "Sensor SNS-0901 kembali online setelah gangguan koneksi 2 jam", createdAt: h(15), resolvedAt: h(13) },
    { locationId: locations[2].id, alertType: "ground_movement", priority: "high", status: "resolved", message: "Pergerakan tanah 8mm terdeteksi — dinyatakan aman setelah inspeksi", createdAt: h(18), resolvedAt: h(16) },
    { locationId: locations[4].id, alertType: "rainfall_warning", priority: "low", status: "resolved", message: "Peringatan hujan lebat berakhir — kondisi kembali normal", createdAt: h(24), resolvedAt: h(22) },
    { locationId: locations[7].id, alertType: "battery_low", priority: "low", status: "resolved", message: "DEV-JATENG-008 baterai terisi penuh setelah pengisian tenaga surya", createdAt: h(30), resolvedAt: h(28) },
    { locationId: locations[3].id, alertType: "threshold_exceeded", priority: "medium", status: "resolved", message: "Debit sungai kembali normal setelah sempat meningkat 40%", createdAt: h(36), resolvedAt: h(34) },
    { locationId: locations[9].id, alertType: "sensor_offline", priority: "low", status: "resolved", message: "Sensor SNS-1001 kembali aktif — kabel power diganti tim lapangan", createdAt: h(48), resolvedAt: h(46) },
  ];
  const [existingAlert] = await db.select({ id: schema.alertsTable.id }).from(schema.alertsTable).limit(1);
  const alerts = existingAlert
    ? []
    : await db.insert(schema.alertsTable).values(alertData).returning();
  console.log(`  ✓ ${alerts.length} alerts inserted`);

  // ─── 6. PREDICTIONS ──────────────────────────────────────────────────────────
  console.log("🧠 Seeding AI predictions...");
  const predictionData: schema.InsertPrediction[] = [
    {
      locationId: locations[0].id,
      riskLevel: "danger",
      probability: 87,
      confidence: 92,
      potentialTriggers: ["Curah hujan >80mm/jam selama 3 jam berturut-turut", "Saturasi tanah mencapai 98%", "Pergerakan lereng 15mm (melebihi ambang batas)"],
      recommendedActions: ["Evakuasi warga dalam radius 500m segera", "Tutup akses jalan di Jl. Raya Banjarnegara KM 7-12", "Aktifkan Posko Darurat BPBD Banjarnegara", "Kerahkan tim SAR ke titik koordinat -7.3897, 109.6937"],
      evacuationSuggested: true,
      explanation: "Model neural network mendeteksi kombinasi faktor risiko tinggi: saturasi tanah di atas ambang kritis (98%), pergerakan lereng yang signifikan (15mm/6jam), dan prakiraan curah hujan lanjutan 60-80mm dalam 12 jam ke depan. Pola ini sangat mirip dengan kejadian longsor Banjarnegara 2014 (kesamaan 91%).",
      historicalSimilarEvents: 7,
      analyzedAt: new Date(),
    },
    {
      locationId: locations[1].id,
      riskLevel: "alert",
      probability: 63,
      confidence: 78,
      potentialTriggers: ["Aktivitas seismik M3.2 terdeteksi 12 jam lalu", "Material vulkanik lepas di lereng atas", "Sensor tilt offline — data tidak lengkap"],
      recommendedActions: ["Tingkatkan frekuensi patroli lereng menjadi setiap 2 jam", "Perbaiki sensor SNS-0203 yang offline", "Informasikan warga tentang status siaga", "Koordinasi dengan BPPTKG Yogyakarta"],
      evacuationSuggested: false,
      explanation: "Aktivitas seismik terdeteksi dapat mendestabilisasi material vulkanik di lereng atas. Risiko diperburuk oleh sensor tilt yang offline sehingga pemantauan tidak optimal. Model merekomendasikan peningkatan kewaspadaan dan perbaikan infrastruktur sensor segera.",
      historicalSimilarEvents: 3,
      analyzedAt: new Date(),
    },
    {
      locationId: locations[2].id,
      riskLevel: "watch",
      probability: 38,
      confidence: 85,
      potentialTriggers: ["Curah hujan moderat 45mm/jam", "Kadar air tanah 72% (mendekati batas waspada)"],
      recommendedActions: ["Pantau data sensor setiap 30 menit", "Siapkan jalur evakuasi sebagai tindakan pencegahan", "Koordinasi dengan kepala desa setempat"],
      evacuationSuggested: false,
      explanation: "Kondisi saat ini menunjukkan status waspada dengan curah hujan moderat dan kadar air tanah yang meningkat namun belum mencapai ambang berbahaya. Sistem akan terus memantau dan memberikan update setiap 6 jam.",
      historicalSimilarEvents: 12,
      analyzedAt: new Date(),
    },
    {
      locationId: locations[3].id,
      riskLevel: "normal",
      probability: 8,
      confidence: 95,
      potentialTriggers: [],
      recommendedActions: ["Lanjutkan pemantauan rutin", "Jadwalkan kalibrasi sensor bulan depan"],
      evacuationSuggested: false,
      explanation: "Semua parameter berada dalam rentang normal. Tidak ada indikator risiko yang signifikan. Sistem beroperasi optimal.",
      historicalSimilarEvents: 0,
      analyzedAt: new Date(),
    },
    {
      locationId: locations[5].id,
      riskLevel: "watch",
      probability: 42,
      confidence: 80,
      potentialTriggers: ["Kemiringan lereng meningkat 2.3° dalam 24 jam", "Curah hujan akumulatif 120mm minggu ini"],
      recommendedActions: ["Lakukan inspeksi lapangan dalam 24 jam", "Pasang patok pemantauan pergerakan tambahan", "Verifikasi kondisi drainase lereng"],
      evacuationSuggested: false,
      explanation: "Peningkatan kemiringan lereng yang konsisten dalam 24 jam terakhir perlu diinvestigasi. Kemungkinan ada pergerakan massa tanah yang belum signifikan namun perlu diwaspadai.",
      historicalSimilarEvents: 5,
      analyzedAt: new Date(),
    },
    {
      locationId: locations[6].id,
      riskLevel: "alert",
      probability: 61,
      confidence: 74,
      potentialTriggers: ["Kadar air tanah 94% — melebihi batas aman", "Formasi geologi lempung rentan likuifaksi", "Drainase lereng terblokir sebagian"],
      recommendedActions: ["Perbaiki saluran drainase yang tersumbat", "Pasang early warning system tambahan", "Sosialisasi prosedur evakuasi ke warga RT 03-07", "Laporkan ke BPBD Kebumen"],
      evacuationSuggested: false,
      explanation: "Kombinasi jenis tanah lempung ekspansif dengan saturasi tinggi menciptakan kondisi rawan. Perbaikan drainase adalah prioritas utama untuk menurunkan risiko.",
      historicalSimilarEvents: 4,
      analyzedAt: new Date(),
    },
  ];
  const [existingPrediction] = await db.select({ id: schema.predictionsTable.id }).from(schema.predictionsTable).limit(1);
  const predictions = existingPrediction
    ? []
    : await db.insert(schema.predictionsTable).values(predictionData).returning();
  console.log(`  ✓ ${predictions.length} predictions inserted`);

  // ─── 7. REPORTS ──────────────────────────────────────────────────────────────
  console.log("📄 Seeding reports...");
  const reportData: schema.InsertReport[] = [
    { reportType: "daily", title: "Laporan Harian — Pemantauan Lereng Jawa Tengah", period: "22 Juli 2026", status: "ready", locationId: null, generatedBy: users[0]?.id, completedAt: new Date() },
    { reportType: "weekly", title: "Laporan Mingguan — Aktivitas Sensor & Peringatan", period: "14–20 Juli 2026", status: "ready", locationId: null, generatedBy: users[0]?.id, completedAt: h(24) },
    { reportType: "monthly", title: "Laporan Bulanan — Analisis Risiko Banjarnegara", period: "Juni 2026", status: "ready", locationId: locations[0].id, generatedBy: users[1]?.id, completedAt: h(48) },
    { reportType: "daily", title: "Laporan Harian — Status Darurat Banjarnegara Utara", period: "21 Juli 2026", status: "ready", locationId: locations[0].id, generatedBy: users[1]?.id, completedAt: h(36) },
    { reportType: "monthly", title: "Laporan Bulanan — Evaluasi Kinerja Sensor Regional", period: "Mei 2026", status: "ready", locationId: null, generatedBy: users[0]?.id, completedAt: h(720) },
    { reportType: "weekly", title: "Laporan Mingguan — Rekap Peringatan & Respons", period: "7–13 Juli 2026", status: "ready", locationId: null, generatedBy: users[2]?.id, completedAt: h(168) },
    { reportType: "annual", title: "Laporan Tahunan — Peta Risiko Bencana Jawa Tengah 2025", period: "2025", status: "ready", locationId: null, generatedBy: users[0]?.id, completedAt: h(2160) },
    { reportType: "daily", title: "Laporan Harian — Sistem Sedang Dibuat", period: "23 Juli 2026", status: "generating", locationId: null, generatedBy: users[1]?.id },
  ];
  const [existingReport] = await db.select({ id: schema.reportsTable.id }).from(schema.reportsTable).limit(1);
  const reports = existingReport
    ? []
    : await db.insert(schema.reportsTable).values(reportData).returning();
  console.log(`  ✓ ${reports.length} reports inserted`);

  // ─── 8. AUDIT LOGS ───────────────────────────────────────────────────────────
  console.log("📋 Seeding audit logs...");
  const auditData: (typeof schema.auditLogsTable.$inferInsert)[] = [
    { userId: users[0]?.id, action: "user.create", entityType: "user", entityId: users[1]?.id, details: JSON.stringify({ email: "operator1@landsafe.id", role: "operator" }), createdAt: h(48) },
    { userId: users[0]?.id, action: "user.create", entityType: "user", entityId: users[2]?.id, details: JSON.stringify({ email: "operator2@landsafe.id", role: "operator" }), createdAt: h(48) },
    { userId: users[0]?.id, action: "location.create", entityType: "location", entityId: locations[0].id, details: JSON.stringify({ name: "Banjarnegara Utara", riskLevel: "danger" }), createdAt: h(72) },
    { userId: users[1]?.id, action: "alert.acknowledge", entityType: "alert", entityId: alerts[3]?.id, details: JSON.stringify({ status: "acknowledged", note: "Tim lapangan sedang menuju lokasi" }), createdAt: h(2.5) },
    { userId: users[1]?.id, action: "alert.resolve", entityType: "alert", entityId: alerts[8]?.id, details: JSON.stringify({ status: "resolved", note: "Situasi terkendali, tidak ada korban" }), createdAt: h(11) },
    { userId: users[2]?.id, action: "report.create", entityType: "report", entityId: reports[0]?.id, details: JSON.stringify({ title: "Laporan Harian", period: "22 Juli 2026" }), createdAt: h(1) },
    { userId: users[0]?.id, action: "location.update", entityType: "location", entityId: locations[1].id, details: JSON.stringify({ riskLevel: { from: "watch", to: "alert" }, reason: "Aktivitas seismik terdeteksi" }), createdAt: h(13) },
    { userId: users[1]?.id, action: "user.login", entityType: "user", entityId: users[1]?.id, details: JSON.stringify({ ip: "192.168.1.45", browser: "Chrome/126" }), createdAt: h(0.5) },
    { userId: users[2]?.id, action: "user.login", entityType: "user", entityId: users[2]?.id, details: JSON.stringify({ ip: "192.168.1.67", browser: "Edge/126" }), createdAt: h(1.5) },
    { userId: users[0]?.id, action: "alert.resolve", entityType: "alert", entityId: alerts[11]?.id, details: JSON.stringify({ status: "resolved" }), createdAt: h(22) },
  ];
  const [existingAuditLog] = await db.select({ id: schema.auditLogsTable.id }).from(schema.auditLogsTable).limit(1);
  const auditLogs = existingAuditLog
    ? []
    : await db.insert(schema.auditLogsTable).values(auditData).returning();
  console.log(`  ✓ ${auditLogs.length} audit logs inserted`);

  console.log("\n✅ Seed selesai! Ringkasan:");
  console.log(`   👤 Users      : ${users.length}`);
  console.log(`   📍 Locations  : ${locations.length}`);
  console.log(`   📡 Sensors    : ${sensors.length}`);
  console.log(`   💻 Devices    : ${devices.length}`);
  console.log(`   🚨 Alerts     : ${alerts.length}`);
  console.log(`   🧠 Predictions: ${predictions.length}`);
  console.log(`   📄 Reports    : ${reports.length}`);
  console.log(`   📋 Audit Logs : ${auditLogs.length}`);
  console.log("\n📌 Akun login tersedia:");

}

seed().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exitCode = 1;
}).finally(() => pool.end());
