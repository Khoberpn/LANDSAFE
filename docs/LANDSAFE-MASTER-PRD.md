# LANDSAFE
## MASTER PRODUCT REQUIREMENTS DOCUMENT
### Platform Architecture Refactoring & Multi-Hazard Intelligence
**GLOBAL BASIS HACKATHON 2027**  
*Version 1.0 | 23 November 2026 | Indonesian Language*  
**PRODUCT DIRECTION: Evidence-based Disaster Intelligence & Decision Support System**

> **Dokumen acuan untuk menata dan mengembangkan sistem LANDSAFE yang sudah ada.**  
> *Bukan instruksi untuk membangun ulang aplikasi dari nol.*

---

## Kontrol Dokumen

| Elemen | Ketetapan |
| :--- | :--- |
| **Nama dokumen** | LANDSAFE Master PRD — Platform Architecture Refactoring & Multi-Hazard Intelligence |
| **Versi / tanggal** | v1.0 / 23 November 2026 |
| **Status** | Baseline produk yang disepakati; detail teknis dikonfirmasi lewat audit repository |
| **Tujuan utama** | Menata arsitektur informasi dan modul existing, menambahkan kapabilitas operasional, dan menetapkan strategi integrasi model kebencanaan |
| **Target implementasi** | Global BASIS Hackathon 2027 |
| **Wilayah pilot** | Multi-provinsi: Jawa Tengah, Sumatera Barat, Sulawesi Utara *(kandidat awal; perlu validasi cakupan data dan mitra)* |
| **Stack existing yang menjadi asumsi** | Node.js ESM, Express v5, Drizzle ORM, PostgreSQL, Python untuk analitik/ML; seluruhnya wajib diverifikasi saat audit |
| **Prinsip perubahan** | Brownfield refactor, additive migration, backward compatibility, no destructive changes |

> [!IMPORTANT]
> **PENTING:** PRD ini menetapkan kebutuhan produk dan arah arsitektur. PRD tidak menyatakan bahwa API, data, model global, PostGIS, atau fitur yang direncanakan sudah terhubung atau telah lulus validasi.

---

## Riwayat Perubahan

| Versi | Tanggal | Perubahan |
| :--- | :--- | :--- |
| 1.0 | 23 Nov 2026 | Arsitektur navigasi final, tiga modul operasional baru, desain model intelligence, backlog, dan kriteria penerimaan. |

---

## Cakupan Dokumen
Dokumen ini memuat arsitektur informasi final, kebutuhan fungsional tiap modul, role dan permission, alur kerja operasional, arsitektur teknis target, model data dan provenance, riset portofolio model kebencanaan global, strategi adaptasi dan validasi lokal, tata kelola AI, backlog implementasi, acceptance criteria, serta registry sumber dan referensi.

> [!NOTE]
> **CARA MEMBACA:** Bagian 1–9 menetapkan produk dan arsitektur aplikasi. Bagian 10–13 menetapkan strategi model, pelatihan, dan assistant. Bagian 14–18 menetapkan tata kelola, backlog, pengujian, dan risiko. Lampiran berisi registry dan sumber riset.

---

## 1. Ringkasan Eksekutif
LANDSAFE adalah platform *Disaster Intelligence* dan *Decision Support* yang telah memiliki sejumlah modul pemantauan, pemetaan, kajian risiko, analisis, mitigasi, evakuasi, integrasi data, perangkat, pelaporan, dan administrasi. Fokus PRD ini bukan mengganti seluruh aplikasi, melainkan menata ulang struktur navigasi dan tanggung jawab modul, memperkuat alur operasional, serta menambahkan tiga kapabilitas inti yang belum terlihat eksplisit pada struktur existing:
1. **Incident & Operations Management**
2. **Resource & Logistics Management**
3. **Rapid Assessment & Field Reporting**

Arah produk final adalah **Evidence-based Disaster Intelligence & Decision Support System**. Sistem harus membedakan informasi resmi instansi, data/model eksternal, hasil analisis LANDSAFE, laporan lapangan yang belum diverifikasi, dan keputusan yang telah disahkan manusia. LANDSAFE bukan otoritas penerbit peringatan resmi dan tidak boleh membuat keputusan evakuasi, pengerahan, atau komando secara otonom.

> [!TIP]
> **KEPUTUSAN PRODUK:** Gunakan arsitektur multi-hazard berbasis model khusus per bahaya (*expert-model portfolio*), bukan satu model AI universal. Adopsi hasil model global jika akses dan lisensinya memungkinkan; lakukan kalibrasi/pelatihan model lokal hanya jika data berlabel dan evaluasinya memadai.

### Hasil utama yang dituju
- Navigasi tujuh kelompok menu yang konsisten dan berbasis siklus penanggulangan bencana.
- Fitur existing dipertahankan melalui refactor bertahap dan migrasi non-destruktif.
- Tiga modul operasional baru menghubungkan peringatan/analisis dengan verifikasi lapangan, tugas, sumber daya, dan pelaporan.
- Government Data Integration Hub mencatat sumber, lisensi, waktu publikasi, waktu pengambilan, versi, kualitas, dan status freshness.
- Model Registry menyimpan informasi cakupan, versi, lisensi, input, batasan, metrik validasi, dan status persetujuan tiap model.
- AI menyajikan rekomendasi yang dapat dijelaskan, ditelusuri, dan ditinjau operator; keputusan final tetap pada personel berwenang.

---

## 2. Konteks Produk dan Prinsip Desain

### 2.1 Kondisi Existing
Struktur menu existing yang disampaikan pemilik produk mencakup:
- Dashboard, Peta Langsung, Peta Rute Evakuasi, Digital Twin, Analitik Sensor, Pusat Peringatan, Perangkat, Kajian Risiko, Analisis Skenario, Perencanaan Mitigasi, Manajemen Rute Evakuasi, Hub Integrasi Data, AI Analytic, Laporan, Pengguna, dan Audit.

Struktur ini sudah kaya fitur, tetapi beberapa menu memiliki kedekatan fungsi dan belum membentuk alur operasi insiden secara utuh.

### 2.2 Prinsip Produk

| Prinsip | Implikasi |
| :--- | :--- |
| **Evidence first** | Setiap insight penting menampilkan sumber, waktu data, versi, cakupan, dan keterbatasan. |
| **Authority preservation** | Peringatan resmi tidak boleh ditimpa atau dinaikkan/diturunkan oleh skor AI LANDSAFE. |
| **Human accountability** | Operator berwenang menyetujui, mengubah, atau menolak rekomendasi dan semua keputusan dicatat. |
| **Brownfield, not rewrite** | Pertahankan modul, database, autentikasi, dan alur yang valid; refactor bertahap. |
| **Offline/degraded-aware** | Kegagalan koneksi eksternal tidak boleh menghilangkan data terakhir; status stale/unavailable terlihat. |
| **Multi-hazard, not one-model-for-all** | Gunakan metode dan model yang sesuai per jenis bahaya. |
| **Local validation** | Model global menjadi benchmark atau supplementary signal; kelayakan operasional di Indonesia harus diuji lokal. |
| **Accessible operations** | Antarmuka responsif, dapat dipakai di perangkat lapangan, dan menampilkan informasi yang mudah dipahami. |

### 2.3 Rujukan Tata Kelola
Struktur produk mengikuti empat prioritas Sendai Framework: memahami risiko, memperkuat tata kelola risiko, berinvestasi pada pengurangan risiko, dan meningkatkan kesiapsiagaan/respons serta *Build Back Better*. Ini merupakan kerangka kebijakan global, bukan pengganti regulasi dan kewenangan Indonesia. [R01]

---

## 3. Tujuan, Non-Tujuan, dan Batasan

### 3.1 Tujuan
1. Menyatukan menu dan tanggung jawab modul tanpa menghilangkan kapabilitas yang sudah berfungsi.
2. Membangun alur dari situational awareness ke incident management, field assessment, response planning, dan evaluation.
3. Mengintegrasikan sumber data pemerintah Indonesia serta sumber global sebagai pelengkap dengan provenance dan status akses yang jelas.
4. Menyediakan portfolio model multi-hazard untuk banjir, longsor, gempa, kebakaran hutan/lahan, siklon tropis, dan konteks multi-hazard.
5. Membangun validasi lokal dan pemantauan performa model sebelum hasilnya digunakan untuk rekomendasi yang sensitif.

### 3.2 Non-tujuan
- Tidak membangun ulang frontend/backend dari nol.
- Tidak mengganti database atau menghapus tabel existing secara destruktif.
- Tidak menerbitkan peringatan resmi atas nama BMKG, BNPB, PVMBG, atau lembaga lain.
- Tidak memprediksi waktu/lokasi pasti gempa bumi.
- Tidak mengotomatisasi perintah evakuasi, dispatch personel, atau keputusan komando.
- Tidak mengklaim semua koneksi pemerintah atau model global selalu real-time.
- Tidak melakukan retraining model pihak ketiga yang tidak menyediakan hak atau perangkat retraining.

### 3.3 Batasan dan Asumsi
PRD disusun tanpa inspeksi repository dan database terkini. Nama modul, stack, status autentikasi, kemampuan spasial, dan integrasi yang sudah ada harus diperiksa dalam Sprint 0. Sebutan PostGIS adalah target capability, bukan asumsi bahwa ekstensi telah tersedia. Model global dan data pihak ketiga tunduk pada ketersediaan geografis, lisensi, atribusi, SLA, API key, atau persetujuan akses masing-masing.

---

## 4. Arsitektur Informasi dan Menu Final

Navigasi utama terdiri dari tujuh kelompok. Semua menu existing dipertahankan secara fungsional, tetapi beberapa dipindah menjadi submenu agar pengalaman pengguna lebih jelas. Tiga menu baru ditambahkan sebagai modul utama pada Emergency Operations.

| Kelompok navigasi | Menu / submenu final | Status |
| :--- | :--- | :--- |
| **01. Overview** | Dashboard | Existing; pertahankan |
| **02. Situational Awareness** | Peta Langsung; Pusat Peringatan; Analitik Sensor | Existing; kelompokkan ulang |
| **03. Risk & Intelligence** | Kajian Risiko; Analisis Skenario; Digital Twin; AI Analytics | Existing; kelompokkan ulang |
| **04. Preparedness & Mitigation** | Perencanaan Mitigasi; Rencana Kontingensi; Simulasi / Tabletop Exercise | Perencanaan Mitigasi existing; dua submenu baru |
| **05. Emergency Operations** | Manajemen Insiden & Operasi; Kaji Cepat & Pelaporan Lapangan; Manajemen Sumber Daya & Logistik; Peta Rute Evakuasi; Manajemen Rute Evakuasi; Shelter & Evacuee Management | Tiga menu utama baru; fungsi evakuasi existing; shelter sebagai submenu baru |
| **06. Data & Infrastructure** | Hub Integrasi Data; Manajemen Perangkat IoT | Existing; klarifikasi nama Perangkat |
| **07. Reporting & Administration** | Laporan; Pengguna & Hak Akses; Audit Logs; Pengaturan | Existing; kelompokkan ulang |

### 4.1 Aturan Navigasi
1. Menu utama tidak boleh menjadi duplikasi tampilan atau duplikasi fungsi dari menu lain.
2. **Peta Langsung** untuk situational awareness; **Peta Rute Evakuasi** untuk visualisasi hasil rute publik; **Manajemen Rute Evakuasi** untuk mengelola, memvalidasi, dan mempublikasikan status rute.
3. **Manajemen Perangkat IoT** hanya untuk perangkat IoT/sensor. Sumber daya personel, kendaraan, stok, peralatan logistik, dan shelter dikelola pada **Resource & Logistics Management**.
4. **Digital Twin** dan **AI Analytics** tetap ada, tetapi tidak boleh memberi kesan validasi ilmiah tanpa model, input, dan metrik yang terdokumentasi.
5. Tampilan menu mengikuti role dan permission; menu tersembunyi bukan pengganti backend authorization.

### 4.2 Struktur Navigasi Ringkas
```text
OVERVIEW
  └── Dashboard

SITUATIONAL AWARENESS
  ├── Live Map (Peta Langsung)
  ├── Alert Center (Pusat Peringatan)
  └── Sensor Analytics (Analitik Sensor)

RISK & INTELLIGENCE
  ├── Risk Assessment (Kajian Risiko)
  ├── Scenario Analysis (Analisis Skenario)
  ├── Digital Twin
  └── AI Analytics

PREPAREDNESS & MITIGATION
  ├── Mitigation Planning (Perencanaan Mitigasi)
  ├── Contingency Plans (Rencana Kontingensi)
  └── Exercises (Simulasi / Tabletop)

EMERGENCY OPERATIONS
  ├── Incident & Operations Management (Manajemen Insiden & Operasi)
  ├── Rapid Assessment & Field Reporting (Kaji Cepat & Pelaporan Lapangan)
  ├── Resource & Logistics Management (Manajemen Sumber Daya & Logistik)
  ├── Evacuation Map (Peta Rute Evakuasi Publik)
  ├── Evacuation Route Management (Manajemen Rute Evakuasi)
  └── Shelter Management (Manajemen Shelter & Pengungsi)

DATA & INFRASTRUCTURE
  ├── Government Data Integration Hub (Hub Integrasi Data)
  └── IoT Device Management (Manajemen Perangkat IoT)

REPORTING & ADMINISTRATION
  ├── Reports (Laporan)
  ├── Users & Permissions (Pengguna & Hak Akses)
  ├── Audit Logs (Log Audit)
  └── Settings (Pengaturan)
```

---

## 5. Kebutuhan Fungsional per Modul

### 5.1 Overview — Dashboard
- Menampilkan ringkasan peringatan resmi aktif, kejadian terverifikasi, laporan lapangan menunggu verifikasi, status sumber data, dan tugas respons yang berjalan.
- Widget harus dapat difilter berdasarkan rentang waktu, provinsi, kabupaten/kota, jenis bahaya, dan status.
- Angka agregat wajib menunjukkan timestamp dan sumber; nilai yang tidak tersedia ditampilkan sebagai “tidak tersedia”, bukan nol.
- Dashboard publik dan dashboard internal memiliki dataset dan level detail berbeda sesuai permission.

### 5.2 Situational Awareness
| Modul | Kebutuhan wajib |
| :--- | :--- |
| **Peta Langsung** | Layer resmi, layer baseline risiko, sensor, insiden, laporan lapangan, dan analisis turunan memiliki legend berbeda; filter waktu/wilayah; sumber dan freshness pada popup. |
| **Pusat Peringatan** | Menampilkan pesan resmi tanpa mengubah severity; simpan status, area, waktu terbit, waktu berlaku/expired, issuing authority, dan referensi asli; dukung CAP bila tersedia. |
| **Analitik Sensor** | Kualitas sinyal, heartbeat, last-seen, missing reading, anomali, baterai/koneksi; hasil sensor tidak disamakan dengan konfirmasi kejadian. |

### 5.3 Risk & Intelligence
| Modul | Kebutuhan wajib |
| :--- | :--- |
| **Kajian Risiko** | Menampilkan bahaya, paparan, kerentanan, kapasitas, skala spasial, tahun/versi data, metode, dan sumber. Bedakan baseline risk dari kondisi aktual. |
| **Analisis Skenario** | Mendukung skenario “what-if” dengan parameter, asumsi, input version, output, uncertainty, dan perbandingan skenario. |
| **Digital Twin** | Menampilkan representasi sistem/wilayah berbasis data yang benar-benar tersedia. Setiap objek dan simulasi memiliki status observed/estimated/simulated. |
| **AI Analytics** | Menyajikan klasifikasi, analisis, atau rekomendasi berbasis evidence; tampilkan model/version, input window, confidence/calibration status, limitation, dan human review. |

### 5.4 Preparedness & Mitigation
- **Mitigation Planning:** Daftar tindakan mitigasi, lokasi, penanggung jawab, biaya/estimasi, target waktu, status, bukti penyelesaian, dan indikator dampak.
- **Contingency Plans:** Skenario bahaya, asumsi, activation criteria yang ditetapkan otoritas, peran, resource requirement, alternatif komunikasi, dan versi dokumen.
- **Exercises / Tabletop:** Skenario latihan, injects, participant roles, observasi, after-action review, temuan, pemilik tindakan, dan due date.

### 5.5 Emergency Operations — Modul Inti Baru

#### A. Incident & Operations Management
| Fungsi | Requirement |
| :--- | :--- |
| **Incident registry** | Buat/catat insiden dari alert resmi atau laporan lapangan; tautkan sumber pemicu tanpa menganggap alert = confirmed incident. |
| **Verification & triage** | Status minimal: *Draft, Unverified, Under Review, Verified, Active, Monitoring, Closed, Rejected/Duplicate*. Perubahan status mencatat pelaku dan waktu. |
| **Incident profile** | Jenis bahaya, lokasi/geometry, waktu kejadian, sumber, tingkat keyakinan, deskripsi, affected area, dampak yang diketahui, dan unknowns. |
| **Operations board** | Tampilkan objective, task, PIC, due time, dependencies, status, update, dan catatan koordinasi. |
| **Command/coordination log** | Catat keputusan, instruksi yang berwenang, perubahan status, alasan, pengirim/penerima, dan waktu. LANDSAFE tidak menetapkan komandan secara otomatis. |
| **Closure & review** | Catat dasar penutupan, hasil, data yang belum lengkap, lesson learned, dan action items. |

#### B. Rapid Assessment & Field Reporting
- Buat laporan dengan jenis formulir terstruktur sesuai hazard, teks bebas, timestamp, geotag, media/evidence, dan pelapor.
- Sediakan status: *Draft / Submitted / Under Verification / Verified / Rejected / Needs Clarification*.
- Dukung mobile-first workflow dan penyimpanan draft offline; sinkronisasi harus idempotent dan mempertahankan waktu pengambilan asli.
- Simpan metadata media (waktu diterima, uploader, hash, lokasi bila diizinkan); jangan mengubah bukti asli saat membuat thumbnail/preview.
- Field assessment mencakup dampak, akses jalan, fasilitas kritis, kebutuhan dasar, kebutuhan pengungsian, dan confidence/verification notes.
- Data korban/identitas bersifat restricted; minimalkan pengumpulan data pribadi dan tampilkan agregat pada peta publik.

#### C. Resource & Logistics Management
| Domain | Fungsi |
| :--- | :--- |
| **Resource registry** | Personel, tim, relawan, kendaraan, alat, perlengkapan, stok logistik, fasilitas, shelter. |
| **Capability & availability** | Jenis kemampuan, jumlah, kondisi, lokasi, status tersedia/digunakan/perbaikan/tidak tersedia, owner/agency. |
| **Needs assessment** | Kebutuhan per insiden/wilayah dengan sumber, kuantitas, satuan, prioritas, dan waktu dibutuhkan. |
| **Allocation & deployment** | Usulan alokasi, persetujuan manusia, assignment, asal/tujuan, waktu berangkat/tiba (bila diketahui), dan status. |
| **Inventory movements** | Barang masuk/keluar, lot/batch, expiry bila relevan, balance, supplier/source, dan audit trail. |
| **Gap analysis** | Bandingkan kebutuhan dan ketersediaan; tampilkan asumsi, kekurangan, dan data yang belum dikonfirmasi. |

#### D. Evacuation & Shelter Management
- **Peta Rute Evakuasi** adalah visualisasi rute dan titik tujuan publik; **Manajemen Rute Evakuasi** menangani versi, status jalan, hazard overlays, review, dan approval.
- Rute tidak otomatis dinyatakan aman. Status harus menunjukkan: *Draft, Needs Field Verification, Verified by Authorized Reviewer, Temporarily Blocked, Closed, atau Retired*.
- **Shelter register** berisi lokasi, kapasitas terverifikasi, fasilitas, aksesibilitas, penanggung jawab, ketersediaan, dan waktu pembaruan.
- **Evacuee management** memprioritaskan data agregat per shelter. Data identitas penghuni dibatasi secara ketat dan tidak ditampilkan ke peta publik.
- Tidak ada instruksi evakuasi otomatis yang dihasilkan AI. Semua arahan operasional harus berasal dari otoritas berwenang.

### 5.6 Data & Infrastructure
- **Government Data Integration Hub:** Source registry, dataset registry, konektor, izin/terms, job history, ingestion logs, freshness, data quality, provenance, retry, dan status akses.
- **IoT Device Management:** Registrasi device, lokasi, tipe sensor, status koneksi, firmware/version bila tersedia, last-seen, kalibrasi, dan audit.
- Konektor eksternal harus dibuat per sumber, tidak menggunakan satu parser generik untuk semua format.

### 5.7 Reporting & Administration
- **Reports:** Operational situation report, incident report, field assessment report, resource gap report, mitigation progress, and after-action report.
- **Users & Permissions:** Role-based access control (RBAC), organisasi/wilayah, status akun, dan review akses.
- **Audit Logs:** Append-only event log untuk perubahan penting, data source access, rekomendasi, approval, export, dan perubahan permission.

---

## 6. Peran Pengguna dan Hak Akses

Role harus diterapkan di backend pada setiap endpoint dan operasi, bukan hanya menyembunyikan menu di frontend. Satu pengguna dapat memiliki role dan cakupan wilayah yang berbeda sesuai kebijakan organisasi.

| Role | Kewenangan umum | Pembatasan penting |
| :--- | :--- | :--- |
| **Public / Community Viewer** | Melihat informasi publik, peta dan peringatan resmi, serta status informasi yang aman dibagikan. | Tidak melihat data personal, internal notes, resource sensitif, atau keputusan internal. |
| **Field Officer** | Mengirim laporan lapangan, memperbarui tugas yang ditugaskan, menambahkan bukti. | Tidak dapat mengesahkan laporan sendiri bila prinsip four-eyes diwajibkan. |
| **Incident Operator** | Membuat/triage insiden, mengoordinasi task, mengelola timeline dan update operasional. | Tidak menerbitkan peringatan resmi atau keputusan di luar delegasi. |
| **Risk / GIS Analyst** | Mengelola analisis, layer, evidence, skenario, dan review teknis. | Tidak otomatis memiliki hak komando/dispatch. |
| **Resource / Logistics Manager** | Mengelola inventaris, ketersediaan, kebutuhan, dan proposal alokasi. | Perubahan stok dan alokasi harus tercatat; approval mengikuti kebijakan. |
| **Command / Authorized Approver** | Menyetujui keputusan operasional dalam lingkup delegasi organisasi. | Tidak mengubah sumber atau fakta resmi yang diterbitkan lembaga lain. |
| **BPBD / Organization Admin** | Mengelola pengguna, cakupan wilayah, konfigurasi organisasi, dan sumber yang diizinkan. | Tidak memiliki akses global secara default. |
| **System Admin / Auditor** | Konfigurasi teknis atau pembacaan audit sesuai tugas. | System admin tidak boleh mengubah log audit atau melakukan approval operasional tanpa role terpisah. |

### 6.1 Access Control Rules
1. **Default deny:** Akses ditolak kecuali secara eksplisit diberikan.
2. **Scope by organization and geography:** User hanya mengakses insiden/resource wilayah yang diizinkan.
3. **Sensitive fields:** Identitas warga, kontak, koordinat lokasi sensitif, dan lampiran terbatas menggunakan permission terpisah.
4. **Separation of duties:** Pembuat laporan tidak selalu menjadi verifier; pembuat rekomendasi bukan otomatis approver.
5. **Auditability:** Setiap grant/revoke permission dan perubahan data penting tercatat.

---

## 7. Alur Kerja End-to-End

### 7.1 Alert-to-Incident Workflow
```text
OFFICIAL SOURCE / FIELD REPORT
            │
            ▼
INGEST + PRESERVE ORIGINAL RECORD
            │
            ▼
VALIDATE SOURCE, TIME, AREA, DATA QUALITY
            │
            ▼
OPERATOR TRIAGE: Is this an incident?
       /               \
     No                 Yes
     │                   │
monitor/close     create incident (unverified)
                         │
                         ▼
                 human verification
                         │
                         ▼
                 operations / tasks
                         │
                         ▼
              resource & needs assessment
                         │
                         ▼
                  human approval
                         │
                         ▼
              status update / closure / review
```

### 7.2 Model-to-Assessment Workflow
```text
DATA SNAPSHOT + MODEL VERSION + GEOGRAPHIC SCOPE
                         │
                         ▼
            MODEL ROUTER / ELIGIBILITY CHECK
                         │
                         ▼
           HAZARD-SPECIFIC MODEL INFERENCE
                         │
                         ▼
        VALIDATE OUTPUT + CALIBRATION + LIMITS
                         │
                         ▼
          COMPARE WITH OFFICIAL INFORMATION
                         │
                         ▼
            EVIDENCE-LINKED ASSESSMENT
                         │
                         ▼
                    HUMAN REVIEW
                         │
                         ▼
            APPROVED / MODIFIED / REJECTED
```

*Model output yang tidak memenuhi persyaratan cakupan, freshness, format, atau versi harus ditolak dari jalur rekomendasi dan ditampilkan sebagai unavailable/experimental. Model tidak boleh diam-diam fallback ke hasil lama tanpa penanda stale.*

---

## 8. Arsitektur Teknis Target

### 8.1 Prinsip Implementasi
Pertahankan *modular monolith* untuk aplikasi utama dan gunakan background workers untuk ingestion. Pisahkan Python model service hanya untuk komputasi yang memang memerlukan dependency, runtime, atau resource berbeda. Jangan mengubah aplikasi menjadi microservices penuh sebagai bagian dari refactor awal.

```text
EXISTING WEB FRONTEND
       │
       ▼
EXPRESS API (existing backend)
  ├── Auth / RBAC / Validation / Application Services
  │    ├── Situational Awareness
  │    ├── Risk & Intelligence
  │    ├── Preparedness & Mitigation
  │    ├── Emergency Operations
  │    ├── Data & Infrastructure
  │    └── Reporting & Administration
  │
  ├── PostgreSQL (existing DB; additive migrations only)
  ├── PostGIS (only if supported and approved)
  ├── Ingestion Worker / Job Queue
  └── Model Registry + Model Router
            │
            ├── External Model/Data Adapters
            ├── Python inference service (selective)
            └── RAG knowledge retrieval (separate from hazard prediction)
```

### 8.2 Batas Modul dan Kontrak
| Lapisan | Tanggung jawab |
| :--- | :--- |
| **Frontend / navigation** | Menu, page composition, filter state, clear source/status badges, mobile layout. |
| **API / application layer** | Authorization, request validation, workflow orchestration, consistent response format. |
| **Domain modules** | Incident, report, resource, shelter, evacuation, assessment, mitigation, device, user, audit. |
| **Integration adapters** | Source-specific retrieval, parsing, retry, normalization, attribution, license/terms enforcement. |
| **Model adapters** | Model-specific input/output conversion, eligibility validation, execution, metadata and errors. |
| **Persistence** | Existing PostgreSQL schema plus additive tables; immutable/raw artifact storage strategy. |
| **Background processing** | Scheduled ingestion, reprocessing, model jobs, report generation, freshness monitoring. |

---

## 9. Model Data, Provenance, dan Integrasi

### 9.1 Entitas Inti Target
- `DataSource`: Lembaga/publisher, canonical name, authority class, homepage, contact, terms URL.
- `Dataset` / `ModelSource`: Dataset/model, product, version, geographic coverage, hazard, cadence, license, access requirements.
- `IngestionRun`: Start/end, outcome, item count, error, source timestamp, retrieval timestamp.
- `RawArtifact`: Original payload/file reference, hash, format, size, storage location, retention class.
- `OfficialAlert`: Alert ID, issuer, CAP metadata, severity as issued, area, sent/effective/expires, reference URI.
- `HazardEvent` / `Incident`: Normalized event and incident workflow; source event and internal incident remain distinct.
- `RiskLayer` / `ExposureLayer`: Geometry/raster, CRS, scale, reference period, methodology, version, lineage.
- `Assessment` / `Evidence`: Analysis output, model version, input snapshot IDs, evidence links, confidence, limitations.
- `ModelRun` / `ModelCard`: Model ID/version, input contract, output, runtime, coverage eligibility, metrics, approvals.
- `Resource` / `Need` / `Allocation`: Resource inventory, requested quantities, allocation decision, owner, status, timestamps.
- `FieldReport` / `Verification`: Report payload, reporter, location, attachments, status, verifier, decision history.
- `AuditEvent`: Actor, action, entity, timestamp, before/after diff reference, correlation ID.

### 9.2 Metadata Minimum per Data/Model Record
```json
{
  "source_id": "publisher-or-dataset-id",
  "source_record_id": "original-id-if-present",
  "source_url": "original-canonical-url",
  "publisher": "issuing-organization",
  "published_at": "source-time-or-null",
  "observed_at": "observation-time-or-null",
  "valid_from": "validity-start-or-null",
  "valid_until": "validity-end-or-null",
  "retrieved_at": "system-retrieval-time",
  "dataset_version": "version-or-null",
  "model_version": "model-version-or-null",
  "license_ref": "license-record",
  "raw_artifact_hash": "sha256",
  "geography": { "crs": "EPSG:4326", "coverage_id": "..." },
  "quality_status": "valid|partial|stale|invalid|unverified"
}
```

### 9.3 Data Provenance Rules
1. Pertahankan raw/original payload secara immutable selama retention policy mengizinkan.
2. Pisahkan source time, observation time, valid time, retrieval time, processing time, dan report-submission time.
3. Simpan hash, parser version, source URL, data license, attribution, input snapshot, dan processing lineage.
4. Gunakan canonical administrative-area crosswalk berversi; jangan mengasumsikan semua kode wilayah instansi sama.
5. Setiap output model harus menunjuk ke model version dan input snapshot yang dapat direproduksi.
6. Data resmi, hasil model eksternal, laporan masyarakat/petugas, dan hasil analisis internal memiliki authority class berbeda.

---

## 10. Strategi Multi-Hazard Model Intelligence

### 10.1 Konsep yang Dipilih
LANDSAFE tidak akan “dilatih dengan semua model dunia” sebagai satu model gabungan. Pendekatan yang dipilih adalah **portfolio model**: setiap hazard mempunyai sumber observasi, model prediktif/impact model, metode lokal, dan aturan verifikasi yang berbeda. **Model Router** memilih model yang sesuai berdasarkan jenis bahaya, wilayah, waktu, akses, lisensi, serta kesiapan input. Hasil yang tidak kompatibel tidak boleh digabungkan menjadi satu skor.

### 10.2 Kategori Kapabilitas
| Kategori | Contoh | Peran |
| :--- | :--- | :--- |
| **Official observation / warning** | BMKG, PVMBG, BNPB, FIRMS hotspots | Fakta atau pesan yang diterbitkan/dideteksi sumber; bukan otomatis hasil prediksi. |
| **Forecast / nowcast model** | GloFAS, Google Flood Forecasting, NASA LHASA | Mengestimasi kondisi bahaya dalam cakupan dan rentang waktu tertentu. |
| **Impact / consequence model** | USGS PAGER, ShakeMap | Memperkirakan guncangan, paparan, atau dampak setelah event terdeteksi. |
| **Hazard/risk engine** | OpenQuake, FEMA Hazus methodology | Analisis skenario/probabilistik berbasis hazard, exposure, fragility/vulnerability input. |
| **Composite risk framework** | INFORM Risk | Membandingkan risiko, kerentanan, dan kapasitas; bukan alarm kejadian real-time. |
| **Multi-hazard alert aggregator** | GDACS | Konteks global, cross-check, dan situational awareness; bukan pengganti otoritas nasional. |
| **Historical event archive** | IBTrACS, EM-DAT (with restrictions), DesInventar/DELTA | Pelatihan/evaluasi historis sesuai akses, skala, kualitas, dan lisensi. |

### 10.3 Model Router Eligibility Checks
1. Hazard type and output semantics match the requested task.
2. Model geographic coverage includes target area; coverage must be checked, not assumed.
3. Input variables, spatial resolution, temporal cadence, and CRS are compatible.
4. Model status is approved for intended use; experimental outputs are clearly labelled.
5. License and API access permit the intended use and storage/display.
6. Output has valid timestamp, model version, uncertainty/limitations, and data lineage.
7. Model is not stale or degraded beyond its declared policy.

---

## 11. Portofolio Model Global yang Direkomendasikan

| Hazard / framework | Kandidat | Rekomendasi LANDSAFE | Batasan utama |
| :--- | :--- | :--- | :--- |
| **Banjir sungai** | Google Flood Forecasting API / Google Flood Hub | Prioritas uji tinggi. Memiliki API data forecast sungai dan data historis; cek coverage basin Indonesia dan approval waitlist/API key. | API requires waitlist, key, Cloud project. Not all places necessarily covered; model forecast is not local authority warning. [R05] |
| **Banjir sungai** | Copernicus GloFAS | Prioritas uji tinggi sebagai pembanding global. Forecast sungai harian dan satellite-based flood monitoring NRT. | Forecast fokus sungai; tidak memberi forecast flash flood real-time atau banjir pesisir. Akses melalui platform terdaftar. [R06] |
| **Longsor hujan** | NASA LHASA 2.1.1 | Prioritas uji tinggi sebagai supplementary landslide nowcast/benchmark; ~1 km daily probability dan exposure population/roads. | Output portal best-effort, 2x sehari dan dapat downtime. Repo tidak mendukung retraining model untuk domain/dataset baru. [R07] |
| **Gempa / dampak** | USGS ShakeMap + PAGER | Gunakan sebagai independent global comparison untuk guncangan dan estimasi dampak setelah gempa. | PAGER memberi estimasi awal, bukan prediksi gempa; tidak mencakup dampak sekunder longsor, likuefaksi, tsunami. [R08] |
| **Gempa / skenario risiko** | GEM OpenQuake Engine | Kandidat advanced/offline scenario engine setelah tersedia model hazard, exposure, vulnerability lokal. | Memerlukan input teknis dan data lokal; lisensi AGPL-3 perlu ditinjau sebelum integrasi. [R09] |
| **Multi-hazard alert** | GDACS | Prioritas tinggi sebagai global cross-check dan alert/event aggregator. Feed/API gratis dengan disclaimer. | Bukan sumber komando Indonesia. Algoritma/otomasi berbeda menurut hazard. [R10] |
| **Kebakaran hutan/lahan** | NASA FIRMS MODIS/VIIRS | Gunakan active fire hotspot sebagai observasi satelit pendukung situational awareness. | Hotspot bukan perimeter, ground truth, atau prediksi penyebaran api. [R11] |
| **Siklon tropis** | NOAA IBTrACS | Gunakan untuk historical track, climatology, benchmark, dan feature engineering. | Best-track historis multi-agensi; bukan model prakiraan aktif. [R12] |
| **Risiko multi-hazard** | INFORM Risk Index | Adopsi metodologi untuk konteks risiko: hazard & exposure, vulnerability, lack of coping capacity. | Index global untuk konteks strategis, bukan prediksi real-time per jam. [R13] |
| **Exposure / permukiman** | EC JRC GHSL | Gunakan sebagai global baseline population/built-up exposure jika data lokal belum lengkap. | Bukan sensus real-time; prioritaskan data resmi Indonesia jika tersedia. CC BY 4.0. [R14] |
| **Risiko/dampak bencana** | FEMA Hazus methodology | Pelajari struktur hazard + inventory + damage functions untuk desain skenario. | Koefisien AS tidak portabel ke Indonesia tanpa kalibrasi lokal. [R15] |

### 11.1 Rekomendasi Prioritas Implementasi
- **MVP-A:** BMKG official warnings + observations (Sumber resmi utama; prioritas 1).
- **MVP-B:** InaRISK / BNPB risk layers (Baseline konteks risiko).
- **MVP-C:** GDACS feed + USGS PAGER/ShakeMap (Cross-check global independen).
- **MVP-D:** NASA LHASA (Konteks supplementary longsor).
- **MVP-E:** GloFAS and Google Flood Forecasting (Pilot integrasi basin banjir).
- **Phase 2:** OpenQuake, model banjir/longsor terkalibrasi lokal, FIRMS analytics.
- **Cross-cutting:** INFORM, GHSL, IBTrACS, DesInventar/DELTA.

---

## 12. Strategi Training, Adaptasi, dan Validasi Lokal

### 12.1 Empat Jalur Model
1. **Jalur A — Consume model outputs:** Mengambil hasil model eksternal yang sudah dijalankan provider jika API dan terms mengizinkan.
2. **Jalur B — Reproduce / run open model:** Menjalankan software open-source jika dependency, compute, dan lisensi terpenuhi.
3. **Jalur C — Local calibration / adaptation:** Kalibrasi parameter, ambang batas, atau bias correction terhadap data Indonesia jika ground truth lokal cukup.
4. **Jalur D — Train LANDSAFE model:** Melatih model spesifik pada dataset terkurasi dan label tervalidasi setelah pipeline data dan baseline siap.

### 12.2 Training Data Policy
- **Official local event records:** Preferred labels/ground truth (BNPB/BPBD, BMKG, PVMBG).
- **Global hazard model outputs:** Supplementary signal/benchmark, bukan ground truth.
- **Field verification reports:** High-value labels; memerlukan atribusi verifikator, timestamp akurat, dan kontrol privasi.

### 12.3 Evaluation Protocol & Release Gate
- Evaluasi berbasis episode bencana temporal dan holdout geografis (bukan random row split).
- Metrik klasifikasi: Precision, Recall, F1, PR-AUC, Brier score, False-alarm rate, Lead time.
- Metrik regresi/kontinu: MAE, RMSE, bias, IoU / Critical Success Index untuk peta genangan.
- Model Card mendokumentasikan batasan, bias, versi, tanggal evaluasi, intended use, dan prohibited use.

> [!CAUTION]
> **RELEASE GATE:** Tidak ada model yang boleh berubah dari *Experimental* menjadi *Decision-Support Approved* hanya karena akurasi pada satu dataset. Diperlukan holdout temporal/geografis, uji baseline, calibration check, dan persetujuan penanggung jawab berwenang.

---

## 13. AI Assistant dan Knowledge Retrieval

LANDSAFE Intelligence Assistant (Lia) membantu operator memahami situasi, menemukan SOP yang relevan, merangkum evidence, dan menjelaskan output model.

### 13.1 Knowledge Library
1. Regulasi dan pedoman resmi Indonesia (BNPB, BMKG, PVMBG, Pemda) dengan nomor dokumen, tanggal, dan status berlaku.
2. SOP dan Contingency Plans yang telah disetujui organisasi pengguna.
3. After-Action Reports dan lesson learned.
4. Model Cards, batasan, glossary hazard, dan data dictionaries.
5. Panduan best-practice internasional (UNDRR, WMO, IFRC, FEMA) sebagai referensi komparatif.

### 13.2 Aturan Operasional Asisten
- Jawaban wajib menautkan evidence/dokumen rujukan dan menyatakan ketidaktahuan jika data tidak tersedia.
- Regulasi dan SOP lokal selalu mengesampingkan panduan luar negeri.
- Asisten dilarang keras membuat keputusan komando, mengeluarkan instruksi evakuasi otomatis, atau mengirim dispatch sepihak.
- Konflik sumber harus ditampilkan secara eksplisit untuk diverifikasi manusia.

---

## 14. Keamanan, Keselamatan, dan Tata Kelola

| Area | Kebutuhan |
| :--- | :--- |
| **Authority & source integrity** | Pisahkan official alert, external model, field report, derived assessment, dan human decision. |
| **Human approval** | Evakuasi, resource deployment, incident activation, dan keputusan penting membutuhkan personel berwenang. |
| **RBAC / organization scope** | Default deny, permission per modul/aksi, pembatasan wilayah, dan separation of duties. |
| **Privacy** | Minimalkan data pribadi, enkripsi data sensitif, akses berbasis tugas, retention policy, serta agregasi untuk tampilan publik. |
| **Security** | HTTPS, secure secrets, rate limiting, input validation, safe XML parsing, SSRF allowlist, file-type/size checks. |
| **Audit integrity** | Catatan audit append-only atau protected; administrator tidak boleh diam-diam mengubah riwayat keputusan. |
| **AI safety** | No autonomous evacuation/dispatch; model uncertainty and limitations displayed; block unsupported claims. |
| **Operational continuity** | Cache and last-good snapshot show stale status; external outage must not erase local data. |

---

## 15. Non-Functional Requirements (NFR)

| ID | Requirement | Acceptance target awal |
| :--- | :--- | :--- |
| **NFR-01** | Backward compatibility | Existing routes and main workflows remain accessible during refactor; deprecated routes redirect or remain aliased. |
| **NFR-02** | Data integrity | No destructive migration; backups and rollback tested before production schema change. |
| **NFR-03** | Traceability | 100% of displayed external alert/model evidence has source identity and retrieved timestamp. |
| **NFR-04** | Model reproducibility | Every stored assessment records model version and input snapshot IDs. |
| **NFR-05** | Degraded mode | On source outage, show last successful timestamp and stale/unavailable label; do not display as current. |
| **NFR-06** | Authorization | Server-side authorization test exists for every protected module and sensitive action. |
| **NFR-07** | Mobile operations | Field report form usable on common mobile viewport; draft autosave and retry-safe submission. |
| **NFR-08** | Performance | Dashboard and list APIs target p95 under 2 seconds for cached/normal pilot datasets; heavy GIS/ML jobs run asynchronously. |
| **NFR-09** | Audit | Every approval/rejection, task assignment, resource movement, and permission change records actor + timestamp + action. |
| **NFR-10** | Accessibility | Clear contrast, keyboard focus, legible status labels, and no color-only meaning. |
| **NFR-11** | Localization | Indonesian interface first; timestamps use timezone-aware storage and explicit local display. |
| **NFR-12** | Data freshness | Freshness rules configured per product, not one generic interval for all sources. |

---

## 16. Implementation Backlog dan Prioritas

Prioritas: **P0** = Wajib; **P1** = Demonstrasi kompetitif; **P2** = Lanjutan.

### EPIC 0 — Brownfield Technical Audit
- `AUD-01` [P0]: Map routes, menus, pages and permissions.
- `AUD-02` [P0]: Database/schema audit (ERD, constraints, tables).
- `AUD-03` [P0]: Module capability audit (working/partial/mock).
- `AUD-04` [P0]: Deployment and environment audit.
- `AUD-05` [P0]: GIS/ML capability audit.

### EPIC 1 — Information Architecture Refactor
- `IA-01` [P0]: Implement seven nav groups matching Section 4.
- `IA-02` [P0]: Route compatibility and safe redirects.
- `IA-03` [P0]: Role-based navigation and backend authorization.
- `IA-04` [P0]: Consistent menu labels and bilingual documentation.
- `IA-05` [P1]: Responsive sidebar and mobile drawer.

### EPIC 2 — Incident & Operations Management
- `INC-01` [P0]: Incident registry (create/read/update/filter).
- `INC-02` [P0]: Source-to-incident linking with official alerts/field reports.
- `INC-03` [P0]: Verification workflow and state transitions.
- `INC-04` [P0]: Chronological operations timeline and audit log.
- `INC-05` [P1]: Task assignment (owner, due date, priority).
- `INC-06` [P1]: Operations board.
- `INC-07` [P1]: Closure and after-action review.

### EPIC 3 — Rapid Assessment & Field Reporting
- `FLD-01` [P0]: Configurable field report form (structured + geotag + timestamp).
- `FLD-02` [P0]: Media evidence upload with hash and attribution.
- `FLD-03` [P0]: Verification flow with verifier attribution.
- `FLD-04` [P1]: Mobile-first responsive layout.
- `FLD-05` [P1]: Offline draft and sync.
- `FLD-06` [P1]: Assessment report summarization.

### EPIC 4 — Resource & Logistics Management
- `RES-01` [P0]: Resource registry (personnel, vehicles, supplies, shelters).
- `RES-02` [P0]: Availability and condition management.
- `RES-03` [P1]: Needs assessment and gap analysis.
- `RES-04` [P1]: Allocation proposal and human approval.
- `RES-05` [P1]: Inventory movement ledger.
- `RES-06` [P1]: Shelter capacity and occupancy monitoring.

### EPIC 5 — Government Data Integration Hub
- `DAT-01` [P0]: Source and dataset registry.
- `DAT-02` [P0]: Provenance metadata tracking.
- `DAT-03` [P0]: Raw artifact storage with hash.
- `DAT-04` [P0]: Freshness and quality monitoring.
- `DAT-05` [P0]: BMKG connector regression and official docs alignment.
- `DAT-06` [P0]: BNPB/InaRISK layer inventory.
- `DAT-07` [P1]: BIG service integration.
- `DAT-08` [P0]: PVMBG access discovery.
- `DAT-09` [P1]: GDACS/global model adapters.

### EPIC 6 — Model Registry & Intelligence Layer
- `ML-01` [P0]: Model registry and Model Cards.
- `ML-02` [P0]: Model eligibility router.
- `ML-03` [P1]: External inference adapters with provenance.
- `ML-04` [P0]: Assessment evidence links.
- `ML-05` [P1]: Model evaluation pipeline.
- `ML-06` [P1]: Local training dataset registry.
- `ML-07` [P2]: Local pilot model for selected hazard.
- `ML-08` [P2]: Model monitoring and rollback.

### EPIC 7 — RAG Assistant, Reporting and Evaluation
- `AI-01` [P1]: Policy/SOP knowledge base with citations.
- `AI-02` [P1]: Evidence-grounded assistant.
- `REP-01` [P1]: Operational situation reports.
- `QA-01` [P0]: Role and security regression tests.
- `QA-02` [P0]: End-to-end demo flow.
- `QA-03` [P1]: User validation with disaster-management stakeholders.

---

## 17. Acceptance Criteria dan Definition of Done

- **Architecture:** Seven nav groups implemented; existing valid features remain accessible; no duplicated/ambiguous modules.
- **Migration:** All schema changes additive or have a reviewed migration/rollback plan; no data loss.
- **Incident workflow:** A source item can be triaged into an unverified incident, verified by an authorized user, assigned tasks, updated and closed with audit trail.
- **Field reporting:** A field officer can submit a geotagged structured report, attach evidence, and follow verification state.
- **Resource management:** A resource manager can register stock/assets, record availability, create a need, propose allocation and record approval.
- **Data provenance:** Every external data item and model output in a user-visible assessment has source/version/timestamps and source class.
- **Model governance:** Every model is registered with intended use, geographic scope, limits, license and validation state.
- **Model safety:** No unvalidated model output can trigger an automatic evacuation or dispatch. Model disagreement/uncertainty remains visible.
- **Security:** Permission is enforced server-side; sensitive data and audit logs have restricted/controlled access.
- **Operational robustness:** External data/model outage results in a visible stale/unavailable state, not silent deletion or false current status.
- **Demo readiness:** One complete multi-source demonstration is reproducible, with real vs sample data clearly labelled.

---

## 18. Risiko, Asumsi, dan Keputusan Terbuka

| Risiko / isu | Dampak | Mitigasi / keputusan |
| :--- | :--- | :--- |
| **No repository audit yet** | PRD task may duplicate or conflict with existing function. | Sprint 0 maps current code/schema; tickets adjusted before implementation. |
| **External API access/cadence changes** | Ingestion may fail or be delayed. | Per-source freshness and degraded mode; never promise all-source real-time. |
| **PVMBG programmatic access unknown** | Integration schedule uncertain. | Discovery first; manual/verified official document only where permitted, clearly marked. |
| **Global model not calibrated to Indonesia** | False confidence or biased results. | Use as benchmark/supplementary evidence; holdout local validation; model cards. |
| **Restricted dataset license** | Unauthorized training/redistribution risk. | Source/license registry; block dataset from training until rights reviewed. |
| **Poor field-report labels** | Model may learn incorrect labels. | Verifier workflow, event IDs, geolocation/time confidence, and adjudication. |
| **Too many modules for hackathon** | Incomplete delivery. | P0 scope prioritized; demonstrate one end-to-end workflow deeply. |
| **Operational use before validation** | Users may over-trust recommendation. | Prototype label, human review, disclaimers, no autonomous response decisions. |

---

## Lampiran A. Registry Sumber dan Model

| Nama | Tipe | Kegunaan LANDSAFE | Status / Catatan |
| :--- | :--- | :--- | :--- |
| **BMKG Open Data** | Primary official source Indonesia | Peringatan/prakiraan/cuaca/gempa sesuai produk yang tersedia. | Prioritas primary; cek rate limit, attribution dan update. |
| **BNPB InaRISK** | Official risk GIS | Layer hazard/vulnerability/risk baseline. | GIS services; bukan operational live sensor feed. |
| **PVMBG MAGMA** | Primary official geological source | Aktivitas gunung api dan informasi geologi. | Verifikasi API/CAP route dengan pemilik layanan. |
| **BIG Geoportal / services** | Official geospatial reference | Basemap, coverage dan referensi geospasial. | Bedakan WMS/WMTS rendering dari WCS coverage data. |
| **GDACS** | Global multi-hazard alert system | Global cross-check dan context. | API gratis dengan atribusi; baca disclaimer/terms. |
| **GloFAS** | Global river flood model | Daily streamflow forecast dan satellite flood monitoring. | Registered access; bukan flash/coastal flood forecast. |
| **Google Flood Forecasting** | Global riverine flood model/API | Model comparison dan forecast supplementary. | Waitlist/API key/Cloud project; verifikasi coverage basin Indonesia. |
| **NASA LHASA** | Global landslide ML model | Landslide nowcast supplementary signal. | ~1 km daily probability; output eksternal first; no retraining repo. |
| **USGS PAGER / ShakeMap** | Global earthquake impact products | Ground-shaking/exposure/impact context pasca gempa. | Estimasi awal pasca gempa, bukan prediksi gempa. |
| **GEM OpenQuake** | Open seismic hazard/risk engine | Offline scenario risk dengan model lokal. | Input-heavy; periksa lisensi AGPL-3. |
| **NASA FIRMS** | Satellite active-fire detection | Fire hotspot observation/context. | Hotspot satelit bukan batas perimeter atau prediksi sebaran. |
| **NOAA IBTrACS** | Global historical cyclone archive | Historical cyclone track/intensity benchmark. | Data historis multi-agensi; bukan prakiraan aktif. |
| **INFORM Risk** | Global composite risk framework | Risk context and methodology reference. | Indeks global komparatif, bukan alarm real-time. |
| **EC JRC GHSL** | Global exposure dataset | Population and built-up exposure baseline. | CC BY 4.0 atribusi; utamakan data resmi Indonesia. |
| **UNDRR DesInventar / DELTA** | Disaster loss system | Historical impact and loss reference. | Ketersediaan data bervariasi; DELTA berevolusi menggantikan DesInventar. |
| **EM-DAT** | Global disaster impact database | Research reference if eligible/licensed. | Terms terbatas; dilarang redistribusi massal. |
| **FEMA Hazus** | National risk-model methodology | Inspirasi arsitektur workflow hazard/inventory/vulnerability. | Parameter AS tidak dapat dipakai tanpa kalibrasi lokal. |

---

## Lampiran B. Referensi

- **[R01]** UNDRR — *Sendai Framework for Disaster Risk Reduction 2015–2030*, [https://www.undrr.org/implementing-sendai-framework/what-sendai-framework](https://www.undrr.org/implementing-sendai-framework/what-sendai-framework)
- **[R02]** WMO — *Common Alerting Protocol (CAP)*, [https://public.wmo.int/site/wmo-common-alerting-protocol](https://public.wmo.int/site/wmo-common-alerting-protocol)
- **[R03]** INFORM Risk — *Methodology*, [https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Methodology](https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Methodology)
- **[R04]** INFORM Risk — *Results and data*, [https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data](https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data)
- **[R05]** Google for Developers — *Flood Forecasting API*, [https://developers.google.com/flood-forecasting](https://developers.google.com/flood-forecasting)
- **[R06]** Copernicus EMS — *About GloFAS*, [https://global-flood.emergency.copernicus.eu/general-information/about-glofas](https://global-flood.emergency.copernicus.eu/general-information/about-glofas)
- **[R07]** NASA — *LHASA GitHub repository*, [https://github.com/nasa/LHASA](https://github.com/nasa/LHASA)
- **[R08]** USGS — *PAGER FAQ and Scientific Background*, [https://earthquake.usgs.gov/data/pager/faq.php](https://earthquake.usgs.gov/data/pager/faq.php)
- **[R09]** GEM — *OpenQuake Engine / documentation*, [https://github.com/gem/oq-engine/](https://github.com/gem/oq-engine/)
- **[R10]** GDACS — *API quickstart and model knowledge*, [https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf)
- **[R11]** NASA FIRMS — *Active Fire Data*, [https://firms.modaps.eosdis.nasa.gov/content/active_fire/](https://firms.modaps.eosdis.nasa.gov/content/active_fire/)
- **[R12]** NOAA NCEI — *IBTrACS*, [https://www.ncei.noaa.gov/products/international-best-track-archive](https://www.ncei.noaa.gov/products/international-best-track-archive)
- **[R13]** INFORM — *Methodology and 2026 results*, [https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Methodology](https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Methodology)
- **[R14]** European Commission JRC — *GHSL use conditions*, [https://human-settlement.emergency.copernicus.eu/GHSLhowToCite.php](https://human-settlement.emergency.copernicus.eu/GHSLhowToCite.php)
- **[R15]** FEMA — *Hazus factsheet*, [https://www.fema.gov/sites/default/files/documents/fema_what-is-hazus-factsheet.pdf](https://www.fema.gov/sites/default/files/documents/fema_what-is-hazus-factsheet.pdf)
- **[R16]** EM-DAT — *Use of Database Data and Derived Products*, [https://doc.emdat.be/docs/legal/terms-of-use/](https://doc.emdat.be/docs/legal/terms-of-use/)
- **[R17]** UNDRR — *Data resources and systems*, [https://www.undrr.org/building-risk-knowledge/data](https://www.undrr.org/building-risk-knowledge/data)
- **[R18]** European Commission JRC — *GHSL datasets*, [https://human-settlement.emergency.copernicus.eu/datasets.php](https://human-settlement.emergency.copernicus.eu/datasets.php)
- **[R19]** USGS — *Data Products*, [https://earthquake.usgs.gov/data/products/](https://earthquake.usgs.gov/data/products/)
- **[R20]** Global Volcanism Program — *Smithsonian*, [https://volcano.si.edu/](https://volcano.si.edu/)

*Tanggal akses referensi: 23 November 2026.*
