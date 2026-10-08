# Backend & database ORI

## Ringkasnya

| Bagian | Pilihan | Alasan |
|---|---|---|
| Hosting web + API | Vercel (Hobby), fungsi di region **Singapura** (`sin1`) | Satu deploy untuk frontend dan API, HTTPS otomatis |
| Database | **Neon Postgres** (akun Neon sendiri, gratis), region **Singapura** | Postgres asli, tidak terikat akun Vercel siapa pun, cukup satu connection string |
| Driver | `postgres` (postgres.js) lewat koneksi *pooled* | Cocok untuk serverless, tidak terkunci ke satu penyedia |

Tanpa database pun situs tetap jalan (mode lokal): stok dari `products.json`, order disimpan di sesi browser. Begitu `DATABASE_URL` terpasang, semua otomatis pindah ke database.

```
Browser ──► Vercel CDN (React build)
   │
   └──► /api/*  (Vercel Functions, sin1)
            │   DATABASE_URL hanya ada di server
            ▼
        Neon Postgres (ap-southeast-1)
        tabel dikunci, akses hanya lewat 4 fungsi api_*
```

## Yang disimpan

| Tabel | Isi |
|---|---|
| `products` | Harga, stok, ukuran, status aktif (data visual 3D tetap di `products.json`) |
| `orders`, `order_items` | Pesanan, data pengiriman, harga satuan saat dibeli |
| `verification_events` | Setiap pengecekan kode ORI (untuk riwayat di sertifikat) |
| `newsletter_subscribers` | Email pendaftar newsletter |

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | Cek aplikasi dan koneksi database |
| GET | `/api/inventory` | Harga dan stok terkini (cache CDN 30 detik) |
| POST | `/api/orders` | Buat pesanan, total dihitung di server, stok dikurangi atomik |
| POST | `/api/verify` | Catat pengecekan kode, kembalikan jumlah cek dan tanggal cek pertama |
| POST | `/api/newsletter` | Daftar newsletter (aman diulang) |

## Setup (±10 menit)

Database dibuat terpisah di Neon, jadi tidak memakai akun Vercel pribadi siapa pun. Project Vercel tempat situs di-deploy (milik Khairi) hanya perlu diisi satu environment variable.

1. **Buat database.** Daftar gratis di [neon.tech](https://neon.tech) (bisa login GitHub/Google) → **New project** → region **AWS Asia Pacific 1 (Singapore)**.
2. **Salin connection string.** Dashboard Neon → **Connect** → aktifkan **Connection pooling** → salin string `postgresql://…-pooler…`.
3. **Isi tabel dan produk.** Di laptop, di folder repo, buat file `.env.local` berisi `DATABASE_URL=<string tadi>` (contoh di `.env.example`; file ini tidak ikut ter-commit), lalu jalankan `npm run db:setup`. Hasilnya: `schema applied, 11 products seeded`.
   Alternatif tanpa terminal: buka **SQL Editor** di Neon, jalankan isi `db/schema.sql` lalu `db/seed.sql`.
4. **Sambungkan ke situs.** Di project Vercel tempat situs di-deploy: **Settings → Environment Variables** → tambah `DATABASE_URL` dengan string yang sama (Production + Preview) → **Deployments → Redeploy**.
5. **Cek.** Buka `https://<domain>/api/health`, harus muncul `"database":"connected"`.

Connection string adalah kunci database: simpan hanya di `.env.local` dan di environment variable Vercel, jangan dikirim lewat chat atau di-commit.

## Database di VPS (Docker)

Alternatif Neon: Postgres 16 jalan di VPS sendiri lewat `docker-compose.yml`.

1. Di VPS: `cp .env.example .env`, isi `POSTGRES_PASSWORD` dan `ORI_API_PASSWORD` (huruf/angka acak panjang, misalnya `openssl rand -hex 24`).
2. `docker compose up -d`. Start pertama otomatis menjalankan `schema.sql`, `seed.sql`, `demo.sql`, lalu mengaktifkan login `ori_api`.
3. Aplikasi memakai `DATABASE_URL=postgresql://ori_api:<ORI_API_PASSWORD>@127.0.0.1:5432/ori`. Port database hanya terbuka untuk VPS itu sendiri, tidak ke internet.

Data dummy (`db/demo.sql`): 36 pesanan 30 hari terakhir, 18 pendaftar newsletter, 140 pengecekan verifikasi. Nomor pesanan dummy berakhiran `-S0001` dst. Aman diulang: `DATABASE_URL=postgresql://ori:<POSTGRES_PASSWORD>@127.0.0.1:5432/ori npm run db:demo` hanya mengganti pesanan dummy, pesanan asli dan stok tidak disentuh.

Catatan: script init Docker hanya jalan saat volume masih kosong. Untuk mulai dari nol: `docker compose down -v && docker compose up -d` (semua data terhapus).

## Keamanan

- Kunci database hanya di environment variable server, tidak pernah dikirim ke browser.
- Harga dan total selalu dihitung ulang di database; harga dari browser diabaikan.
- Stok dikunci per produk saat checkout (`select … for update`), jadi dua pembeli tidak bisa membeli unit terakhir yang sama.
- Semua tabel memakai row level security tanpa policy. Role `ori_api` hanya bisa menjalankan fungsi `api_*`, tidak bisa membaca tabel langsung.
- Input divalidasi dua lapis: di API (pesan per kolom) dan constraint database.
- Request dibatasi: wajib JSON, maksimal 8 KB, method lain ditolak, folder `api/_lib` tidak bisa diakses.
- Header keamanan di `vercel.json`: Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- Form newsletter punya honeypot untuk bot.

**Opsional (hak akses minimum):** di SQL Editor Neon jalankan `alter role ori_api with login password '<password-acak-panjang>';`, lalu ganti `DATABASE_URL` di Vercel agar memakai user `ori_api`. API tetap berjalan normal karena semua akses lewat fungsi.

## Operasional

- **Neon gratis tidur setelah ±5 menit tanpa akses.** Request pertama setelah tidur butuh sekitar 1 detik lebih lama. Sebelum demo, buka `/api/health` sekali.
- **Lihat pesanan masuk:** Neon Console → Tables → `orders` dan `order_items`.
- **Reset stok untuk demo:** jalankan lagi `npm run db:setup` (stok kembali sesuai `products.json`, pesanan tidak terhapus).
- **Ubah harga/stok:** edit `src/data/products.json`, jalankan `npm run db:seed-sql` dan `npm run db:setup`.

## Pengembangan lokal

`npm run dev` melayani `/api/*` juga, membaca `DATABASE_URL` dari `.env.local`. Tanpa file itu, situs berjalan dalam mode lokal.
