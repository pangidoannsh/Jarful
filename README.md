# Jarful

Todo harian yang memuaskan untuk diselesaikan. Setiap todo yang selesai berubah menjadi kelereng yang terbang ke **Toples Hari Ini**, dan di malam hari kamu bisa melihat toples yang penuh di **Rekap Malam**.

Dibangun dengan SvelteKit (Svelte 5), Tailwind CSS v4, shadcn-svelte, dan Firebase (Auth + Firestore). Bisa di-deploy gratis di Vercel.

## Fitur versi ini

- **Hari Ini:** daftar todo, Fokus Utama, toples kelereng dengan combo, kelereng emas acak, suara, dan getar.
- **Catat Cepat:** nyalakan tombol "Sudah selesai" untuk mencatat hal produktif yang baru saja kamu lakukan.
- **Rencana Besok:** rencanakan hari esok sebelum tidur, bawa tugas yang belum selesai, dan dapatkan peringatan kalau rencananya terlalu banyak.
- **Rekap Malam:** jumlah selesai, streak, jejak waktu, mood, dan satu kalimat refleksi.
- **Statistik:** heatmap setahun, streak sekarang dan terpanjang, hari terbaik.
- **Bobot usaha:** tambahkan `!` (sedang) atau `!!` (berat). Kelereng jadi lebih besar, bunyinya lebih mantap, dan tercatat sebagai poin usaha. Tambahkan `~` untuk **pengingat** kecil seperti `minum creatine ~`: tetap bisa dicentang, tapi tidak menjadi kelereng dan tidak dihitung sebagai produktivitas. Bobot bisa diubah lewat menu ⋯.
- **Input pintar:** ketik `olahraga 30m #sehat besok` untuk mengisi durasi, tag, dan tanggal sekaligus. Tanggal yang dikenali: `hari ini`, `besok`, `lusa`, nama hari, `25/12`, `25-12-2027`, `3 des`, `14 februari 2027`, `tgl 15`, `10 hari lagi`, `minggu depan`. Atau pilih lewat ikon kalender.
- **Terjadwal:** halaman `/terjadwal` berisi semua todo dan pengingat setelah besok, dikelompokkan per tanggal.
- **Rutinitas bulanan:** selain hari dalam seminggu, rutinitas bisa diatur per tanggal (misalnya tiap tgl 25).
- **Pengingat malam:** notifikasi sekitar jam 21.00 WIB berisi rekap singkat dan ajakan merencanakan besok.
- **Pengingat pagi:** notifikasi sekitar jam 06.00 WIB berisi hanya todo dan pengingat yang diberi tanggal secara eksplisit (diketik seperti `25/11`, `besok`, atau dipilih lewat kalender). Todo biasa dan rutinitas tidak ikut. Tidak dikirim kalau tidak ada.
- **Tes notifikasi (admin):** di Pengaturan, cek kunci VAPID, dukungan browser, izin, pendaftaran perangkat, lalu kirim tes lokal, tes pagi, dan tes malam.
- **PWA:** bisa dipasang di layar utama HP.
- **Kategori berwarna:** setiap `#tag` punya warna kelereng sendiri; rekap menunjukkan ke mana energimu pergi.
- **Rutinitas:** kebiasaan yang muncul otomatis di hari-hari yang dipilih.
- **Timer fokus:** Pomodoro 25/5 per todo; menit fokus tercatat.
- **Statistik mingguan:** minggu ini vs minggu lalu, jam paling produktif, kategori terbanyak, persentase rencana yang tuntas.
- **Kartu rekap:** gambar rekap harian untuk dibagikan ke Story atau WhatsApp.
- **Pintasan:** `N` todo baru, `H` `B` `R` `S` `L` pindah halaman, `Ctrl/⌘ K` palet perintah.
- **Saran Belajar dari Claude:** tiga saran topik (dekat, sedang, jauh) dalam satu ranah, dari riwayat todo `#belajar` dan catatannya, plus Peta Belajar.
- **Akun tanpa pendaftaran publik:** hanya admin yang bisa membuat akun lewat panel `/admin`.
- **Offline-first:** perubahan langsung tampil dan tersinkron saat koneksi kembali.

## Setup (sekitar 15 menit)

### 1. Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com), lalu buat proyek baru.
2. **Authentication → Get started → Sign-in method:** aktifkan **Email/Password**.
3. **Authentication → Settings → User actions:** matikan **Enable create (sign-up)**, supaya tidak ada yang bisa mendaftar sendiri.
4. **Firestore Database → Create database:** pilih lokasi `asia-southeast2` (Jakarta) dan mode production.
5. **Firestore → Rules:** tempel isi file [`firestore.rules`](./firestore.rules), lalu klik **Publish**.
6. **Project settings → General → Your apps:** tambahkan **Web app**, lalu salin nilai konfigurasinya.
7. **Project settings → Service accounts → Generate new private key:** unduh file JSON-nya. File ini rahasia, jangan di-commit.

### 2. Environment variables

Salin `.env.example` menjadi `.env`, lalu isi:

- `VITE_FIREBASE_*` diisi dari konfigurasi Web app (langkah 6).
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, dan `FIREBASE_ADMIN_PRIVATE_KEY` diisi dari file JSON service account (langkah 7).

### 3. Buat akun admin

```sh
npm install
npm run seed:admin
```

Skrip ini membuat akun `admin` dengan password acak 16 karakter, yang **ditampilkan sekali** di terminal. Simpan password itu, lalu login. Kamu akan diminta menggantinya saat login pertama.

Lupa password admin? Jalankan `npm run seed:admin -- --reset`.

### 4. Jalankan secara lokal

```sh
npm run dev
```

### 5. Deploy ke Vercel (gratis)

1. Buka [vercel.com/new](https://vercel.com/new), lalu impor repo ini. Framework akan terdeteksi otomatis sebagai SvelteKit.
2. Di **Environment Variables**, masukkan semua variabel dari `.env`. Untuk `FIREBASE_ADMIN_PRIVATE_KEY`, tempel nilainya lengkap dengan `\n`.
3. Klik **Deploy**.

Hampir seluruh aplikasi berjalan di browser dan langsung terhubung ke Firebase. Kode server hanya ada di `/api/admin/*` (kelola akun), `/api/cron/reminder` dan `/api/reminder/test` (notifikasi), serta `/api/saran` (Claude), yang dijalankan Vercel sebagai serverless function dan sudah termasuk paket gratis Hobby.

### 6. Pengingat malam (opsional)

1. Firebase Console → **Settings → Cloud Messaging** → bagian **Web Push certificates** → **Generate key pair**. Salin kuncinya ke `VITE_FIREBASE_VAPID_KEY`.
2. Buat teks acak panjang untuk `CRON_SECRET`, misalnya hasil `openssl rand -hex 32`.
3. Masukkan kedua variabel itu ke Vercel, lalu Redeploy.
4. Di aplikasi, buka **Pengaturan → Pengingat malam**, nyalakan, izinkan notifikasi, lalu tekan **Kirim tes**.

Pengingat dikirim oleh Vercel Cron (`vercel.json`: `0 14 * * *` UTC = 21.00 WIB untuk malam, `0 23 * * *` UTC = 06.00 WIB untuk pagi). Di paket Hobby, cron berjalan sekali sehari dan bisa meleset sampai 59 menit, jadi notifikasi tiba antara 21.00–21.59 WIB. Di iPhone, notifikasi hanya bekerja kalau Jarful sudah dipasang ke layar utama (iOS 16.4 ke atas).

### 7. Saran Belajar dari Claude (opsional)

1. Buat API key di [console.anthropic.com](https://console.anthropic.com) dan isi saldo. Tagihan API terpisah dari langganan Claude.ai.
2. Isi `ANTHROPIC_API_KEY` di Vercel, lalu Redeploy.
3. Tandai todo belajar dengan `#belajar`, beri catatan lewat menu ⋯ → **Catatan belajar**, lalu buka halaman **Belajar**.

Pengaman biaya dan tagihan:

- Maksimal 3 permintaan saran per orang per hari; hasilnya disimpan sehingga membuka ulang halaman tidak memanggil API.
- Saran harian memakai Claude Haiku; profil belajar mingguan memakai Claude Sonnet (ubah lewat `ANTHROPIC_MODEL_DAILY` / `ANTHROPIC_MODEL_PROFILE`).
- Kalau API menolak karena tagihan atau batas belanja (`billing_error`, `enforced_spend_limit_reached`, dan sejenisnya), halaman Belajar menampilkan **"Admin belum bayar tagihan AI"** dan server berhenti memanggil API selama 6 jam (`system/aiStatus`). Admin bisa menekan **Cek ulang sekarang** setelah membayar.
- Hanya todo bertanda `#belajar` dan catatannya yang dikirim ke Claude.

## Struktur

```
src/
  lib/
    firebase.ts               Firebase client + cache offline
    feedback.ts               suara, getar, combo, kelereng emas, confetti
    stores/
      session.svelte.ts       login, klaim admin/member, profil
      todos.svelte.ts         daftar realtime per hari + aksi
      jar.svelte.ts           animasi kelereng terbang ke toples
      prefs.svelte.ts         suara, getar, coretan, tema
    components/
      Jar.svelte              toples SVG berisi kelereng
      TodoItem.svelte         satu todo + menu aksi
      QuickAdd.svelte         input bawah + "Sudah selesai"
      CarryOver.svelte        bawa todo yang belum selesai
      ui/                     komponen shadcn-svelte
    server/admin.ts           Firebase Admin + cek hak admin
  routes/
    +page.svelte              Hari Ini
    besok/                    Rencana Besok
    rekap/                    Rekap Malam
    admin/                    Panel admin
    pengaturan/               Pengaturan
    statistik/                Heatmap, streak, statistik mingguan
    rutinitas/                Kelola rutinitas harian
    belajar/                  Saran Belajar dan Peta Belajar
    api/saran/                memanggil Claude (server)
    login/, ganti-password/
    api/admin/users/          API kelola akun (server)
    api/cron/reminder/        dipanggil Vercel Cron jam 21.00 WIB
    api/reminder/test/        kirim notifikasi tes ke perangkat sendiri
  service-worker.js           pemasangan PWA + menampilkan notifikasi
scripts/seed-admin.mjs        membuat akun admin pertama
firestore.rules               aturan keamanan Firestore
```

## Keamanan

- Tidak ada pendaftaran publik. Akun hanya dibuat lewat panel admin, yang memberi klaim `member`.
- Aturan Firestore mewajibkan klaim `member` dan membatasi setiap pengguna hanya ke datanya sendiri, di `users/{uid}`.
- Semua API admin memeriksa token login dan klaim `admin` di server.
- Admin bisa mengelola akun, tapi tidak bisa membaca isi todo pengguna lain.
