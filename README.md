# Jarful

Todo harian yang memuaskan untuk diselesaikan. Setiap todo yang selesai berubah menjadi kelereng yang terbang ke **Toples Hari Ini**, dan di malam hari kamu bisa melihat toples yang penuh di **Rekap Malam**.

Dibangun dengan SvelteKit (Svelte 5), Tailwind CSS v4, shadcn-svelte, dan Firebase (Auth + Firestore). Bisa di-deploy gratis di Vercel.

## Fitur versi ini

- **Hari Ini:** daftar todo, Fokus Utama, toples kelereng dengan combo, kelereng emas acak, suara, dan getar.
- **Catat Cepat:** nyalakan tombol "Sudah selesai" untuk mencatat hal produktif yang baru saja kamu lakukan.
- **Rencana Besok:** rencanakan hari esok sebelum tidur, bawa tugas yang belum selesai, dan dapatkan peringatan kalau rencananya terlalu banyak.
- **Rekap Malam:** jumlah selesai, streak, jejak waktu, mood, dan satu kalimat refleksi.
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

Hampir seluruh aplikasi berjalan di browser dan langsung terhubung ke Firebase. Satu-satunya kode server adalah `/api/admin/*` untuk mengelola akun, yang dijalankan Vercel sebagai serverless function dan sudah termasuk paket gratis Hobby.

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
    login/, ganti-password/
    api/admin/users/          API kelola akun (server)
scripts/seed-admin.mjs        membuat akun admin pertama
firestore.rules               aturan keamanan Firestore
```

## Keamanan

- Tidak ada pendaftaran publik. Akun hanya dibuat lewat panel admin, yang memberi klaim `member`.
- Aturan Firestore mewajibkan klaim `member` dan membatasi setiap pengguna hanya ke datanya sendiri, di `users/{uid}`.
- Semua API admin memeriksa token login dan klaim `admin` di server.
- Admin bisa mengelola akun, tapi tidak bisa membaca isi todo pengguna lain.
