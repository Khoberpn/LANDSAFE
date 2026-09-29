# LANDSAFE security assessment and remediation — 26 September 2026

## A. Executive Summary

Penilaian mencakup source backend Express, dashboard React, skema Drizzle, kontrak OpenAPI, batch Python, konfigurasi build, manifest, dan uji HTTP lokal tanpa database sungguhan. Ada 37 route API. Uji awal membuktikan token demo diterima sebagai identitas yang dipilih klien, ingest tanpa autentikasi mencapai validasi payload, CORS mengizinkan origin apa pun, dan header keamanan dasar tidak ada. Source juga membuktikan secret JWT cadangan yang diketahui, klaim peran tanpa pemeriksaan ulang database, RBAC yang tidak konsisten, password seed statis, parsing input yang longgar, dan tidak adanya batas percobaan login.

Perbaikan diterapkan langsung. Typecheck, build, 13 tes Node termasuk regresi HTTP, dan 3 tes Python lulus. Uji HTTP memakai DATABASE_URL dummy yang tidak dapat tersambung. Jalur baca/tulis dengan akun nyata, replay pada database, permission PostgreSQL, dan konfigurasi deployment belum diuji. Tidak ada migration atau perubahan data.

## B. Attack Surface Map

- Browser: React/Vite; token bearer di localStorage; API client menambahkan Authorization; RoleGuard adalah navigasi klien, bukan kontrol server.
- API: Express pada /api; health dan login publik; semua route lain memakai JWT kecuali ingest yang kini menerima token sensor per ID atau JWT operator/admin.
- Auth: bcryptjs memeriksa hash; JWT HS256; setelah perbaikan setiap request memeriksa status, peran, dan versi sesi dari tabel users.
- Data: Drizzle memakai PostgreSQL Pool. Tabel penting: users, locations, sensors, measurements, alerts, devices, predictions, reports, audit_logs.
- IoT: POST /api/measurements adalah satu-satunya endpoint ingest dalam repo. Sensor ID harus terdaftar; lokasi diperoleh dari tabel sensors. Tidak ditemukan broker MQTT atau firmware ESP32 dalam checkout.
- Python: scripts/ml/predict_xgboost.py dan train_bootstrap_model.py dipanggil batch job scripts/src/predict-risk.ts melalui spawn tanpa shell. Tidak ada service Python HTTP.
- Integrasi/file: tidak ditemukan route upload atau baca file yang dipengaruhi pengguna. Model XGBoost memakai path tetap. Koneksi database berasal dari DATABASE_URL.
- Deployment: Vite development proxy /api menuju API; reverse proxy/TLS produksi tidak ada dalam repo. Build API menghasilkan sourcemap lokal tetapi Express tidak menyajikan direktori dist.

### Inventaris endpoint

Keterangan hasil: HTTP berarti penolakan anonim diuji lokal; STATIC berarti kontrol dibaca dari source; DB-N/T berarti alur database belum diuji. Semua path di bawah berawalan /api.

| Method | Path | Auth | Role | Validasi input | Akses data | Potensi serangan | Hasil |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /healthz | Tidak | - | - | Tidak | paparan status | HTTP 200, minimal |
| POST | /auth/login | Tidak | - | body strict, email/password, throttle | users R/W lastLogin | tebakan password | STATIC, DB-N/T |
| POST | /auth/logout | JWT | semua | JWT + versi | users W updatedAt | token reuse | STATIC, DB-N/T |
| GET | /auth/me | JWT | semua | JWT | users R | data pengguna | HTTP anonim 401; DB-N/T |
| GET | /locations | JWT | semua | - | locations R | data exposure | HTTP anonim 401; DB-N/T |
| POST | /locations | JWT | operator/admin | Zod body | locations W | mass assignment | STATIC, DB-N/T |
| GET | /locations/:id | JWT | semua | ID positif utuh | locations R | IDOR | STATIC, DB-N/T |
| PATCH | /locations/:id | JWT | operator/admin | ID + Zod body | locations W | privilege escalation | STATIC, DB-N/T |
| DELETE | /locations/:id | JWT | admin | ID | locations D | deletion | STATIC, DB-N/T |
| GET | /sensors | JWT | operator/admin | locationId positif | sensors/locations R | data exposure | STATIC, DB-N/T |
| POST | /sensors | JWT | operator/admin | Zod body | sensors W | device forgery | STATIC, DB-N/T |
| GET | /sensors/:id | JWT | operator/admin | ID positif | sensors/locations R | IDOR | STATIC, DB-N/T |
| PATCH | /sensors/:id | JWT | operator/admin | ID + Zod body | sensors W | tampering | STATIC, DB-N/T |
| DELETE | /sensors/:id | JWT | admin | ID | sensors D | deletion | STATIC, DB-N/T |
| GET | /sensors/:id/readings | JWT | operator/admin | ID + ISO time | measurements R | query abuse | STATIC, DB-N/T |
| GET | /measurements | JWT | operator/admin | ID, ISO time, limit | measurements R | query abuse | HTTP anonim 401; DB-N/T |
| POST | /measurements | token sensor/JWT | sensor terikat ID atau operator/admin | strict body, range, clock skew | sensors R, measurements R/W | spoof/replay | HTTP anonim 401 dan token salah 401; DB-N/T |
| GET | /alerts | JWT | operator/admin | filter + limit | alerts/locations/users R | info disclosure | HTTP anonim 401; DB-N/T |
| GET | /alerts/:id | JWT | operator/admin | ID | alerts/locations/users R | IDOR | STATIC, DB-N/T |
| PATCH | /alerts/:id | JWT | operator/admin | ID + strict body | alerts W | false resolution | STATIC, DB-N/T |
| GET | /devices | JWT | operator/admin | - | devices/locations R | info disclosure | HTTP anonim 401; DB-N/T |
| POST | /devices | JWT | operator/admin | Zod body | devices W | device registration | STATIC, DB-N/T |
| GET | /devices/:id | JWT | operator/admin | ID | devices/locations R | IDOR | STATIC, DB-N/T |
| PATCH | /devices/:id | JWT | operator/admin | ID + Zod body | devices W | tampering | STATIC, DB-N/T |
| DELETE | /devices/:id | JWT | admin | ID | devices D | deletion | STATIC, DB-N/T |
| GET | /dashboard/stats | JWT | operator/admin | - | sensors/locations/alerts R | internal data | HTTP anonim 401; DB-N/T |
| GET | /dashboard/activity | JWT | operator/admin | limit | alerts/locations R | internal data | STATIC, DB-N/T |
| GET | /dashboard/risk-summary | JWT | operator/admin | - | locations R | internal data | STATIC, DB-N/T |
| GET | /ai/risk-analysis | JWT | semua | - | predictions/locations R | risk data | STATIC, DB-N/T |
| GET | /ai/risk-analysis/:locationId | JWT | semua | ID positif utuh | predictions/locations R | IDOR | STATIC, DB-N/T |
| GET | /reports | JWT | operator/admin | - | reports/locations R | report metadata | HTTP anonim 401; DB-N/T |
| POST | /reports | JWT | operator/admin | Zod body | reports W | report spam | STATIC, DB-N/T |
| GET | /users | JWT | admin | - | users R tanpa hash di respons | account exposure | HTTP anonim 401; DB-N/T |
| POST | /users | JWT | admin | strict + password 12–72 byte | users W | role assignment | STATIC, DB-N/T |
| PATCH | /users/:id | JWT | admin | ID + strict body | users W | role tampering | STATIC, DB-N/T |
| DELETE | /users/:id | JWT | admin | ID | users D | deletion | STATIC, DB-N/T |
| GET | /audit | JWT | admin | limit | audit_logs/users R | audit exposure | HTTP anonim 401; DB-N/T |

## C. Confirmed Vulnerabilities

### V1 — Token demo memalsukan peran — Critical — CWE-287, CWE-863
File/fungsi: artifacts/api-server/src/middlewares/auth.ts authenticate; artifacts/landsafe/src/pages/Login.tsx handleDemoLogin. Akar: string demo-token-admin dipercaya tanpa tanda tangan. Skenario: siapa pun mengirim Bearer demo-token-admin ke route admin. Bukti: source awal mengisi req.user.role dari string; HTTP awal dengan demo-token-public ke /audit mendapat 403, sehingga token diterima dan sampai ke pemeriksaan peran. Dampak: akses administratif tanpa kredensial ketika database tersedia. Perbaikan: hapus bypass dan tombol demo, wajibkan JWT terverifikasi dan akun aktif dari database. Regresi: test token demo mendapat 401.

### V2 — Ingest sensor tanpa autentikasi dan tanpa ikatan sensor — Critical — CWE-306, CWE-345
File/fungsi: artifacts/api-server/src/routes/measurements.ts POST /measurements. Akar: route awal tidak memiliki middleware auth; sensorId, timestamp, dan nilai sensor langsung menjadi insert. Skenario: pihak luar mengirim pembacaan palsu atau replay untuk lokasi mana pun; pengujian tidak melakukan insert. Bukti: source awal; POST anonim dengan body tidak valid memberi 400 dari Zod, bukan 401. Dampak: integritas analitik/risk dapat rusak. Perbaikan: token berbeda per sensor dari environment atau JWT operator/admin, lokasi diambil dari sensor terdaftar, timestamp dibatasi 15 menit, nilai dibatasi, dan transaksi dengan advisory lock menolak pasangan sensorId/timestamp duplikat. Regresi: anonim serta token sensor salah/cross-sensor mendapat 401; insert/replay DB masih perlu tes integrasi.

### V3 — Secret JWT cadangan statis — High — CWE-798, CWE-321
File/fungsi: artifacts/api-server/src/middlewares/auth.ts. Akar: SESSION_SECRET kosong otomatis memakai landsafe-secret-key; file environment yang tersedia tidak menyebut SESSION_SECRET. Skenario: saat secret tidak disetel, pihak luar dapat membuat JWT dengan kunci diketahui. Bukti: source dan daftar nama variabel environment, tanpa membaca nilainya. Dampak: pemalsuan identitas. Perbaikan: startup gagal jika secret kurang dari 32 byte, HS256/issuer/audience ditetapkan. Regresi: startup tanpa secret harus gagal; JWT tidak valid/kedaluwarsa/diubah memberi 401.

### V4 — Peran dan status akun stale dalam JWT; logout tidak membatalkan sesi — High — CWE-613, CWE-863
File/fungsi: artifacts/api-server/src/middlewares/auth.ts; routes/auth.ts logout; routes/users.ts update. Akar: sebelumnya authenticate hanya mempercayai klaim JWT, logout selalu success tanpa perubahan server, dan perubahan user tidak diperiksa saat request berikutnya. Skenario: token lama terus digunakan setelah akun dinonaktifkan atau peran diturunkan. Bukti: source awal saja; belum ada uji akun dengan database. Dampak: persistensi akses sampai expiry (hingga 30 hari pada rememberMe lama). Perbaikan: setiap request memeriksa users.isActive, role, dan updatedAt; login/logout/update menaikkan versi sesi; rememberMe baru 7 hari. Regresi yang masih diperlukan: buat token di DB test, logout/demote/disable, lalu pastikan token lama 401 dan role lama tidak berlaku.

### V5 — RBAC server tidak konsisten dengan halaman yang dibatasi — High — CWE-862, CWE-863
File/fungsi: routes/alerts.ts PATCH /alerts/:id dan GET terkait, routes/reports.ts POST /reports, serta dashboard/devices/sensors/measurements read. Akar: route hanya memakai authenticate sementara halaman React mensyaratkan operator/admin. Skenario: akun public menutup alert atau membuat report via API langsung. Bukti: source awal; uji end-to-end dengan akun public tidak dilakukan. Dampak: perubahan status peringatan dan paparan data operasional. Perbaikan: requireRole operator/admin pada route yang sesuai. Regresi: unit guard public→admin 403; tes integrasi per route masih diperlukan.

### V6 — Password admin seed diketahui umum — Medium — CWE-798
File/fungsi: scripts/src/seed.ts seed users. Akar: password123 di-hash untuk seluruh akun termasuk admin dan dicetak ke terminal. Skenario: database yang pernah di-seed dan belum dirotasi dapat dimasuki memakai password sumber. Bukti: source awal; status akun dalam database tidak diperiksa. Dampak: pengambilalihan akun pada environment yang memakai seed tersebut. Perbaikan: LANDSAFE_SEED_PASSWORD unik, minimal 12 dan maksimal 72 byte, tidak dicetak. Regresi: seed gagal tanpa password environment yang valid. Akun yang sudah ada wajib dirotasi secara operasional.

### V7 — Input query dan ID diterima secara longgar — Medium — CWE-20
File/fungsi: routes/measurements.ts, sensors.ts, alerts.ts, dashboard.ts, audit.ts, ai.ts, dan route parameter lain. Akar: Number/parseInt parsial, Date tidak valid, limit negatif/NaN, dan safeParse gagal yang diam diam memakai filter default. Skenario: parameter cacat menghasilkan error database atau menghilangkan filter yang diharapkan. Bukti: source awal, tidak ada request terautentikasi ke database. Dampak: ketidakstabilan API dan pembacaan data yang lebih luas dari filter yang diminta. Perbaikan: parser ID/limit/tanggal yang tegas; 400 untuk filter invalid; body sensitif memakai strict. Regresi: tes parser invalid dan HTTP body malformed/unexpected/oversize lulus.

### V8 — CORS wildcard, header/error safety, dan pembatasan body absen — Low/Medium — CWE-942, CWE-693
File/fungsi: artifacts/api-server/src/app.ts. Akar: cors() default, tanpa header khusus, JSON body tanpa batas aplikasi yang dipilih, dan default error handler. Skenario: origin tak dipercaya membaca respons bila memiliki token; konfigurasi browser/deployment menjadi lebih lemah; payload invalid dapat memicu respons verbose. Bukti: HTTP awal Access-Control-Allow-Origin: * serta header X-Content-Type-Options absen; bagian error awal hanya dari source. Dampak: pertahanan browser lemah dan error detail berpotensi bocor. Perbaikan: origin allowlist, header dasar, batas JSON 32 KB, error JSON generik, X-Powered-By nonaktif. Regresi: HTTP origin tidak dipercaya tanpa ACAO, header terpasang, JSON malformed 400, body 33 KB 413.

### V9 — Tidak ada batas percobaan login — Medium — CWE-307
File/fungsi: artifacts/api-server/src/routes/auth.ts. Akar: request login awal selalu menuju lookup password tanpa throttle. Skenario: tebakan password berulang terhadap akun yang diketahui. Bukti: source awal, brute force tidak dilakukan. Dampak: peluang credential stuffing meningkat. Perbaikan: batas 5 percobaan per pasangan IP/email dan 20 per IP per 15 menit; 429 dan Retry-After. Regresi yang diperlukan: uji 6 request aman pada DB test; limiter saat ini per proses dan belum tersinkron antar instance.

## D. Potential Vulnerabilities Requiring Verification

- JWT tetap disimpan di localStorage. Jika XSS ditemukan, token dapat dibaca skrip; tidak ditemukan jalur XSS yang terbukti pada halaman aktif. Komponen chart memakai dangerouslySetInnerHTML untuk CSS tetapi tidak ditemukan pemanggilnya, sehingga belum diklasifikasikan sebagai XSS.
- Tiga advisory pada dependency terkunci: qs 6.15.3 (dua advisory) dan fflate 0.6.10 (satu). Audit membuktikan versi rentan terpasang, tetapi prasyarat fungsi qs dan unzipSync dari input tak tepercaya belum ditemukan dalam LANDSAFE. Tidak ada upgrade otomatis.
- File sourcemap API tersedia pada output build, tetapi tidak ada route static yang menyajikannya. Kebocoran jarak jauh belum terbukti.
- Hak database akun aplikasi, TLS/reverse proxy, CSP frontend, rotasi secret, dan konfigurasi monitoring produksi tidak ada dalam repo atau belum diuji.
- Login limiter berbasis memori per proses. Deployment multi-instance perlu store bersama bila paparan Internet nyata.

## E. Passed Security Controls

- Penolakan anonim pada route terlindungi, token invalid/expired/diubah, serta token demo setelah fix terbukti lewat HTTP lokal.
- Penolakan token sensor salah atau dipakai untuk sensor ID lain terbukti lewat HTTP lokal sebelum database.
- Bearer JWT memakai algoritma dan konteks eksplisit; klaim peran tidak dipercaya tanpa lookup akun, terbukti dari source setelah fix.
- Query database memakai Drizzle eq/and dan template sql, tidak ditemukan interpolasi raw SQL dari request; pemeriksaan statis, bukan uji injeksi.
- bcryptjs dipakai untuk verifikasi dan hash password. Respons users memformat tanpa passwordHash; pemeriksaan statis.
- Python worker dipanggil dengan spawn tanpa shell dan path model tetap; pemeriksaan statis.
- Tidak ditemukan route upload, SSRF outbound, atau cookie autentikasi. Cookie sidebar_state hanya menyimpan status UI.

## F. Failed Security Controls

Sebelum perbaikan: autentikasi token demo, autentikasi ingest, fallback secret, pencabutan token/peran, RBAC beberapa route, password seed, validasi query, pembatasan login, CORS, dan header/error safety. Setelah perbaikan, tidak ada kegagalan pada subset HTTP tanpa database yang diuji. Kegagalan dependency advisory tetap tercatat sebagai versi rentan, bukan exploit aplikasi yang terkonfirmasi.

## G. Security Test Matrix

| Category | Test | Expected Secure Behavior | Actual Behavior | Status | Severity |
| --- | --- | --- | --- | --- | --- |
| Auth | Demo token awal ke /audit | 401 | 403, token melewati auth | FAIL awal; PASS retest 401 | Critical |
| Auth | JWT tidak valid/expired/diubah | 401 | 401 setelah fix | PASS | High |
| Auth | JWT tanpa header | 401 | 401 | PASS | High |
| Auth | Akun disabled setelah token terbit | 401 | Source memeriksa DB; uji DB tidak ada | PARTIAL | High |
| Auth | Logout lalu token lama | 401 | Source mengubah updatedAt; uji DB tidak ada | PARTIAL | High |
| RBAC | Public menuju guard admin | 403 | 403 pada unit test | PASS unit; NOT TESTED HTTP+DB | High |
| RBAC | Public PATCH alert / POST report | 403 | requireRole ada; uji DB tidak ada | PARTIAL | High |
| IoT | POST measurement anonim | 401 | awal 400; retest 401 | PASS | Critical |
| IoT | Token sensor untuk ID lain | 401 | 401 | PASS | High |
| IoT | Replay sensor+timestamp | 409 | transaksi/advisory lock ada; uji DB tidak ada | NOT TESTED | High |
| Input | ID/limit/tanggal invalid | 400 | parser unit menolak; HTTP+DB tidak ada | PARTIAL | Medium |
| Input | Body tak dikenal/malformed/33 KB | 400/400/413 | 400/400/413 | PASS | Medium |
| Rate limit | Login berulang aman | 429 | source limiter ada; uji login DB tidak ada | PARTIAL | Medium |
| CORS | Origin tak dipercaya | tanpa ACAO | awal wildcard; retest tanpa ACAO | PASS | Low |
| Headers | nosniff/frame/HSTS produksi | header hadir | hadir pada HTTP lokal | PASS | Low |
| Errors | JSON malformed | 400 generik | 400 generik | PASS | Low |
| DB | Permission akun & constraint | least privilege | tidak diperiksa | NOT TESTED | High |
| Dependencies | Audit paket produksi | tanpa advisory relevan | 3 advisory moderate pada lock | PARTIAL | Medium |
| Python | Command injection dari route | tidak ada shell | spawn tanpa shell; tidak ada route langsung | PASS static | Medium |
| Secrets | Startup tanpa secret | fail closed | guard source; uji child tanpa secret belum ada | PARTIAL | High |

## H. Recommended Remediation

Perbaikan kode V1–V9 telah diterapkan. Langkah operasional berikut masih perlu dilakukan: set SESSION_SECRET acak kuat; konfigurasi token berbeda untuk tiap sensor ESP32; rotasi password akun lama yang pernah dibuat seed; jalankan tes integrasi pada database testing; pastikan TLS/reverse proxy dan header frontend; triase tiga advisory dependency berdasarkan jalur penggunaan sebelum upgrade terencana. Lihat security-configuration.md.

## I. Regression Tests

scripts/src/security.test.ts menguji penolakan JWT/demo/anonim, ikatan token sensor, CORS/header, error/body limit, guard peran, dan parser input. Tes integration database yang perlu ditambahkan: login nyata, perubahan peran/status akun, logout token lama, public PATCH alert dan POST report, insert measurement valid, replay concurrent, timestamp di luar rentang, lokasi sensor yang dipalsukan, serta role PostgreSQL yang tidak boleh DDL.

## J. Remaining Security Risks

Tidak ada uji tulis/read database karena credential yang tersedia tidak dinyatakan testing. Password lama mungkin masih aktif. CORS/header yang diuji hanya milik API; frontend produksi bergantung pada hosting. Rate limiter login tidak lintas instance. Penyimpanan token localStorage memperbesar dampak XSS bila jalurnya muncul. Advisory dependency belum di-upgrade sesuai instruksi. Tidak ada audit event login/otorisasi yang persisten pada tabel audit_logs; Pino mencatat status HTTP, tetapi kemampuan alerting eksternal tidak terlihat.

## K. Production Readiness Considerations

Jangan deploy sampai SESSION_SECRET, token per sensor, TLS, CORS origin, rotasi akun seed lama, dan tes DB end-to-end selesai. API sekarang fail closed bila secret absen. Hasil tes saat ini tidak membuktikan bahwa deployment produksi atau data historis aman. Tidak ada migration, penghapusan data, brute force, payload destruktif, atau akses ke sistem eksternal yang dilakukan.

## Status terminology

- CONFIRMED VULNERABILITY: V1–V9 dibuktikan oleh source; hanya V1, V2, dan V8 juga memiliki bukti HTTP awal yang eksplisit.
- POTENTIAL ISSUE: dependency reachability, localStorage/XSS, konfigurasi deployment, dan distributed rate limiting.
- FALSE POSITIVE: chart HTML sink belum dipakai, sourcemap backend tidak disajikan Express, serta raw SQL dinamis dari input tidak ditemukan.
- SECURITY CONTROL PASSED: subset tes HTTP dan pemeriksaan statis pada bagian E/G.
- NOT TESTED: alur database berakun nyata, replay concurrent, PostgreSQL privilege, Python dengan input tak tepercaya, dan deployment produksi.
## Security Scorecard

| Area | Status | Evidence |
| --- | --- | --- |
| Authentication | PARTIAL | Demo token, invalid JWT, dan secret fallback ditutup; login dan status akun belum diuji dengan DB testing. |
| Authorization | PARTIAL | requireRole ditambahkan pada route operasional dan unit guard 403; matriks akun nyata belum diuji. |
| API security | PARTIAL | Body limit, error generik, parser query, dan penolakan anonim lolos; semua route belum diuji dengan data. |
| Database security | NOT TESTED | Query Drizzle terparameterisasi dari source, tetapi hak akun PostgreSQL, constraint, dan transaksi replay belum diuji. |
| Frontend security | PARTIAL | Tombol demo dihapus dan respons React ter-escape; token masih di localStorage dan CSP hosting belum dilihat. |
| IoT security | PARTIAL | Anonim/cross-sensor ditolak; deduplikasi, clock skew, dan persistensi belum diuji dengan DB test. |
| Infrastructure | PARTIAL | API CORS/header teruji lokal; TLS, proxy, dan frontend produksi belum tersedia. |
| Dependency security | PARTIAL | pnpm audit menemukan tiga advisory moderate; keterjangkauan pada LANDSAFE belum dibuktikan dan tidak ada upgrade otomatis. |
| Secrets management | PARTIAL | API fail closed dan seed perlu password environment; konfigurasi secret nyata serta rotasi akun lama belum diverifikasi. |
| Logging/monitoring | PARTIAL | Pino mencatat request/status dan meredaksi header sensitif; audit event persisten dan alerting belum ada bukti. |
