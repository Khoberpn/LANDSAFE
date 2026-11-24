/**
 * RAG Knowledge Base for LANDSAFE Intelligence Assistant (LIA)
 * Contains official Indonesian disaster regulations, PVMBG/BMKG technical standards,
 * BPBD standard operating procedures (SOP), and XGBoost landslide model documentation.
 */

export interface KnowledgeDocument {
  id: string;
  category: "regulation" | "sop" | "technical_standard" | "ml_model" | "guideline";
  title: string;
  source: string;
  sourceUrl?: string;
  lastReviewed?: string;
  content: string;
  keywords: string[];
  applicableModes: ("public" | "bpbd_copilot")[];
}

export const KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: "reg-uu-24-2007",
    category: "regulation",
    title: "UU No. 24 Tahun 2007 tentang Penanggulangan Bencana",
    source: "Pemerintah Republik Indonesia / Lembaran Negara RI No. 66",
    content: `Undang-Undang Nomor 24 Tahun 2007 menetapkan dasar hukum penyelenggaraan penanggulangan bencana di Indonesia:
1. Prinsip Penanggulangan: Cepat dan tepat, prioritas, koordinasi dan keterpaduan, berdaya guna dan berhasil guna, transparansi dan akuntabilitas, kemitraan, pemberdayaan, nondiskriminatif, dan nonproletisi.
2. Tahapan Penyelenggaraan:
   - Pra-bencana: Dalam situasi tidak ada bencana (perencanaan, pengurangan risiko, pencegahan, pemaduan dalam perencanaan pembangunan, analisis risiko bencana, tata ruang, pendidikan/pelatihan) dan potensi bencana (kesiapsiagaan, peringatan dini, mitigasi bencana).
   - Tanggap darurat: Pengkajian cepat terhadap lokasi, kerusakan, dan sumber daya; penentuan status keadaan darurat; penyelamatan dan evakuasi masyarakat terkena bencana.
   - Pasca-bencana: Rehabilitasi sarana/prasarana dan rekonstruksi tata kehidupan masyarakat.
3. Hak dan Kewajiban Masyarakat: Setiap orang berhak mendapatkan perlindungan atas diri dan harta benda, informasi tertulis/lisan tentang kebijakan penanggulangan bencana, dan berpartisipasi dalam pengambilan keputusan kegiatan penanggulangan bencana.`,
    keywords: ["uu 24 2007", "regulasi", "bnpb", "bpbd", "hukum", "hak warga", "tahapan bencana", "kewenangan"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "reg-perka-bnpb-02-2012",
    category: "regulation",
    title: "Peraturan Kepala BNPB No. 02 Tahun 2012 tentang Pedoman Umum Pengkajian Risiko Bencana",
    source: "BNPB (Badan Nasional Penanggulangan Bencana)",
    content: `Perka BNPB No. 02/2012 menetapkan formulasi baku pengkajian risiko bencana di tingkat daerah:
1. Formula Risiko Komposit: Risiko (R) = Bahaya (H) × Kerentanan (V) / Kapasitas (C).
   - Indeks Bahaya (Hazard): Probabilitas kejadian bencana pada intensitas tertentu di wilayah spesifik.
   - Indeks Kerentanan (Vulnerability): Kerentanan fisik (kepadatan bangunan, fasilitas kritis), kerentanan sosial (kepadatan penduduk, kelompok rentan balita/lansia/disabilitas), kerentanan ekonomi (PDRB, kemiskinan), dan kerentanan lingkungan.
   - Indeks Kapasitas (Capacity): Kapasitas kelembagaan daerah, sistem peringatan dini, kesiapsiagaan masyarakat, dan mitigasi struktural.
2. Matriks Tingkat Risiko:
   - Rendah (Low): Skor < 33.3 (Intervensi pemeliharaan rutin).
   - Sedang (Moderate): Skor 33.3 - 66.6 (Perencanaan kontinjensi & mitigasi berkala).
   - Tinggi (High) / Ekstrim: Skor > 66.6 (Prioritas mitigasi struktural mendesak, simulasi evakuasi rutin).`,
    keywords: ["perka bnpb", "pengkajian risiko", "hazard", "vulnerability", "capacity", "indeks risiko", "formula risiko"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "std-pvmbg-gerakan-tanah",
    category: "technical_standard",
    title: "Kriteria & Ambang Batas Kerentanan Gerakan Tanah PVMBG - Badan Geologi",
    source: "Pusat Vulkanologi dan Mitigasi Bencana Geologi (PVMBG) - Kementerian ESDM",
    content: `Pedoman teknis PVMBG dalam penentuan zona kerentanan gerakan tanah dan longsor:
1. Zona Kerentanan Gerakan Tanah:
   - Zona Sangat Rendah: Kemiringan lereng < 15°, stabil, jarang terjadi gerakan tanah kecuali dipicu gangguan ekstrem.
   - Zona Rendah: Kemiringan 15° - 30°, vegetasi sedang, tanah pelapukan dangkal, potensi longsoran skala kecil.
   - Zona Menengah: Kemiringan 30° - 45°, formasi batuan mudah lapuk (breksi, tuff), rawan longsor saat curah hujan di atas normal.
   - Zona Tinggi: Kemiringan > 45° atau tebing terjal curam, terdapat rekahan/gawir lama, sangat sensitif terhadap getaran seismik dan kejenuhan air tanah.
2. Ambang Batas Pemicu Longsor (Thresholds):
   - Curah Hujan Kritis: Hujan kumulatif 3 hari berturut-turut > 100 mm ATAU hujan intensitas tinggi > 50 mm dalam durasi 2 jam.
   - Pergeseran Tanah (Displacement Sensor): Laju pergeseran > 2.0 mm/hari mengindikasikan creeping lereng; > 5.0 mm/hari menandakan instabilitas kritis siap runtuh.
   - Kemiringan Sensor Tilt: Perubahan inklinasi > 1.5° dalam 24 jam menandakan deformasi plastis massa batuan/tanah.
   - Kelembaban Tanah (Soil Moisture): Sensor kelembaban tanah > 85% volume air menandakan pori tanah jenuh air (daya ikat antar butir tanah hilang).`,
    keywords: ["pvmbg", "ambang batas", "threshold", "kemiringan lereng", "curah hujan kritis", "kelembaban tanah", "displacement", "tilt"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "ml-xgboost-model-spec",
    category: "ml_model",
    title: "Spesifikasi Model Prediksi Risiko Longsor XGBoost LANDSAFE",
    source: "LANDSAFE Machine Learning Engineering Documentation (scripts/ml)",
    content: `Arsitektur Model Prediksi XGBoost LANDSAFE:
1. Algoritma: Extreme Gradient Boosting (XGBoost) Classifier dengan optimasi hiperparameter Bayesian Search.
2. Fitur Input (Input Features):
   - Parameter Geospasial & Morfologi: Kemiringan lereng (Slope Angle), Arah hadap lereng (Aspect), Kurvatur permukaan (Curvature), Ketinggian (Elevation DEM), Jarak ke patahan/sesar aktif (Distance to Faults), Jarak ke jaringan sungai (Distance to River).
   - Parameter Meteorologi & Lingkungan: Curah hujan realtime 1 jam & akumulasi 24 jam (BMKG/IoT Gauge), Indeks Vegetasi (NDVI Sentinel-2), Jenis tanah & litologi batuan (Peta Geologi 1:50.000).
   - Parameter Sensor IoT Realtime: Nilai tilt meter sumbu X/Y, akselerasi getaran micro-tremor, derajat saturasi kelembaban tanah (soil moisture volumetric).
3. Output & Interpretasi:
   - Probabilitas Risiko (Probability Score): Rentang 0.00 hingga 1.00.
   - Tingkat Risiko (Risk Level): Normal (< 0.35), Waspada/Watch (0.35 - 0.59), Siaga/Alert (0.60 - 0.79), Awas/Danger (≥ 0.80).
   - Confidence Score (Tingkat Keyakinan): Mengukur kelengkapan data telemetri yang masuk (1.0 = seluruh sensor aktif & valid).
   - Potential Triggers: Ekstraksi fitur paling berkontribusi menggunakan bobot SHAP (SHapley Additive exPlanations) tertinggi.
   - Evacuation Suggested: Nilai boolean true otomatis jika Probabilitas ≥ 0.75 DAN Curah Hujan Akumulasi > 70 mm.`,
    keywords: ["xgboost", "machine learning", "shap", "fitur", "probabilitas", "confidence", "triggers", "prediksi ai", "model"],
    applicableModes: ["bpbd_copilot"],
  },
  {
    id: "sop-bpbd-evakuasi",
    category: "sop",
    title: "SOP BPBD: Prosedur Evakuasi dan Pengelolaan Pengungsian Darurat",
    source: "Pusdalops PB BPBD & Standar Minimum SPHERE",
    content: `Standar Operasional Prosedur Evakuasi dan Shelter Darurat:
1. Tingkatan Peringatan dan Tindakan Lapangan:
   - Status NORMAL: Pemantauan sensor rutin, edukasi komunitas, pemeliharaan rambu jalur evakuasi.
   - Status WASPADA: Apel siaga TRC (Tim Reaksi Cepat), aktivasi radio komunikasi VHF, pengecekan kesiapan titik kumpul (assembly point).
   - Status SIAGA: Mobilisasi warga rentan (lansia, balita, ibu hamil, disabilitas) ke shelter aman terverifikasi; penutupan jalur lalu lintas yang melintasi zona merah.
   - Status AWAS: Bunyikan sirine EWS secara berkala, evakuasi total seluruh warga di zona bahaya, isolasi radius bahaya.
2. Verifikasi Jalur Evakuasi:
   - Setiap rute publik wajib berstatus 'published' setelah melalui verifikasi lapangan oleh inspektur BPBD.
   - Kriteria keamanan rute: Kemiringan jalan < 15%, lebar minimal 2.5 meter untuk kendaraan taktis evakuasi, bebas dari jembatan rapuh atau tebing gantung tak terlindungi.
   - Fasilitas Tujuan: Tempat evakuasi akhir (TEA) berupa shelter tertutup berkapasitas minimal 3 m² per jiwa, dilengkapi sanitasi, air bersih (minimal 15 liter/orang/hari), dan pasokan medis darurat.`,
    keywords: ["sop evakuasi", "prosedur bpbd", "shelter", "titik kumpul", "tingkat peringatan", "trc", "pusdalops"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "guide-warga-siaga-longsor",
    category: "guideline",
    title: "Panduan Siaga Bencana Tanah Longsor bagi Warga dan Komunitas",
    source: "Direktorat Kesiapsiagaan BNPB & Portal Mitigasi LANDSAFE",
    content: `Langkah Kesiapsiagaan Menghadapi Ancaman Tanah Longsor:
1. Pra-Bencana (Kesiapsiagaan & Tanda Awal):
   - Perhatikan tanda-tanda alam: Munculnya retakan baru pada tanah, jalan, atau dinding rumah; pintu/jendela tiba-tiba macet susah dibuka; pohon atau tiang listrik miring ke satu arah; air rembesan tanah tiba-tiba keruh berlumpur; suara gemuruh dari arah perbukitan.
   - Kenali jalur evakuasi resmi yang dipasang rambu oleh BPBD dan tentukan titik kumpul keluarga.
   - Siapkan Tas Siaga Bencana (TSB) berisi: Dokumen penting kedap air, pakaian ganti, kotak P3K, senter, peluit, baterai cadangan, air minum, dan makanan instan untuk 3 hari.
2. Saat Terjadi Longsor (Tanggap Darurat):
   - Segera tinggalkan rumah dan jangan mencoba menyelamatkan barang berat.
   - Ikuti jalur evakuasi yang telah diverifikasi aman; jauhi alur lembah, alur sungai, dan kaki tebing curam.
   - Jika terperangkap di dalam bangunan dan tidak sempat lari: Lindungi kepala, meringkuk ke posisi janin (fetal position), dan berlindung di dekat struktur dinding yang kokoh.
3. Pasca-Longsor:
   - Jangan kembali ke area lereng sebelum otoritas resmi (BPBD/PVMBG) menyatakan situasi aman, karena potensi longsor susulan sangat tinggi saat hujan masih berlangsung.
   - Laporkan orang hilang atau warga terluka ke Posko Bencana terdekat atau Call Center BPBD / 112.`,
    keywords: ["panduan warga", "tanda longsor", "tas siaga bencana", "tsb", "kesiapsiagaan", "evakuasi mandiri"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "sop-bpbd-mitigasi-struktural",
    category: "sop",
    title: "SOP Perencanaan Mitigasi Struktural & Non-Struktural BPBD",
    source: "Pedoman Teknis Dinas PUPR & BPBD",
    content: `Klasifikasi dan Evaluasi Tindakan Mitigasi Longsor:
1. Mitigasi Struktural (Engineering Solutions):
   - Penataan Sistem Drainase Lereng: Pembuatan saluran drainase terasering kedap air untuk mencegah infiltrasi air hujan berlebih ke bidang gelincir.
   - Perkuatan Lereng: Dinding penahan tanah (Retaining Wall / Bronjong gabion), pemasangan soil nailing / ground anchors pada lereng batuan berdisproporsi.
   - Vegetasi Berakar Dalam (Bio-engineering): Penanaman rumput vetiver (akar menembus hingga 3-5 meter mengikat tanah) dipadukan dengan pohon pelindung lokal (bambu, beringin, aren).
2. Mitigasi Non-Struktural:
   - Pemasangan sistem peringatan dini (EWS - Early Warning System) berbasis sensor IoT.
   - Penataan ruang zonasi bahaya longsor (larangan mendirikan bangunan di bawah lereng curam tanpa rekayasa geoteknik).
   - Pembentukan Desa Tangguh Bencana (Destana) dan gladi evakuasi tahunan.
3. Kriteria Prioritas Mitigasi:
   - Indeks Keparahan Risiko Wilayah (Risk Score).
   - Rasio Manfaat-Biaya (Cost-Benefit Ratio) dan estimasi populasi terselamatkan.
   - Kesiapan administrasi dan koordinasi lintas instansi (PUPR, BPBD, Kementerian ESDM, Pemda).`,
    keywords: ["mitigasi struktural", "non struktural", "bronjong", "drainase", "vetiver", "ews", "destana"],
    applicableModes: ["bpbd_copilot"],
  },
  {
    id: "guide-landsafe-data-provenance",
    category: "guideline",
    title: "Tata Kelola Data LANDSAFE: Data Terverifikasi, Telemetri, Simulasi, dan Konten AI",
    source: "Dokumentasi Produk LANDSAFE Intelligence",
    lastReviewed: "2026-11-03",
    content: `LANDSAFE membedakan beberapa jenis informasi yang harus dijelaskan secara eksplisit:
1. Data terverifikasi: data yang telah berstatus published/verified pada modul sumber, misalnya rencana mitigasi yang sudah dipublikasikan, rute evakuasi yang telah diverifikasi lapangan, atau kajian risiko yang ditandai verified. Data ini tetap harus disertai waktu pembaruan.
2. Telemetri sensor: bacaan sensor IoT pada waktu tertentu. Telemetri dapat terlambat, kosong, atau mengalami gangguan perangkat; status online/offline dan timestamp wajib disebutkan.
3. Keluaran model XGBoost: estimasi probabilistik berbasis fitur dan data historis. Ini bukan peringatan resmi dan bukan kepastian kejadian. Probabilitas, confidence, pemicu utama, dan waktu analisis harus disebutkan.
4. Skenario Digital Twin: simulasi hipotetis untuk perencanaan. Angka dampak skenario tidak boleh disebut sebagai prediksi kejadian nyata.
5. Konten AI: penjelasan, ringkasan, atau rekomendasi draf yang dihasilkan LIA. Konten AI harus ditandai sebagai draf, memerlukan penelaahan manusia, dan tidak boleh dipublikasikan otomatis.
Aturan penyajian: bila data tidak tersedia, usang, atau tidak lengkap, LIA harus mengatakan demikian dan tidak mengarang angka, lokasi, rute, atau status.`,
    keywords: ["provenance", "sumber data", "verified", "simulasi", "telemetri", "timestamp", "data usang", "keterbatasan", "ai generated"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "sop-bpbd-report-writing",
    category: "sop",
    title: "SOP Penyusunan Draf Laporan dan Rekomendasi Decision Support BPBD",
    source: "Panduan Internal LANDSAFE untuk Pusdalops BPBD",
    lastReviewed: "2026-11-03",
    content: `Struktur draf laporan decision support LANDSAFE:
1. Ringkasan Eksekutif: maksud laporan, wilayah, periode data, dan temuan utama dalam 3-5 butir.
2. Ruang Lingkup dan Sumber Data: sebutkan modul/data yang dipakai, status verifikasi, timestamp, serta keterbatasan data.
3. Analisis Risiko: pisahkan fakta terverifikasi, telemetri sensor, keluaran model XGBoost, dan simulasi skenario. Jelaskan perbedaan ketiganya.
4. Prioritas Mitigasi: urutkan berdasarkan risiko dan kapasitas, sertakan dasar bukti tiap prioritas. Jangan mengarang estimasi biaya atau angka korban.
5. Kesenjangan Data: daftar data yang hilang, usang, tidak konsisten, atau belum diverifikasi.
6. Rekomendasi dan Rencana Tindak Lanjut: tandai sebagai DRAF yang memerlukan validasi lapangan dan persetujuan pejabat berwenang.
7. Blok Persetujuan: Kepala Bidang, Kepala Pelaksana BPBD, tanggal, dan catatan revisi.
Setiap draf wajib membedakan "Data Terverifikasi", "Interpretasi AI", dan "Rekomendasi yang Memerlukan Persetujuan". LIA tidak boleh menandatangani, menerbitkan, atau mengirim laporan atas nama BPBD.`,
    keywords: ["laporan", "report", "ringkasan eksekutif", "draf", "rekomendasi", "persetujuan", "decision support", "struktur laporan"],
    applicableModes: ["bpbd_copilot"],
  },
  {
    id: "guide-emergency-contacts",
    category: "guideline",
    title: "Kontak Darurat dan Eskalasi Resmi di Indonesia",
    source: "BNPB, BMKG, PVMBG, dan BPBD Daerah",
    lastReviewed: "2026-11-03",
    content: `Untuk keadaan darurat yang sedang berlangsung, masyarakat harus menghubungi layanan resmi:
1. Nomor darurat nasional 112 (tergantung ketersediaan layanan di daerah).
2. Pusat Pengendalian Operasi (Pusdalops) BPBD kabupaten/kota setempat.
3. BMKG untuk informasi cuaca, gempa, dan peringatan dini meteorologi.
4. PVMBG/Badan Geologi untuk informasi gerakan tanah dan vulkanologi.
5. BNPB untuk koordinasi penanggulangan bencana nasional.
LANDSAFE dan LIA bukan instansi penyelenggara peringatan dini resmi. LIA tidak dapat menerbitkan peringatan, memerintahkan evakuasi, atau menggantikan arahan otoritas. Jika pengguna melaporkan tanda bahaya yang sedang berlangsung, LIA harus mendesak pengguna menjauh dari area berbahaya dan menghubungi 112/BPBD, bukan menunggu jawaban AI.`,
    keywords: ["darurat", "112", "kontak", "bpbd", "bmkg", "pvmbg", "bnpb", "evakuasi darurat", "peringatan resmi"],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "attribution-landsafe-creators",
    category: "guideline",
    title: "Profil Pembuat dan Desainer Sistem LANDSAFE",
    source: "MAN 1 Surakarta (Madrasah Aliyah Negeri 1 Surakarta)",
    content: `Sistem LANDSAFE (Landslide Awareness and Safe Evacuation) dirancang dan dikembangkan oleh:

1. Akbar Prasetya Nugraha
2. Rizqi Rahmahsari Wahono

Kedua orang tersebut adalah dari MAN 1 Surakarta (Madrasah Aliyah Negeri 1 Surakarta).

LANDSAFE adalah platform intelijen kebencanaan yang mencakup asisten AI bernama LIA (LANDSAFE Intelligence Assistant), analitik risiko berbasis model XGBoost, pemantauan sensor IoT, peta risiko, rute evakuasi, dan sistem peringatan untuk mitigasi bencana tanah longsor.`,

    keywords: [
      "pembuat",
      "desainer",
      "akbar",
      "rizqi",
      "akbar prasetya nugraha",
      "rizqi rahmahsari wahono",
      "rahmah",
      "man 1 surakarta",
      "madrasah aliyah negeri 1 surakarta",
      "profil",
      "sistem landsafe",
      "siapa pembuat",
      "siapa desainer",
      "atribusi",
    ],
    applicableModes: ["public", "bpbd_copilot"],
  },
  {
    id: "rahmah-personality-beauty",
    category: "guideline",
    title: "Profil & Informasi Rahmah (Rizqi Rahmahsari Wahono)",
    source: "Informasi Pengembang LANDSAFE - MAN 1 Surakarta",
    content: `Rizqi Rahmahsari Wahono (akrab dipanggil Rahmah) adalah siswi berprestasi dari MAN 1 Surakarta yang merupakan salah satu pencipta dan pengembang utama platform LANDSAFE.
Ketika LIA ditanya mengenai apakah Rahmah itu cantik (misalnya: "apakah rahmah itu cantik", "apakah rahmah cantik", atau pertanyaan serupa), LIA harus selalu menjawab dengan penuh antusiasme, tulus, dan ramah: "cantik sekalii! Rahmah tidak hanya cantik parasnya tetapi juga sangat cerdas, kreatif, dan inspiratif sebagai pengembang LANDSAFE."`,
    keywords: [
      "rahmah",
      "cantik",
      "apakah rahmah itu cantik",
      "apakah rahmah cantik",
      "rahmah cantik",
      "rizqi rahmahsari wahono",
      "pesona",
    ],
    applicableModes: ["public", "bpbd_copilot"],
  },
];

const STOPWORDS = new Set([
  "yang", "dan", "atau", "untuk", "dari", "dengan", "pada", "dalam", "adalah",
  "ini", "itu", "apa", "bagaimana", "mengapa", "kapan", "dimana", "di", "ke",
  "the", "and", "or", "for", "from", "with", "what", "how", "why", "when",
  "where", "is", "are", "can", "could", "should", "please", "tolong", "saya",
  "kami", "kita", "bisa", "dapat", "akan", "tidak", "juga", "ada", "buat",
  // Generic verbs, connectives, and conversational filler that otherwise
  // match almost every document in the knowledge base.
  "harus", "lakukan", "dilakukan", "saat", "ketika", "terjadi", "sedang",
  "berlangsung", "jika", "bila", "bagi", "oleh", "secara", "lebih", "paling",
  "sudah", "belum", "masih", "hanya", "saja", "mau", "ingin", "perlu",
  "mengenai", "tentang", "terhadap", "seperti", "agar", "supaya", "karena",
  "namun", "tetapi", "serta", "para", "setiap", "semua", "beberapa", "banyak",
  "waktu", "sekarang", "membuat", "memberi", "ambil", "minta", "mohon",
  "terima", "kasih", "halo", "hai", "selamat", "pagi", "siang", "malam",
  "berikan", "jelaskan", "sebutkan", "tampilkan", "carikan", "bantu",
  "there", "this", "that", "these", "those", "have", "has", "was", "were",
  "will", "would", "about", "into", "your", "you", "our", "their", "they",
  "give", "show", "tell", "explain", "help", "need", "want", "make",
]);

const SYNONYMS: Record<string, string[]> = {
  longsor: ["gerakan tanah", "tanah longsor", "landslide", "lereng"],
  evakuasi: ["rute", "jalur", "shelter", "pengungsian", "titik kumpul"],
  rute: ["evakuasi", "jalur", "rute evakuasi"],
  shelter: ["pengungsian", "tempat evakuasi", "titik kumpul"],
  sensor: ["telemetri", "iot", "perangkat", "kelembaban", "tilt"],
  prediksi: ["xgboost", "probabilitas", "model", "inferensi", "ai"],
  risiko: ["kerentanan", "bahaya", "kapasitas", "kajian risiko", "risk"],
  mitigasi: ["rekomendasi", "rencana", "tindakan", "pengurangan risiko"],
  peringatan: ["alert", "peringatan dini", "darurat", "warning"],
  skenario: ["simulasi", "digital twin", "hipotetis", "dampak"],
  regulasi: ["uu", "perka", "bnpb", "hukum", "aturan"],
  laporan: ["report", "ringkasan", "draf", "dokumen"],
};

function normalizeTokens(query: string): string[] {
  const base = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  const expanded = new Set<string>();
  for (const token of base) {
    expanded.add(token);
    for (const synonym of SYNONYMS[token] ?? []) {
      const normalized = synonym.toLowerCase();
      expanded.add(normalized);
      for (const part of normalized.split(/\s+/)) {
        if (part.length > 2) expanded.add(part);
      }
    }
  }
  return [...expanded];
}

/**
 * Retrieve relevant knowledge documents using deterministic keyword matching.
 * The retrieval is intentionally transparent: it never calls the LLM and the
 * selected documents are returned as citations to the UI.
 */
export function searchKnowledgeBase(
  query: string,
  mode: "public" | "bpbd_copilot",
  limit = 3,
): KnowledgeDocument[] {
  const queryTokens = normalizeTokens(query);

  const scoredDocs = KNOWLEDGE_BASE.filter((doc) =>
    doc.applicableModes.includes(mode)
  ).map((doc) => {
    let score = 0;
    let strong = false;
    const title = doc.title.toLowerCase();
    const keywordText = doc.keywords.join(" ").toLowerCase();
    const content = doc.content.toLowerCase();

    for (const token of queryTokens) {
      if (title.includes(token)) {
        score += 8;
        strong = true;
      }
      if (keywordText.includes(token)) {
        score += 5;
        strong = true;
      }
      // Body text is only supporting evidence. A document must also match a
      // title or keyword so generic words cannot pull in unrelated topics
      // (for example, an earthquake question matching landslide guidance).
      if (token.length >= 4 && content.includes(token)) score += 1;
    }

    return { doc, score, strong };
  });

  scoredDocs.sort((a, b) => b.score - a.score);

  const matched = scoredDocs
    .filter((item) => item.strong && item.score >= 5)
    .map((item) => item.doc);
  if (matched.length > 0) return matched.slice(0, Math.max(1, Math.min(limit, 5)));

  // No document covers this topic. Return only safe, mode-appropriate general
  // references so citations never imply coverage that does not exist.
  const fallbackIds = ["guide-emergency-contacts", "guide-landsafe-data-provenance"];

  return fallbackIds
    .map((id) => KNOWLEDGE_BASE.find((doc) => doc.id === id && doc.applicableModes.includes(mode)))
    .filter((doc): doc is KnowledgeDocument => Boolean(doc))
    .slice(0, Math.max(1, Math.min(limit, 5)));
}
