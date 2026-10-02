// Fills the database with demo content through the same calls the app makes, so a clean run also proves those flows.
//   npm run seed              refuses when an account outside @demo.awdirektori.test exists
//   npm run seed -- --force   runs anyway: it still deletes only demo accounts, but every event, banner and story
// Safe to re-run: the previous demo content is removed first.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const DOMAIN = '@demo.awdirektori.test';
const PASSWORD = 'asiaworks123';

// ───────────────────────────── Data ─────────────────────────────

// key = the email name. lp = sends the onboarding form for verification. verify: false = left waiting for staff.
const PEOPLE = [
  { key: 'staf', name: 'Tim AsiaWorks' },
  { key: 'lulusan', name: 'Dimas Prasetyo', nick: 'Dimas', phone: '0812-0000-0101', lp: 188, ib: 352, ia: 349 },
  { key: 'reza', name: 'Reza Mahendra', nick: 'Reza', phone: '0812-0000-0102', lp: 162 },
  { key: 'yoga', name: 'Yoga Pratama', nick: 'Yoga', phone: '0812-0000-0103', lp: 201, ib: 378, ia: 374 },
  { key: 'fitri', name: 'Fitri Handayani', nick: 'Fitri', phone: '0812-0000-0104', lp: 175 },
  { key: 'fadli', name: 'Andi Fadli Rahman', nick: 'Fadli', phone: '0812-0000-0105', lp: 170, ib: 318, ia: 315 },
  { key: 'rahma', name: 'Sitti Rahmawati', nick: 'Rahma', phone: '0812-0000-0106', lp: 193 },
  { key: 'tania', name: 'Tania Gunawan', nick: 'Tania', phone: '0812-0000-0107', lp: 205, ib: 386, ia: 381 },
  { key: 'kevin', name: 'Kevin Hartono', nick: 'Kevin', phone: '0812-0000-0108', lp: 181 },
  { key: 'mitha', name: 'Paramitha Kusumaningrum', nick: 'Mitha', phone: '0812-0000-0109', lp: 156, ib: 290, ia: 287 },
  { key: 'made', name: 'I Made Wirawan', nick: 'Made', phone: '0812-0000-0110', lp: 197 },
  { key: 'hendra', name: 'Hendra Sitompul', nick: 'Hendra', phone: '0812-0000-0111', lp: 150, ib: 279, ia: 276 },
  { key: 'irfan', name: 'Muhammad Irfan Syam', nick: 'Irfan', phone: '0812-0000-0112', lp: 184 },
  { key: 'rini', name: 'Rini Wulandari', nick: 'Rini', phone: '0812-0000-0113', lp: 209 },
  { key: 'nadia', name: 'Nadia Kusumawardhani', nick: 'Nadia', phone: '0812-0000-0114', lp: 212, ib: 399, ia: 395 },
  { key: 'bayu', name: 'Bayu Nugroho', nick: 'Bayu', phone: '0812-0000-0115', lp: 215, verify: false },
  { key: 'sekar', name: 'Sekar Ayuningtyas' }, // only signed up
];

// One listing per owner. state: live when absent, 'off' (approved, switched off by the owner), 'pending', 'draft'.
// tone = background of the placeholder image; without it the UI shows a monogram. promo.days = valid that long.
const BUSINESSES = [
  {
    owner: 'lulusan', name: 'Kopi Titik Temu', category: 'Food & Beverage', service: 'keduanya', tone: '6F1414', contact: '0812-0000-0151',
    description: 'Kedai kopi dengan tiga gerai di Jabodetabek. Biji kopinya kami sangrai sendiri tiap minggu, dari petani Toraja, Gayo, dan Flores. Coffee cart kami juga bisa dipesan untuk rapat, pernikahan, dan acara kantor.',
    links: ['https://instagram.com/kopititiktemu', 'https://tokopedia.com/kopititiktemu', 'https://www.kopititiktemu.example'],
    locations: [ // one listing, three branches
      { label: 'Gerai Kemang', address: 'Jl. Kemang Raya No. 24', city: 'Jakarta Selatan', area: 'Jabodetabek', lat: -6.2607, lng: 106.8136 },
      { label: 'Gerai Cikini', address: 'Jl. Cikini Raya No. 45', city: 'Jakarta Pusat', area: 'Jabodetabek', lat: -6.1905, lng: 106.8392 },
      { label: 'Gerai BSD', address: 'Jl. Pahlawan Seribu, Ruko Sektor VII Blok C7', city: 'Tangerang Selatan', area: 'Jabodetabek', lat: -6.2893, lng: 106.6645 },
    ],
    promo: { title: 'Diskon 15% untuk sesama lulusan', code: 'LULUSAN15', days: 90 },
  },
  {
    owner: 'reza', category: 'Lainnya', other: 'Konsultan pajak & pembukuan', service: 'jasa', contact: 'reza@mahendrakonsultan.example', // no business name: the owner's name shows
    description: 'Saya membantu UMKM merapikan pembukuan, melapor SPT, dan menyiapkan laporan keuangan untuk pengajuan modal ke bank. Sudah sembilan tahun mendampingi usaha kuliner, toko daring, dan jasa kreatif. Konsultasi pertama gratis untuk sesama lulusan.',
    links: ['https://www.mahendrakonsultan.example'],
    locations: [{ label: 'Kantor', address: 'Jl. KH Wahid Hasyim No. 88, Menteng', city: 'Jakarta Pusat', area: 'Jabodetabek', lat: -6.1868, lng: 106.8262 }],
  },
  {
    owner: 'yoga', name: 'Nalar Digital', category: 'Teknologi', service: 'jasa', tone: '2B2726', contact: 'halo@nalardigital.example', online: true, // online only, no location
    description: 'Studio kecil pembuat website, toko daring, dan aplikasi kasir untuk UMKM. Kami bekerja jarak jauh dari Tangerang Selatan dan melayani klien di seluruh Indonesia. Cocok untuk usaha yang ingin naik kelas tanpa harus punya tim IT sendiri.',
    links: ['https://instagram.com/nalardigital', 'https://www.nalardigital.example'],
    promo: { title: 'Gratis audit website untuk bisnis lulusan', code: 'AUDITGRATIS', pending: true },
  },
  {
    owner: 'fitri', name: 'Dapur Fitri', category: 'Food & Beverage', service: 'produk', tone: '8A6A2F', contact: '0812-0000-0154',
    description: 'Kue kering, bolu pandan, dan hampers buatan rumah di Depok. Semua dibuat per pesanan, tanpa pengawet, dan bisa dikirim ke seluruh Jabodetabek. Menjelang Lebaran dan Natal biasanya penuh, jadi pesan jauh hari ya.',
    links: ['https://instagram.com/dapurfitri.depok', 'https://tokopedia.com/dapurfitri'],
    locations: [{ label: 'Dapur rumah', city: 'Depok', area: 'Jabodetabek', mode: 'area', lat: -6.3728, lng: 106.8342 }], // home business: approximate area only
    promo: { title: 'Gratis ongkir Jabodetabek untuk hampers lulusan', code: 'HAMPERSGLP' },
  },
  {
    owner: 'fadli', name: 'Coto Paraikatte', category: 'Food & Beverage', service: 'keduanya', tone: '8B1A1A', contact: '0812-0000-0155',
    description: 'Coto Makassar, pallubasa, dan konro bakar dengan resep keluarga sejak 1998. Tempat kami muat 80 orang, pas untuk makan bareng rombongan kantor atau arisan. Kami juga menerima pesanan katering untuk acara di sekitar Makassar.',
    links: ['https://instagram.com/cotoparaikatte'],
    locations: [{ label: 'Rumah makan', address: 'Jl. Boulevard Raya No. 17, Panakkukang', city: 'Makassar', area: 'Makassar', lat: -5.1575, lng: 119.4472 }],
    promo: { title: 'Gratis es pisang ijo untuk rombongan lulusan', code: 'PARAIKATTE', days: 120 },
  },
  {
    owner: 'rahma', name: 'Rumah Sutra Sengkang', category: 'Fashion & Aksesoris', service: 'produk', tone: '4A0D0F', contact: '0812-0000-0156',
    description: 'Kain sutra tenun tangan dari perajin Sengkang, Wajo. Tersedia kain meteran, sarung, selendang, dan baju bodo siap pakai. Selembar kain ditenun sekitar dua minggu, jadi motifnya tidak pernah persis sama.',
    links: ['https://instagram.com/rumahsutrasengkang', 'https://tokopedia.com/rumahsutrasengkang'],
    locations: [{ label: 'Galeri', address: 'Jl. Somba Opu No. 62', city: 'Makassar', area: 'Makassar', lat: -5.144, lng: 119.4085 }],
    promo: { title: 'Potongan Rp 100.000 untuk kain sutra pertamamu', code: 'SUTRA100' },
  },
  {
    owner: 'tania', name: 'Studio Lini', category: 'Art, Craft & Creative', service: 'jasa', tone: 'D9D4CE', contact: 'halo@studiolini.example',
    description: 'Studio desain di Bandung untuk logo, kemasan, dan identitas merek. Kami senang bekerja dengan usaha kecil yang ingin tampil rapi sejak hari pertama. Prosesnya jelas: riset singkat, dua pilihan konsep, lalu revisi sampai pas.',
    links: ['https://instagram.com/studiolini', 'https://www.studiolini.example'],
    locations: [{ label: 'Studio', address: 'Jl. Ir. H. Juanda No. 152, Dago', city: 'Bandung', area: 'Jawa Barat & Banten', lat: -6.8856, lng: 107.6136 }],
    promo: { title: 'Diskon 20% paket logo dan identitas merek', code: 'LINI20', days: 60 },
  },
  {
    owner: 'kevin', name: 'Sorak Organizer', category: 'Entertainment', service: 'jasa', tone: '6F1414', contact: '0812-0000-0158',
    description: 'Event organizer di Surabaya untuk gathering kantor, peluncuran produk, dan resepsi pernikahan. Kami mengurus konsep, panggung, MC, sampai hiburan musik. Tim inti delapan orang, dengan jaringan vendor di seluruh Jawa Timur.',
    links: ['https://instagram.com/sorakorganizer', 'https://www.sorakorganizer.example'],
    locations: [{ label: 'Kantor', address: 'Jl. Tunjungan No. 41', city: 'Surabaya', area: 'Jawa Timur', lat: -7.2607, lng: 112.7384 }],
    promo: { title: 'Gratis MC untuk acara di atas 100 tamu', code: 'SORAKMC' },
  },
  {
    owner: 'mitha', name: 'Omah Jamu Sari Raga', category: 'Beauty, Health & Wellness', service: 'keduanya', tone: '8A6A2F', contact: '0812-0000-0159',
    description: 'Jamu segar botolan dan pijat tradisional di Yogyakarta. Kunyit asam, beras kencur, dan wedang uwuh kami buat tiap pagi dari rempah petani Kulon Progo. Ada juga kelas meracik jamu untuk rombongan kecil.',
    links: ['https://instagram.com/omahjamusariraga', 'https://tokopedia.com/sariraga', 'https://www.sariraga.example'],
    locations: [{ label: 'Kedai dan ruang pijat', address: 'Jl. Prawirotaman No. 18', city: 'Yogyakarta', area: 'Jawa Tengah & DIY', lat: -7.8195, lng: 110.3712 }],
    promo: { title: 'Diskon 10% semua jamu dan paket pijat', code: 'SARIRAGA10', days: 150 },
  },
  {
    owner: 'made', name: 'Jelajah Dewata Trip', category: 'Travel', service: 'jasa', tone: '2B2726', contact: '0812-0000-0160',
    description: 'Open trip dan private tour keliling Bali dan Nusa Penida bersama pemandu lokal berlisensi. Rombongan kecil, maksimal 12 orang, dengan rute yang tidak terburu-buru. Bisa juga diatur untuk outing kantor dan bulan madu.',
    links: ['https://instagram.com/jelajahdewata', 'https://www.jelajahdewata.example'],
    locations: [{ label: 'Kantor', address: 'Jl. Tukad Badung No. 9, Renon', city: 'Denpasar', area: 'Bali & Nusa Tenggara', lat: -8.679, lng: 115.231 }],
    promo: { title: 'Diskon 12% open trip Nusa Penida', code: 'DEWATA12' },
  },
  {
    owner: 'hendra', name: 'Rumah Belajar Horas', category: 'Edukasi', service: 'jasa', contact: 'halo@belajarhoras.example',
    description: 'Kursus bahasa Inggris dan coding untuk anak SD sampai SMP di Medan. Kelasnya kecil, maksimal delapan anak, dengan pengajar yang sabar dan suka bercanda. Ada juga kelas daring untuk anak di luar kota.',
    links: ['https://instagram.com/rumahbelajarhoras'],
    locations: [{ label: 'Ruang kelas', address: 'Jl. Setia Budi No. 120', city: 'Medan', area: 'Sumatera', lat: 3.5722, lng: 98.6384 }],
  },
  {
    owner: 'irfan', name: 'Pinisi Timur Trip', category: 'Travel', service: 'jasa', contact: '0812-0000-0162', state: 'off',
    description: 'Trip berlayar dengan kapal pinisi dari Makassar ke Kepulauan Spermonde dan Tanjung Bira. Paket dua sampai empat hari, sudah termasuk makan, snorkeling, dan awak kapal berpengalaman. Musim berlayar kami April sampai November.',
    links: ['https://instagram.com/pinisitimurtrip'],
    locations: [{ label: 'Dermaga keberangkatan', address: 'Jl. Pasar Ikan No. 28', city: 'Makassar', area: 'Makassar', lat: -5.1372, lng: 119.4066 }],
  },
  {
    owner: 'rini', name: 'Rana Hijab', category: 'Fashion & Aksesoris', service: 'produk', tone: '8B1A1A', contact: '0812-0000-0163', state: 'pending',
    description: 'Hijab voal dan pashmina dengan motif cetak rancangan sendiri. Bahannya adem, tidak licin, dan jahitan tepinya rapi. Kami kirim dari Bekasi ke seluruh Indonesia, dan menerima pesanan seragam untuk pengajian atau kantor.',
    links: ['https://instagram.com/ranahijab.id', 'https://tokopedia.com/ranahijab'],
    locations: [{ label: 'Toko', address: 'Jl. Bulevar Ahmad Yani Blok B2 No. 6, Summarecon Bekasi', city: 'Bekasi', area: 'Jabodetabek', lat: -6.2262, lng: 107.0012 }],
  },
  {
    owner: 'nadia', name: 'Bugar Bersama Studio', category: 'Beauty, Health & Wellness', service: 'jasa', contact: '0812-0000-0164', state: 'draft',
    description: 'Studio pilates dan yoga untuk pemula di Bogor. Kelas pagi dan sore, maksimal sepuluh orang per sesi, dengan instruktur bersertifikat. Sedang kami siapkan, rencananya buka awal tahun depan.',
    links: ['https://instagram.com/bugarbersama.bogor'],
    locations: [{ label: 'Studio', address: 'Jl. Pajajaran No. 63', city: 'Bogor', area: 'Jabodetabek', lat: -6.6012, lng: 106.806 }],
  },
];

// Tied to the owner's listing unless personal. days = deadline, counted from today.
const PELUANG = [
  { key: 'kopi', owner: 'lulusan', kind: 'supplier', days: 14, title: 'Cari supplier biji kopi arabika untuk 3 gerai',
    description: 'Kami butuh pasokan rutin sekitar 60 kg per bulan untuk gerai Kemang, Cikini, dan BSD. Lebih senang kalau langsung dari petani atau koperasi di Toraja, Gayo, atau Flores. Kirim sampel dulu ya, nanti kita cupping bareng.' },
  { key: 'koki', owner: 'fadli', kind: 'karyawan', area: 'Makassar', days: 9, title: 'Butuh juru masak dan dua pramusaji untuk cabang baru',
    description: 'Coto Paraikatte membuka cabang kedua di Tamalanrea bulan depan. Kami cari satu juru masak yang paham masakan Makassar dan dua pramusaji yang ramah. Gaji di atas UMK, makan ditanggung, libur satu hari seminggu.' },
  { key: 'ilustrator', owner: 'tania', kind: 'freelancer', days: 30, title: 'Cari ilustrator lepas untuk proyek kemasan',
    description: 'Studio Lini sedang mengerjakan kemasan teh dan camilan untuk tiga klien. Kami butuh ilustrator dengan gaya gambar tangan yang bisa bekerja jarak jauh. Bayaran per proyek, portofolio wajib dilampirkan.' },
  { key: 'sound', owner: 'kevin', kind: 'vendor', area: 'Jawa Timur', days: 6, title: 'Cari vendor sound system dan lighting di Surabaya',
    description: 'Untuk gathering perusahaan 300 orang akhir bulan ini. Butuh sound 10.000 watt, lighting panggung, dan operator yang siap gladi sehari sebelumnya. Kalau cocok, kami ajak untuk acara rutin tiap bulan.' },
  { key: 'agen', owner: 'made', kind: 'partner', days: 40, title: 'Cari mitra agen perjalanan di Jakarta dan Makassar',
    description: 'Jelajah Dewata ingin membuka paket gabungan Bali dengan kota lain. Kami cari mitra yang sudah punya pelanggan rombongan kantor atau komunitas. Skemanya bagi hasil, dan semua layanan di Bali kami yang urus.' },
  { key: 'bpom', owner: 'mitha', kind: 'konsultan', area: 'Jawa Tengah & DIY', days: 24, title: 'Butuh konsultan izin edar BPOM untuk jamu botolan',
    description: 'Jamu kami mulai dipesan toko oleh-oleh di luar kota, jadi sudah waktunya mengurus izin edar. Kami cari konsultan yang pernah mendampingi produk minuman herbal skala rumahan. Lebih baik lagi kalau bisa datang melihat dapur produksi di Yogyakarta.' },
  { key: 'foto', owner: 'rini', personal: true, kind: 'freelancer', area: 'Jabodetabek', days: 12, title: 'Cari fotografer produk untuk katalog hijab',
    description: 'Saya butuh foto katalog untuk 40 motif hijab, dengan model dan tanpa model. Pemotretan di Bekasi, satu hari kerja. Mohon kirim contoh hasil foto produk fesyen sebelumnya.' },
  { key: 'studio', owner: 'nadia', personal: true, kind: 'partner', area: 'Jabodetabek', days: 35, title: 'Cari mitra untuk membuka studio pilates di Bogor',
    description: 'Tempat dan izin sudah ada, sebagian alat sudah dibeli. Saya cari satu mitra yang mau ikut mengelola, idealnya instruktur atau pernah menjalankan pusat kebugaran. Pembagian saham bisa kita bicarakan sambil ngopi.' },
  { key: 'guru', owner: 'hendra', kind: 'karyawan', area: 'Sumatera', days: 20, pending: true, title: 'Cari pengajar bahasa Inggris paruh waktu di Medan',
    description: 'Rumah Belajar Horas menambah dua kelas sore mulai bulan depan. Kami cari pengajar yang sabar dengan anak SD dan bisa mengajar tiga kali seminggu. Mahasiswa tingkat akhir dipersilakan melamar.' },
];

// Hubungkan. to = the owner who receives it, through their listing or the peluang named. answer = what they did with it.
const CONNECTIONS = [
  { from: 'hendra', to: 'lulusan', peluang: 'kopi', message: 'Halo Dimas, saya kenal baik dengan koperasi petani kopi di Sidikalang dan Gayo. Mereka sanggup 60 kg per bulan dan bisa kirim sampel minggu ini. Mau saya kenalkan?' },
  { from: 'fadli', to: 'lulusan', peluang: 'kopi', message: 'Dimas, keluarga saya punya kebun kopi di Toraja Utara, biasanya kami jual ke kedai di Makassar. Kalau berminat, saya kirim sampel arabika panen bulan lalu.' },
  { from: 'kevin', to: 'lulusan', answer: 'accept', message: 'Halo, bulan depan saya pegang acara kantor di Jakarta untuk 150 tamu. Bisa pesan coffee cart Titik Temu untuk setengah hari? Kalau cocok, saya ingin pakai lagi di acara berikutnya.' },
  { from: 'lulusan', to: 'tania', answer: 'accept', message: 'Halo Tania, saya mau bikin kemasan baru untuk kopi botolan Titik Temu. Butuh label dan dus isi enam. Bisa ngobrol soal konsep dan biayanya?' },
  { from: 'lulusan', to: 'yoga', message: 'Halo Yoga, kami butuh aplikasi kasir yang bisa menyatukan stok tiga gerai. Sekarang masih dicatat manual. Kira-kira berapa lama pengerjaannya?' },
  { from: 'lulusan', to: 'mitha', answer: 'decline', message: 'Halo Mitha, saya ingin menitipkan jamu botolan Sari Raga di tiga gerai kami di Jakarta. Apakah bisa kirim rutin tiap minggu?' },
  { from: 'irfan', to: 'made', peluang: 'agen', answer: 'intro', message: 'Halo Bli Made, saya mengelola trip pinisi dari Makassar. Saya tertarik menggabungkan paket Bali dan Sulawesi untuk rombongan kantor. Bagaimana kalau kita bahas skemanya?' },
  { from: 'reza', to: 'mitha', peluang: 'bpom', answer: 'accept', message: 'Halo Mitha, saya biasa mendampingi UMKM mengurus legalitas dan punya rekan konsultan BPOM untuk minuman herbal. Dokumen keuangannya bisa saya bantu rapikan sekalian.' },
];

// By staff, live at once, unless host is set (a graduate's proposal, left pending). days from today (negative = past), hour in WIB.
// rsvp = who asks for a seat, in order: beyond the capacity they land on the waiting list. tone = placeholder image.
const EVENTS = [
  { kind: 'meetup', title: 'Ngopi Bareng Lulusan Jakarta', days: 5, hour: 19, hours: 2, venue: 'Kopi Titik Temu, Kemang', city: 'Jakarta Selatan', capacity: 40, fee: 'Gratis', tone: '6F1414',
    description: 'Kumpul santai lintas angkatan sambil ngopi. Tidak ada agenda resmi: cukup datang, kenalan, dan cerita soal usaha masing-masing. Kopi pertama ditraktir tuan rumah.',
    rsvp: ['lulusan', 'reza', 'fitri', 'yoga', 'rini', 'nadia'] },
  { kind: 'workshop', title: 'Klinik Bisnis: Bedah Laporan Keuangan', days: 11, hour: 10, hours: 3, venue: 'Ruang Temu Menteng, Jl. KH Wahid Hasyim', city: 'Jakarta Pusat', capacity: 3, fee: 'Rp 150.000',
    description: 'Sesi kelompok kecil bersama Reza Mahendra. Bawa laporan keuangan tiga bulan terakhir, kita bedah satu per satu dan cari kebocorannya. Hanya tiga kursi supaya tiap peserta dapat waktu yang cukup.',
    rsvp: ['fitri', 'yoga', 'rini', 'lulusan', 'nadia'] }, // full: the last two wait
  { kind: 'gathering', title: 'Temu Lulusan Makassar', days: 18, hour: 18, hours: 3, venue: 'Coto Paraikatte, Panakkukang', city: 'Makassar', capacity: 60, fee: 'Gratis', tone: '8B1A1A',
    description: 'Makan malam bersama lulusan AsiaWorks se-Sulawesi Selatan. Ada sesi cerita usaha dari tiga lulusan, lalu ramah tamah. Keluarga boleh diajak.',
    rsvp: ['fadli', 'rahma', 'irfan', 'made'] },
  { kind: 'workshop', title: 'Workshop Merek dan Kemasan untuk UMKM', days: 25, hour: 13, hours: 4, venue: 'Studio Lini, Dago', city: 'Bandung', capacity: 25, fee: 'Rp 150.000',
    description: 'Belajar menyusun identitas merek dan memilih kemasan yang pas di kantong. Dipandu Tania dari Studio Lini, lengkap dengan contoh kasus usaha lulusan. Peserta pulang membawa rancangan kemasan sendiri.',
    rsvp: ['tania', 'lulusan', 'mitha'] },
  { kind: 'meetup', title: 'Kopdar Lulusan Surabaya', days: 32, hour: 19, venue: 'Kedai Tunjungan 41', city: 'Surabaya', capacity: 30, fee: 'Gratis',
    description: 'Kopi darat lulusan Surabaya dan sekitarnya. Kita saling kenal dulu, lalu tukar kebutuhan usaha: siapa butuh apa, siapa bisa bantu apa.',
    rsvp: ['kevin', 'mitha'] },
  { kind: 'workshop', title: 'Kelas Daring: Jualan Lewat Marketplace', days: 40, hour: 20, hours: 1.5, venue: 'Online (Zoom)', city: 'Online', fee: 'Gratis', tone: '2B2726',
    description: 'Satu setengah jam membahas foto produk, judul, dan iklan di Tokopedia dan Shopee. Cocok untuk yang baru mulai jualan daring. Tautan Zoom dikirim sehari sebelum acara.',
    rsvp: ['rahma', 'fitri', 'hendra', 'rini', 'made'] },
  { kind: 'gathering', title: 'Gathering Akbar Lulusan 2026', days: -20, hour: 9, hours: 8, venue: 'Gedung Serbaguna Senayan', city: 'Jakarta Pusat', capacity: 300, fee: 'Rp 250.000',
    description: 'Temu tahunan lulusan dari seluruh Indonesia: cerita usaha, pameran produk lulusan, dan makan siang bersama.' },
  { host: 'made', kind: 'meetup', title: 'Sunset Meetup Lulusan Bali', days: 47, hour: 17, venue: 'Pantai Sanur', city: 'Denpasar', capacity: 30, fee: 'Gratis',
    description: 'Ngobrol santai sambil menunggu matahari terbenam di Sanur. Saya siapkan tikar dan kelapa muda, teman-teman tinggal datang.' },
];

// Written by staff about two listings (owner keys). Public once both owners agreed.
const STORIES = [
  { a: 'lulusan', b: 'tania', agree: ['lulusan', 'tania'], title: 'Kopi botolan Titik Temu berganti wajah bersama Studio Lini',
    body: 'Berawal dari satu permintaan Hubungkan, Dimas dan Tania duduk bareng membahas kemasan kopi botolan Titik Temu. Dalam enam minggu lahir label baru dan dus isi enam yang lebih mudah dibawa pulang.\n\nSebulan setelah kemasan baru dipakai, penjualan kopi botolan di tiga gerai naik hampir dua kali lipat. Studio Lini kini juga mengerjakan menu dan papan nama gerai BSD.' },
  { a: 'made', b: 'mitha', agree: ['made', 'mitha'], title: 'Paket wisata sehat: dari kedai jamu Yogyakarta ke pantai Bali',
    body: 'Made dan Mitha bertemu di gathering lulusan tahun lalu, lalu iseng menggabungkan dua hal yang mereka kuasai. Hasilnya paket lima hari: kelas meracik jamu dan pijat tradisional di Yogyakarta, dilanjutkan trip santai ke Nusa Penida.\n\nTiga rombongan pertama langsung penuh, sebagian besar pesertanya sesama lulusan. Tahun depan mereka berencana menambah rute Lombok.' },
  { a: 'kevin', b: 'lulusan', agree: ['kevin'], title: 'Coffee cart Titik Temu hadir di panggung Sorak Organizer', // waits for the main demo member
    body: 'Sorak Organizer butuh sajian kopi yang layak untuk acara kantor 150 tamu di Jakarta. Kevin menghubungi Dimas lewat direktori, dan seminggu kemudian coffee cart Titik Temu sudah berdiri di samping panggung.\n\nKerja sama itu berlanjut: Sorak kini menawarkan coffee cart sebagai pilihan tetap di setiap paket acaranya.' },
];

// Staff put every banner up, and it is live at once. `for` = an ad for that owner's listing; without it, an announcement.
// tone + art = a placeholder picture, which then is the whole banner. Without one, the title and body are.
const BANNERS = [
  { title: 'Agenda temu lulusan sudah dibuka', body: 'Ngopi bareng di Jakarta, temu lulusan di Makassar, sampai kelas daring. Amankan kursimu lewat RSVP.', link: '/acara',
    tone: '6F1414', art: 'Temu Lulusan AsiaWorks' },
  { title: 'Butuh supplier, mitra, atau karyawan?', body: 'Pasang kebutuhan bisnismu di Peluang, biar sesama lulusan yang menjawab.', link: '/peluang' },
  { for: 'made', title: 'Open trip Nusa Penida akhir tahun, kursi terbatas', body: 'Tiga hari dua malam bersama pemandu lokal. Berangkat tiap Jumat dari Sanur.', link: 'https://instagram.com/jelajahdewata' },
  { for: 'lulusan', title: 'Gerai baru Kopi Titik Temu di BSD sudah buka', body: 'Mampir dan sebut kode lulusan untuk diskon 15% sepanjang bulan ini.',
    tone: '8A6A2F', art: 'Kopi Titik Temu' },
];

const CONTACT_VIEWS = [ // [who opened "Lihat kontak", whose listing]
  ['kevin', 'lulusan'], ['tania', 'lulusan'], ['hendra', 'lulusan'], ['fadli', 'lulusan'], ['lulusan', 'tania'],
  ['lulusan', 'fadli'], ['mitha', 'made'], ['rahma', 'kevin'], ['fitri', 'mitha'],
];
const SAVES = [
  { who: 'lulusan', business: 'tania' }, { who: 'lulusan', business: 'made' }, { who: 'lulusan', peluang: 'sound' },
  { who: 'tania', business: 'lulusan' }, { who: 'kevin', peluang: 'kopi' }, { who: 'mitha', business: 'rahma' }, { who: 'bayu', business: 'lulusan' },
];
const VIEWS = { lulusan: 9, tania: 5, fadli: 4, made: 4, mitha: 3, kevin: 3, rahma: 2, yoga: 2, fitri: 2, reza: 1, hendra: 1 }; // page views per listing

// ───────────────────────────── Run ─────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts); // accounts, the staff role, the wipe, the final counts
const anon = createClient(url, anonKey, opts); // a visitor

const must = ({ data, error }) => { if (error) throw error; return data; }; // for auth and storage, which have no throwOnError
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const at = (n, hourWib) => { const d = new Date(Date.now() + n * 864e5); d.setUTCHours(hourWib - 7, 0, 0, 0); return d; };

// Never touch a database that holds real accounts.
const users = [];
for (let page = 1; ; page++) {
  const batch = must(await admin.auth.admin.listUsers({ page, perPage: 200 })).users;
  if (!batch.length) break;
  users.push(...batch);
}
const outsiders = users.filter((u) => !u.email?.endsWith(DOMAIN));
if (outsiders.length && !process.argv.includes('--force')) {
  console.error(`Refusing to seed: ${outsiders.length} account(s) outside ${DOMAIN} exist (for example ${outsiders[0].email ?? outsiders[0].id}).
The seed deletes every event, banner and story. If that is really what you want: npm run seed -- --force`);
  process.exitCode = 1; // not process.exit(): on Windows it can abort Node while a fetch socket is still closing
} else {
  await seed(users.filter((u) => u.email?.endsWith(DOMAIN)));
}

async function seed(demo) {
  // 1. Wipe the previous demo content. What staff published goes first, with its pictures: an ad or a story about a
  //    demo listing would cascade away with the account and leave its picture behind. Then the accounts: deleting one
  //    cascades to all its rows, but not to its files.
  for (const t of ['events', 'banners', 'stories']) {
    const { data: gone } = await admin.from(t).delete().not('id', 'is', null).select('image_path').throwOnError();
    const left = gone.map((row) => row.image_path).filter(Boolean);
    if (left.length) must(await admin.storage.from('media').remove(left));
  }
  for (const u of demo) {
    const files = must(await admin.storage.from('media').list(u.id, { limit: 1000 })); // ponytail: 1000 files per person, a demo account holds a few
    if (files.length) must(await admin.storage.from('media').remove(files.map((f) => `${u.id}/${f.name}`)));
    // before the account goes: what it did (actor_id would turn null) and what the log says about it
    await admin.from('audit_log').delete().or(`actor_id.eq.${u.id},target_id.eq.${u.id}`).throwOnError();
    must(await admin.auth.admin.deleteUser(u.id));
  }
  console.log(`Removed ${demo.length} demo accounts with their content, and all events, banners and stories.`);

  // 2. Accounts. From here on every action runs as the person who would do it in the app.
  const id = {}, as = {};
  for (const p of PEOPLE) {
    const email = p.key + DOMAIN;
    id[p.key] = must(await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: p.name } })).user.id;
    as[p.key] = createClient(url, anonKey, opts);
    must(await as[p.key].auth.signInWithPassword({ email, password: PASSWORD }));
  }
  await admin.from('profiles').update({ role: 'staff' }).eq('id', id.staf).throwOnError();
  const staff = as.staf;
  if ((await staff.from('settings').select('auto_approve').single().throwOnError()).data.auto_approve)
    await staff.rpc('set_auto_approve', { p_on: false }).throwOnError(); // demo mode off, so sign-ups wait for staff

  // A placeholder in a brand tone, uploaded by its owner into their own folder. Null when the download fails.
  // ponytail: the app's typeface is Inter, which placehold.co does not have; Roboto is its nearest. Real pictures replace these.
  const image = async (key, file, text, tone, size) => {
    let png;
    try {
      const src = `https://placehold.co/${size}/${tone}/${tone === 'D9D4CE' ? '1C1818' : 'F6EAEA'}/png?font=roboto&text=${encodeURIComponent(text)}`;
      const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      png = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn(`  no image for "${text}": ${e.message}`);
      return null;
    }
    const path = `${id[key]}/${file}.png`;
    must(await as[key].storage.from('media').upload(path, png, { contentType: 'image/png' }));
    return path;
  };

  // 3. Onboarding, then staff verify the batch.
  for (const p of PEOPLE.filter((p) => p.lp)) {
    await as[p.key].rpc('save_profile', { p_full_name: p.name, p_nickname: p.nick, p_phone: p.phone, p_lp: p.lp, p_ib: p.ib, p_ia: p.ia, p_submit: true }).throwOnError();
    if (p.verify !== false) await staff.rpc('verify_graduate', { p_user: id[p.key], p_approve: true }).throwOnError();
  }
  console.log(`Accounts: ${PEOPLE.length}`);

  // 4. Listings: draft, contact, locations, the owner's consent, a moderator's approval. Then the promo.
  const biz = {}; // listing id per owner key
  for (const b of BUSINESSES) {
    const me = as[b.owner];
    const { data: row } = await me.from('businesses').insert({
      owner_id: id[b.owner], name: b.name, description: b.description, category: b.category, category_other: b.other, service_type: b.service,
      links: b.links, online_only: !!b.online, image_path: b.tone ? await image(b.owner, 'bisnis', b.name, b.tone, '800x600') : null,
    }).select('id').single().throwOnError();
    biz[b.owner] = row.id;
    await me.rpc('set_business_contact', { p_business: row.id, p_contact: b.contact }).throwOnError();
    for (const l of b.locations ?? []) await me.from('locations').insert({ ...l, business_id: row.id }).throwOnError(); // one by one: keeps the branch order
    if (b.state !== 'draft') await me.rpc('submit_business', { p_business: row.id }).throwOnError();
    if (!b.state || b.state === 'off') await staff.rpc('moderate', { p_kind: 'business', p_id: row.id, p_action: 'approve' }).throwOnError();
    if (b.state === 'off') await me.from('businesses').update({ active: false }).eq('id', row.id).throwOnError();
    if (b.promo) {
      const { data: promo } = await me.from('promos').insert({ business_id: row.id, title: b.promo.title, code: b.promo.code, valid_until: b.promo.days ? day(b.promo.days) : null })
        .select('id').single().throwOnError();
      if (!b.promo.pending) await staff.rpc('moderate', { p_kind: 'promo', p_id: promo.id, p_action: 'approve' }).throwOnError();
    }
  }
  console.log(`Listings: ${BUSINESSES.length}`);

  // 5. Peluang, reviewed by staff.
  const peluang = {}; // id per key
  for (const p of PELUANG) {
    const { data: row } = await as[p.owner].from('peluang').insert({
      owner_id: id[p.owner], business_id: p.personal ? null : biz[p.owner], kind: p.kind, title: p.title, description: p.description, area: p.area, deadline: day(p.days),
    }).select('id').single().throwOnError();
    peluang[p.key] = row.id;
    if (!p.pending) await staff.rpc('moderate', { p_kind: 'peluang', p_id: row.id, p_action: 'approve' }).throwOnError();
  }

  // 6. Hubungkan: a request, then the owner's answer.
  for (const c of CONNECTIONS) {
    const target = c.peluang ? { p_peluang: peluang[c.peluang] } : { p_business: biz[c.to] };
    const { data: request } = await as[c.from].rpc('connect', { p_message: c.message, ...target }).throwOnError();
    if (c.answer) await as[c.to].rpc('respond_connection', { p_id: request, p_action: c.answer }).throwOnError();
  }
  console.log(`Peluang: ${PELUANG.length}, Hubungkan: ${CONNECTIONS.length}`);

  // 7. Events and RSVPs.
  const events = [];
  for (const [i, e] of EVENTS.entries()) {
    const start = at(e.days, e.hour);
    const { data: row } = await as[e.host ?? 'staf'].from('events').insert({
      kind: e.kind, title: e.title, description: e.description, venue: e.venue, city: e.city, capacity: e.capacity, fee: e.fee, host_id: id[e.host],
      starts_at: start.toISOString(), ends_at: e.hours ? new Date(+start + e.hours * 36e5).toISOString() : null,
      image_path: e.tone ? await image('staf', `acara-${i + 1}`, e.title, e.tone, '1200x750') : null,
    }).select('id').single().throwOnError();
    events.push(row.id);
    for (const key of e.rsvp ?? []) await as[key].rpc('rsvp', { p_event: row.id }).throwOnError();
  }

  // 8. Stories: staff write, the owners agree.
  const stories = [];
  for (const s of STORIES) {
    const { data: row } = await staff.from('stories').insert({ title: s.title, body: s.body, business_a: biz[s.a], business_b: biz[s.b], created_by: id.staf })
      .select('id, version').single().throwOnError();
    stories.push(row.id);
    for (const key of s.agree) await as[key].rpc('story_consent', { p_story: row.id, p_agree: true, p_version: row.version }).throwOnError();
  }

  // 9. Banners: announcements and ads, all put up by staff.
  const banners = [];
  for (const [i, n] of BANNERS.entries()) {
    const image_path = n.tone ? await image('staf', `banner-${i + 1}`, n.art, n.tone, '1200x400') : null;
    const { data: row } = await staff.from('banners').insert({ title: n.title, body: n.body, link_url: n.link, image_path, created_by: id.staf, business_id: n.for ? biz[n.for] : null })
      .select('id').single().throwOnError();
    banners.push(row.id);
  }
  console.log(`Events: ${EVENTS.length}, stories: ${STORIES.length}, banners: ${BANNERS.length}`);

  // 10. The small things: contacts opened, saves, page views, one report and one privacy request for the staff queues.
  for (const [who, owner] of CONTACT_VIEWS) await as[who].rpc('view_contact', { p_business: biz[owner] }).throwOnError();
  for (const s of SAVES)
    await as[s.who].from('saves').insert({ user_id: id[s.who], ...(s.peluang ? { peluang_id: peluang[s.peluang] } : { business_id: biz[s.business] }) }).throwOnError();
  for (const [owner, n] of Object.entries(VIEWS)) for (let i = 0; i < n; i++) await anon.rpc('track_view', { p_business: biz[owner] }).throwOnError();
  await as.rahma.from('reports').insert({ reporter_id: id.rahma, business_id: biz.kevin, reason: 'Tautan Instagram bisnis ini sepertinya mengarah ke akun lain. Mohon dicek ya.' }).throwOnError();
  await as.fitri.from('privacy_requests').insert({ user_id: id.fitri, kind: 'export' }).throwOnError();

  // Self-check: what a visitor sees must match what the data above promises.
  const mine = { p_ids: Object.values(biz) };
  const count = async (query) => (await query.throwOnError()).data.length;
  assert.deepEqual(
    {
      live: await count(anon.rpc('search_businesses', mine)),
      perks: await count(anon.rpc('search_businesses', { ...mine, p_promo_only: true })),
      peluang: await count(anon.from('peluang_feed').select('id').in('id', Object.values(peluang))),
      events: await count(anon.from('event_feed').select('id').in('id', events)),
      stories: await count(anon.from('story_feed').select('id').in('id', stories)),
      banners: await count(anon.from('banner_feed').select('id').in('id', banners)),
      fullEvent: (await anon.from('event_feed').select('going, waitlist').in('id', events).eq('capacity', 3).single().throwOnError()).data,
    },
    { live: 11, perks: 8, peluang: 8, events: 7, stories: 2, banners: 4, fullEvent: { going: 3, waitlist: 2 } },
  );

  console.log('\nRows per table:');
  for (const t of ['profiles', 'businesses', 'locations', 'promos', 'peluang', 'connections', 'contact_views', 'saves', 'events', 'rsvps',
    'stories', 'banners', 'reports', 'privacy_requests', 'audit_log']) {
    const { count: rows } = await admin.from(t).select('*', { count: 'exact', head: true }).throwOnError();
    console.log(`  ${t.padEnd(18)}${rows}`);
  }

  console.log(`\nDemo logins (password: ${PASSWORD})`);
  for (const p of PEOPLE) {
    const b = BUSINESSES.find((b) => b.owner === p.key);
    const note = b ? `graduate LP ${p.lp} · ${b.name ?? 'listing without a business name'} · ${b.state ?? 'live'}`
      : p.key === 'staf' ? 'staff, signs in at /staff'
      : p.lp ? 'waiting for verification' : 'signed up only';
    console.log(`  ${(p.key + DOMAIN).padEnd(34)}${note}`);
  }
}
