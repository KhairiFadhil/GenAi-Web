# ORI — Interactive Sneaker & Streetwear Showcase

## Informasi Proyek

- **Nama:** ORI
- **Jenis:** Prototipe web / concept store
- **Tema:** Sneakers & streetwear original
- **Mata kuliah:** UTS Generative AI
- **Deadline:** Kamis, 8 Oktober 2026, 17:00 WIB
- **Tim:** 2 orang
- **Status:** Proyek akademik / dummy
- **Hosting:** Vercel

---

## 1. Konsep Utama

**ORI** adalah prototipe interactive concept store untuk sneakers dan streetwear dengan pengalaman eksplorasi produk berbasis 3D.

Berbeda dari toko online biasa, halaman utama ORI menggunakan **rak sepatu 3D sebagai navigasi utama**. Pengguna dapat memilih brand dari rak, mendekati produk melalui transisi kamera, lalu masuk ke mode showcase untuk melihat produk secara lebih detail.

Konsep pengalaman utama:

> **Explore → Inspect → Verify → Buy**

Semua transaksi, kode produk, QR, tag sepatu, stok, harga, dan proses verifikasi di dalam aplikasi bersifat **dummy/simulasi untuk kebutuhan proyek akademik**. ORI bukan toko sungguhan dan tidak memproses pembayaran nyata.

---

# 2. Tujuan Proyek

Proyek dibuat untuk menunjukkan bagaimana Generative AI dan teknologi web modern dapat digunakan untuk menghasilkan pengalaman digital yang lebih interaktif.

Fokus utama:

1. Membuat landing page dengan rak produk 3D.
2. Membuat pengalaman product showcase menggunakan model 3D.
3. Menyediakan katalog produk yang dapat difilter.
4. Menyediakan detail produk yang informatif.
5. Membuat sistem verifikasi produk dummy menggunakan kode dan QR.
6. Membuat wishlist dan keranjang belanja.
7. Membuat simulasi checkout dan order.
8. Menunjukkan integrasi antara visual 3D dan aplikasi web.
9. Menghasilkan prototipe yang dapat dipresentasikan dan digunakan melalui browser.
10. Mendokumentasikan penggunaan Generative AI di setiap tahap pembuatan (lihat bagian 2A).

---

# 2A. Peran Generative AI

Karena ini UTS **Generative AI**, penggunaan AI harus terlihat dan terdokumentasi — bukan hanya hasil akhirnya.

| Area | Penggunaan GenAI | Output |
|---|---|---|
| 3D model | Image-to-3D (mis. Meshy / Tripo / Rodin) dari foto produk → GLB | `public/models/*.glb` |
| Visual | Image generation untuk background studio, hero, texture, foto produk non-3D | `public/img/` |
| Copy | LLM untuk deskripsi produk, teks hotspot, landing copy | `products.json` |
| Code | AI coding assistant untuk scaffold, komponen, debugging | Repository |

Aturan dokumentasi:

- Setiap prompt penting dicatat di `PROMPTS.md`: **tool → prompt → hasil → revisi manual**.
- Simpan 1–2 screenshot before/after (mis. foto → model 3D hasil AI).
- `PROMPTS.md` menjadi bahan utama untuk manual PDF dan presentasi "proses pembuatan".

Model 3D hasil AI sekaligus menyelesaikan masalah sumber aset: tidak perlu mencari model sepatu bermerek yang lisensinya tidak jelas.

---

# 3. Positioning

ORI **bukan marketplace sungguhan** dan bukan sistem autentikasi produk resmi.

Positioning:

> **ORI — Interactive Sneaker & Streetwear Showcase**

Tagline:

> **ORIGINALS, UP CLOSE.**

Alternatif supporting copy:

> Explore sneakers and streetwear through an interactive 3D product experience.

Nilai utama ORI:

- **Interactive** — produk dapat dieksplorasi secara visual.
- **Immersive** — rak dan product showcase menggunakan 3D.
- **Inspect** — pengguna dapat melihat detail produk.
- **Verify** — tersedia simulasi pengecekan produk.
- **Simple** — alur katalog hingga checkout dibuat ringkas.

---

# 4. Target Pengguna

Target pengguna utama:

- Pengunjung yang ingin mengeksplorasi sneakers dan streetwear.
- Pengguna yang tertarik dengan pengalaman belanja berbasis 3D.
- Dosen/penguji yang menilai implementasi proyek.
- Pengguna demo yang ingin mencoba fitur katalog, verification, dan checkout.

Karena merupakan proyek akademik, sistem tidak ditujukan untuk transaksi komersial nyata.

---

# 5. User Journey

Alur utama pengguna:

```text
LANDING
   ↓
Pilih Brand / Rak
   ↓
PRODUCT DISCOVERY
   ↓
Pilih Produk
   ↓
3D SHOWCASE
   ↓
Inspect Detail
   ↓
PRODUCT DETAIL
   ├── Harga
   ├── Ukuran
   ├── Stok
   ├── Kondisi
   └── Verification
          ↓
     VERIFY PRODUCT
          ↓
     ┌────┴────┐
     ↓         ↓
 Wishlist    Add to Cart
                 ↓
               CART
                 ↓
          CHECKOUT SIMULATION
                 ↓
          ORDER CONFIRMATION
```

---

# 6. Struktur Halaman

## 6.1 Landing — 3D Shelf

Landing page menjadi bagian paling visual dari aplikasi.

Elemen:

- Logo ORI.
- Navigation.
- Headline.
- Rak sneakers 3D.
- Label brand pada setiap tingkat rak.
- Parallax/camera movement ringan.
- CTA menuju katalog.
- CTA menuju verification.

Rak tidak hanya menjadi dekorasi, tetapi berfungsi sebagai **navigasi utama**.

Contoh:

```text
NIKE
────────────────────
👟   👟   👟

ADIDAS
────────────────────
👟   👟   👟

NEW BALANCE
────────────────────
👟   👟   👟
```

Ketika user memilih brand:

```text
Brand Shelf
     ↓
Camera moves closer
     ↓
Brand collection
```

Keputusan implementasi:

- Transisi kamera **hanya di dalam landing** (rak → zoom ke tingkat brand) memakai `CameraControls.setLookAt(..., true)` dari Drei.
- Klik sepatu → pindah ke `/product/:id` dengan fade. Showcase 3D ada di halaman produk, bukan di Canvas landing. Ini menghindari Canvas yang harus tetap hidup saat route berganti.
- Produk tanpa GLB tampil di rak sebagai **shoebox** (box mesh + label brand/nama). Rak tetap penuh walaupun model 3D hanya sedikit.

---

# 7. Product Showcase

Ketika produk dipilih, kamera bergerak menuju area showcase.

Tampilan:

- Background studio gelap.
- Produk 3D sebagai fokus utama.
- Rotate.
- Zoom.
- Reset view.
- Camera controls.
- Informasi singkat produk.
- Hotspot detail.

Contoh kontrol:

```text
[ ROTATE ] [ ZOOM ] [ RESET ]
```

Hotspot dapat ditempatkan pada:

- Stitching.
- Material.
- Insole.
- Size tag.
- Sole.
- Logo/detail produk.

Ketika hotspot dipilih:

```text
STITCHING

Upper stitching detail.
Example information for the demo product.
```

Hotspot merupakan **informasi dummy untuk demonstrasi**, bukan alat autentikasi nyata.

Implementasi: hotspot = `<Html>` dari Drei pada koordinat `position` di `products.json`. Posisi dicari manual sekali per model (klik model → `console.log(e.point)`).

Rotate/zoom/reset tidak perlu dibuat sendiri: `OrbitControls` sudah memberi rotate + zoom (mouse & touch), dan reset = `controlsRef.current.reset()`.

**Layout halaman produk:** viewer 3D (atau galeri foto) di kiri, detail produk di kanan; di mobile ditumpuk vertikal. Showcase dan Product Detail (bagian 7 & 8) berada di **satu halaman** `/product/:id`.

---

# 8. Product Detail

Setelah showcase, pengguna dapat membuka detail produk.

Informasi:

- Brand.
- Nama produk.
- Harga.
- Ukuran tersedia.
- Stok.
- Kondisi.
- Product ID.
- Status showcase 3D.
- Tombol verification.
- Add to wishlist.
- Add to cart.

Contoh:

```text
NIKE

Air Force 1 '07 White

Rp1.549.000

Condition
BNIB

Available Sizes
40  41  42  43  44

Stock
12

[ VERIFY PRODUCT ]

[ ADD TO WISHLIST ]
[ ADD TO CART ]
```

---

# 9. Katalog

Halaman katalog menampilkan seluruh produk.

Fitur:

- Product grid.
- Search.
- Filter brand.
- Filter ukuran.
- Filter harga.
- Filter kondisi.
- Sort harga.
- Indikator produk memiliki 3D showcase.

Contoh filter:

```text
Brand
☐ Nike
☐ Adidas
☐ New Balance
☐ Converse
☐ Vans
☐ Onitsuka Tiger

Size
☐ 40
☐ 41
☐ 42
☐ 43
☐ 44

Condition
☐ BNIB
☐ Pre-Owned
```

---

# 10. Produk 3D dan Produk Foto

Tidak semua produk harus memiliki model 3D.

Sistem menggunakan fallback:

```text
3D model tersedia
       ↓
3D Showcase

3D model tidak tersedia
       ↓
Image Showcase
```

Target ideal:

- 5–6 produk memiliki model 3D.
- Produk lain menggunakan foto.
- Produk tanpa model 3D tetap dapat digunakan seperti produk biasa.

Satu field saja yang menentukan: **`model3D` ada → 3D, `null` → foto.** Tidak perlu flag `showcase` terpisah (dua field untuk satu fakta = cepat atau lambat tidak sinkron).

```json
{ "model3D": "/models/nike-af1.glb" }
```

```json
{ "model3D": null }
```

Jika model 3D gagal dimuat (Canvas dibungkus React Error Boundary):

```text
Unable to load 3D preview.

[ VIEW PRODUCT IMAGES ]
```

Dengan demikian error pada 3D tidak boleh merusak keseluruhan halaman.

---

# 11. Verification System

ORI memiliki fitur **ORI Verification**.

Fitur ini hanya merupakan simulasi untuk menunjukkan konsep pengecekan produk.

Pengguna dapat:

1. Memasukkan product code.
2. Melakukan scan QR dummy.
3. Melihat hasil verification.

Contoh:

```text
VERIFY PRODUCT

Enter product code

[ ORI-NK-AF1-001 ]

[ VERIFY ]
```

Hasil valid:

```text
✓ VERIFIED

Nike
Air Force 1 '07 White

Product ID
ORI-NK-AF1-001

Condition
BNIB

Verification
Demo Verified
```

Hasil invalid:

```text
✕ PRODUCT NOT FOUND

The verification code is not available
in the ORI demo database.
```

---

# 12. Product Code

Seluruh kode produk bersifat **dummy**.

Format:

```text
ORI-[BRAND]-[MODEL]-[NUMBER]
```

Contoh:

```text
ORI-NK-AF1-001
ORI-NK-AJ1-001
ORI-AD-SMB-001
ORI-NB-550-001
ORI-CV-CHK-001
```

Kode tidak terhubung dengan sistem resmi brand mana pun.

Tujuannya hanya untuk:

- Identifikasi produk dalam aplikasi.
- Demo verification.
- QR.
- Data katalog.
- Simulasi sertifikat.

---

# 13. QR Code

QR code juga sepenuhnya dummy.

QR dapat berisi:

```text
ORI-NK-AF1-001
```

atau URL internal demo:

```text
/verify/ORI-NK-AF1-001
```

Ketika QR dibuka:

```text
ORI VERIFICATION

Product ID:
ORI-NK-AF1-001

Status:
VERIFIED
```

QR tidak digunakan untuk membuktikan keaslian produk secara nyata.

**Keputusan:** QR berisi **URL lengkap** deployment, misalnya:

```text
https://ori-xxx.vercel.app/verify/ORI-NK-AF1-001
```

- Tidak perlu membuat scanner QR di dalam aplikasi: cukup scan dengan kamera HP, maka halaman verify langsung terbuka. Ini juga lebih meyakinkan saat demo.
- QR ditampilkan di halaman produk dan di sertifikat (`qrcode.react`, value = `window.location.origin + '/verify/' + id`).
- Route `/verify/:code` wajib bisa dibuka langsung dari luar (lihat `vercel.json` di bagian 26).
- Scanner kamera di dalam web hanya menjadi P2.

---

# 14. Dummy Tag / Label Sepatu

Tag sepatu yang terlihat pada model 3D atau product showcase juga bersifat dummy.

Contoh:

```text
ORI
PRODUCT ID
ORI-NK-AF1-001

SIZE
42

COLOR
WHITE

DEMO
2026
```

Tag dapat digunakan sebagai bagian visual showcase.

Tujuannya:

- Membuat produk terasa lebih detail.
- Menunjukkan integrasi dengan sistem verification.
- Memberikan visual cue bahwa produk memiliki identitas di dalam sistem ORI.

Tag tidak merepresentasikan tag resmi dari brand produk.

---

# 15. Dummy Certificate

Hasil verification dapat memiliki tampilan seperti sertifikat digital.

Contoh:

```text
ORI
VERIFICATION CERTIFICATE

✓ VERIFIED

Product
Air Force 1 '07 White

Product ID
ORI-NK-AF1-001

Status
DEMO VERIFIED

Checked
06 OCT 2026

ORI Verification System
Academic Prototype
```

Seluruh data di dalam sertifikat dibuat untuk kebutuhan demonstrasi.

---

# 16. Product Data

Data produk disimpan di:

```text
src/data/products.json
```

Contoh struktur:

```json
{
  "id": "ORI-NK-AF1-001",
  "brand": "Nike",
  "name": "Air Force 1 '07 White",
  "category": "Sneakers",
  "price": 1549000,
  "sizes": [40, 41, 42, 43, 44],
  "stock": 12,
  "condition": "BNIB",
  "color": "White",
  "description": "Teks singkat, dibuat dengan LLM.",
  "model3D": "/models/nike-af1.glb",
  "images": [
    "/img/products/af1-1.webp",
    "/img/products/af1-2.webp"
  ],
  "hotspots": [
    {
      "label": "Stitching",
      "description": "Upper stitching detail.",
      "position": [0.12, 0.05, 0.3]
    },
    {
      "label": "Insole",
      "description": "Insole detail.",
      "position": [0, 0.08, -0.1]
    }
  ]
}
```

Catatan skema:

- `id` **adalah** kode verifikasi. Tidak perlu objek `verification` terpisah: verifikasi = "apakah `id` ada di `products.json`".
- `hotspots` hanya diisi untuk produk yang punya `model3D`; produk lain `[]`.
- Semua path (`/models/...`, `/img/...`) berada di folder **`public/`**, bukan `src/assets/`, supaya bisa dipanggil langsung lewat URL.
- Harga ditampilkan dengan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.
- **Skema ini dibekukan di jam pertama.** Setelah itu dua orang bisa bekerja paralel tanpa saling menunggu.

---

# 17. Katalog Produk

Produk awal:

| Brand | Model | 3D |
|---|---|---|
| Nike | Air Force 1 '07 White | ✅ |
| Nike | Air Jordan 1 High "Chicago" | ✅ |
| Adidas | Samba OG | ✅ |
| Adidas | Yeezy Boost 350 V2 | ❌ |
| New Balance | 550 White Green | ✅ |
| New Balance | 990v6 Grey | ❌ |
| Converse | Chuck 70 High Black | ❌ |
| Vans | Old Skool Black/White | ❌ |
| Onitsuka Tiger | Mexico 66 Yellow | ❌ |
| Essentials | Essentials Hoodie | ❌ |
| Stüssy | Basic Tee | ❌ |

Jumlah produk dapat dikurangi jika pengerjaan 3D atau data terlalu memakan waktu.

---

# 18. Struktur Kategori

```text
SNEAKERS
├── Nike
├── Adidas
├── New Balance
├── Converse
├── Vans
└── Onitsuka Tiger

APPAREL
├── Essentials
└── Stüssy
```

---

# 19. Wishlist

Wishlist menggunakan browser storage.

Fungsi:

- Add product.
- Remove product.
- View wishlist.
- Move product ke cart.

Tidak membutuhkan akun.

Contoh:

```text
MY WISHLIST

♡ Air Force 1 '07 White
♡ Samba OG
♡ 550 White Green
```

---

# 20. Cart

Keranjang menyimpan:

- Produk.
- Ukuran.
- Quantity.
- Harga.
- Subtotal.

Contoh:

```text
YOUR CART

Air Force 1 '07 White
Size 42
Qty 1

Rp1.549.000

────────────────
Subtotal
Rp1.549.000

[ CHECKOUT ]
```

Cart disimpan menggunakan `localStorage`.

Aturan cart:

- Item dibedakan berdasarkan **`id` + `size`**. AF1 ukuran 42 dan 43 = dua baris berbeda.
- Yang disimpan hanya `{ id, size, qty }`. Harga dan nama selalu diambil dari `products.json`, jadi data di cart tidak bisa basi.
- `qty` dibatasi `1..stock`.
- Add to cart dinonaktifkan sampai ukuran dipilih.

---

# 21. Checkout

Checkout hanya merupakan simulasi.

Tidak ada:

- Payment gateway.
- Pembayaran asli.
- Transfer bank.
- Kartu kredit asli.
- Pengiriman nyata.

Form dapat dibuat sederhana:

```text
CHECKOUT

Name
[ Your Name ]

Email
[ demo@example.com ]

Address
[ Demo Address ]

Payment
○ Demo Payment

[ PLACE DEMO ORDER ]
```

---

# 22. Order Confirmation

Setelah checkout:

```text
ORDER CONFIRMED

Your demo order has been created.

Order Number
ORI-DEMO-8F42K

Total
Rp1.549.000

This is a simulated transaction.
No payment has been processed.

[ BACK TO STORE ]
```

Nomor order dibuat secara dummy.

Format:

```text
ORI-DEMO-XXXXX
```

Order disimpan di `sessionStorage` agar tetap tersedia selama sesi demo.

---

# 23. Size Guide

Size guide menggunakan ukuran:

- US.
- EU.
- CM.

Contoh:

| EU | US | CM |
|---:|---:|---:|
| 40 | 7 | 25 |
| 41 | 8 | 26 |
| 42 | 9 | 27 |
| 43 | 10 | 28 |
| 44 | 11 | 29 |

Data size guide digunakan sebagai referensi dummy/sederhana untuk prototype.

Konversi asli berbeda antar brand (mis. EU 42 Nike ≈ US 8.5). Karena itu tabel diberi label **"Approximate — varies by brand"**. Size guide cukup berupa modal/section statis, tidak perlu halaman sendiri.

---

# 24. Admin — Opsional

Admin tidak termasuk fitur utama.

Jika masih ada waktu, dapat dibuat halaman sederhana untuk mengubah data produk melalui `localStorage`.

Namun:

> **Admin harus menjadi fitur terakhir yang dikerjakan.**

Jika fitur utama belum stabil, admin tidak perlu dibuat.

---

# 25. Teknologi

## Frontend

- React
- Vite
- JavaScript
- CSS
- `react-router-dom` (routing)
- `React.lazy` + `Suspense` untuk halaman 3D, supaya katalog/cart/checkout tidak ikut memuat Three.js (~600KB)

## 3D

- React Three Fiber
- Drei
- Three.js
- `useGLTF`
- `OrbitControls` / `CameraControls`

## QR

- `qrcode.react`

## Data

- `products.json`

## Browser Storage

- `localStorage`
- `sessionStorage`

## Deployment

- Vercel

---

# 26. Struktur Project

```text
public/
├── models/            ← GLB (dipanggil "/models/x.glb")
└── img/               ← foto produk, background

src/
├── components/
│   ├── Navbar.jsx
│   ├── ProductCard.jsx
│   ├── BrandShelf.jsx       ← Canvas landing (lazy)
│   ├── ProductViewer.jsx    ← Canvas produk + hotspot (lazy)
│   ├── ErrorBoundary.jsx    ← fallback jika 3D gagal
│   └── VerificationCard.jsx ← hasil verify + sertifikat + QR
│
├── pages/
│   ├── Home.jsx
│   ├── Catalog.jsx
│   ├── Product.jsx          ← showcase + detail
│   ├── Verify.jsx           ← /verify dan /verify/:code
│   ├── Wishlist.jsx
│   ├── Cart.jsx
│   ├── Checkout.jsx
│   └── OrderSuccess.jsx
│
├── data/
│   └── products.json
│
├── store.js                 ← useStoredState(key, initial): cart, wishlist, order
└── App.jsx                  ← routes

vercel.json
PROMPTS.md                   ← log penggunaan GenAI
```

Penyederhanaan:

- `ProductGrid`, `Hotspot`, `CartDrawer` tidak perlu menjadi file sendiri. Grid cukup satu `map()`, hotspot cukup satu `<Html>`, dan cart dibuat sebagai halaman.
- `cart.js` / `wishlist.js` / `order.js` diganti satu hook yang membaca/menulis storage (dengan `try/catch` pada `JSON.parse`).

`vercel.json` — **wajib**. Tanpa file ini, refresh atau buka link `/verify/...` dari QR akan **404**:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

# 27. State Management

Tidak membutuhkan state management kompleks.

Gunakan:

```text
products.json
     ↓
React state
     ↓
localStorage
```

### localStorage

Untuk:

- Cart.
- Wishlist.
- Demo preferences.

### sessionStorage

Untuk:

- Current order.
- Order number.
- Temporary verification state.

Product master data tetap berasal dari `products.json`.

---

# 28. Visual Direction

Gaya visual:

> **Dark Editorial + Luxury Streetwear + Technical Interface**

Karakter:

- Dark.
- Minimal.
- Modern.
- Premium.
- Technical.
- Banyak whitespace.
- Tipografi kuat.
- Animasi halus.

Palet dasar:

```text
Background
#0A0A0A

Surface
#111111

Text
#F5F5F5

Secondary
#8A8A8A
```

UI menggunakan:

- Thin border.
- Uppercase labels.
- Small metadata.
- Large typography.
- Subtle transitions.
- Minimal card decoration.

Hindari desain e-commerce yang terlalu ramai.

---

# 29. Landing Copy

Hero:

> **ORIGINALS, UP CLOSE.**

Supporting text:

> Explore sneakers and streetwear through an interactive 3D product experience.

CTA:

```text
EXPLORE COLLECTION
```

Secondary:

```text
VERIFY A PRODUCT
```

---

# 30. Navigation

Navbar:

```text
ORI

COLLECTION
BRANDS
VERIFY
SIZE GUIDE

♡
CART
```

Desktop dapat menggunakan navigation penuh.

Mobile menggunakan menu yang lebih sederhana.

---

# 31. Responsive Design

Desktop menjadi target utama karena merupakan perangkat demo.

Namun aplikasi tetap harus dapat digunakan di mobile.

### Desktop

- 3D shelf penuh.
- Mouse parallax.
- Large product viewer.

### Mobile

- Touch controls.
- Vertical catalog.
- Simplified navigation.
- Tidak bergantung pada hover.

Tambahkan fallback:

```text
[ ENTER 3D EXPERIENCE ]

atau

[ BROWSE CATALOG ]
```

Jika device/browser tidak optimal untuk 3D.

---

# 32. Loading State

3D membutuhkan waktu untuk dimuat.

Gunakan loading state:

```text
ORI

LOADING 3D EXPERIENCE...

████████████░░░ 80%
```

Setelah selesai:

```text
[ ENTER EXPERIENCE ]
```

Tidak boleh ada halaman kosong ketika asset sedang loading.

---

# 33. Error State

Minimal sediakan:

```text
Product not found
```

```text
Invalid verification code
```

```text
Out of stock
```

```text
3D model unavailable
```

```text
Cart is empty
```

```text
Unable to load 3D preview
```

Semua error harus memiliki tombol kembali atau fallback yang jelas.

---

# 34. Performance 3D

Model 3D harus dioptimalkan sebelum dimasukkan ke aplikasi.

Workflow:

```text
Original Model
      ↓
Remove unnecessary objects
      ↓
Reduce geometry
      ↓
Optimize textures
      ↓
Export GLB
      ↓
Compress
      ↓
Test in browser
```

Contoh:

```bash
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt
```

Target utama:

- Loading cepat.
- File tidak terlalu besar.
- Tidak menyebabkan browser berat.
- Model tetap terlihat bagus.

Jika sebuah model terlalu berat, gunakan produk lain atau fallback gambar.

Angka konkret:

- Budget per GLB: **≤ 3 MB** setelah kompresi. Texture maksimal 1024px (`--texture-size 1024`).
- `<Canvas dpr={[1, 1.5]}>` supaya laptop/HP tidak berat.
- Loading bar memakai `useProgress()` dari Drei (persentase asli, bukan animasi palsu).
- `useGLTF.preload()` untuk model AF1 (produk demo utama).
- Hasil image-to-3D biasanya terlalu padat. **Selalu** jalankan `gltf-transform optimize` dulu sebelum di-commit.

---

# 35. 3D Interaction

Interaksi utama:

### Rotate

User dapat memutar produk.

### Zoom

User dapat memperbesar detail.

### Reset

Mengembalikan posisi kamera.

### Hotspot

Menampilkan detail produk.

### Camera Transition

Perpindahan kamera dari shelf ke showcase harus terasa halus.

Tujuan animasi bukan sekadar dekorasi, tetapi membuat navigasi terasa seperti satu pengalaman.

---

# 36. Demo Route

~~Buat route khusus `/demo`~~ — **dipotong.** Alur demo sudah merupakan alur normal aplikasi, jadi route khusus tidak menambah apa pun. Sebagai gantinya:

- Tulis **demo script** di manual PDF dan latih minimal 2x.
- Halaman `/verify` menampilkan hint kecil: *"Try: ORI-NK-AF1-001"*.

Demo flow:

```text
Landing
 ↓
Nike
 ↓
Air Force 1
 ↓
3D Showcase
 ↓
Hotspot
 ↓
Verify
 ↓
Add to Cart
 ↓
Checkout
 ↓
Order Success
```

Dengan demikian seluruh fitur utama dapat ditunjukkan dalam waktu singkat.

---

# 37. Demo Verification Data

Siapkan data yang sengaja dibuat untuk demonstrasi.

### Valid

```text
ORI-NK-AF1-001
ORI-AD-SMB-001
ORI-NB-550-001
```

### Invalid

```text
ORI-XXXX-999
```

Demo harus menunjukkan:

1. Kode valid → berhasil.
2. Kode invalid → gagal.
3. QR valid → membuka verification.
4. Product ID dapat diteruskan ke halaman produk.

---

# 38. Disclaimer Aplikasi

Gunakan disclaimer sederhana:

> **ACADEMIC PROTOTYPE**  
> ORI is a fictional academic prototype. Product information, prices, stock, product IDs, QR codes, verification results, and transactions shown in this application are simulated for demonstration purposes only.

Tambahkan:

> ORI is not a real store and does not process real transactions.

---

# 39. Aset Visual

Aset yang digunakan dalam prototype dapat berupa:

- Model 3D.
- Product image.
- Background.
- Texture.
- Icon.
- Illustration.

Untuk kebutuhan proyek dummy, aset digunakan sebagai bagian dari visual prototype.

Fokus tim adalah memastikan aset dapat digunakan dengan baik di aplikasi dan tidak menghambat pengerjaan fitur utama.

---

# 40. Pembagian Kerja

## Orang A — 3D & Experience

Tanggung jawab:

- 3D shelf.
- Brand shelf.
- Camera transition.
- Product viewer.
- Rotate/zoom.
- Hotspot.
- GLB preparation.
- 3D performance.

## Orang B — Web & System

Tanggung jawab:

- Catalog.
- Search/filter.
- Product detail.
- Verification.
- QR.
- Wishlist.
- Cart.
- Checkout.
- Order confirmation.
- Deployment.
- Manual PDF.

## Bersama

- `products.json`.
- Visual direction.
- Integration.
- Testing.
- Final polish.
- Presentation.

---

# 41. Titik Integrasi

Kedua orang menggunakan satu sumber data:

```text
products.json
```

Orang A membutuhkan:

- `model3D`
- `hotspots`

Orang B membutuhkan:

- `id` (sekaligus kode verifikasi)
- `brand`
- `name`
- `price`
- `sizes`
- `stock`
- `condition`
- `images`

Kontrak antar orang: Orang A mengekspor `<ProductViewer product={p} />` dan `<BrandShelf onSelect={id => navigate('/product/' + id)} />`. Orang B cukup memasang komponen tersebut. Sampai GLB siap, Orang A memakai **box placeholder**, jadi integrasi bisa dilakukan sejak awal.

Dengan demikian perubahan data tidak perlu dilakukan di dua tempat.

---

# 42. Prioritas Fitur

> Revisi 7 Okt: waktu tersisa ±25 jam, jadi P0 diperketat. Yang bisa dipotong tanpa merusak alur utama dipindah ke P1.

## P0 — Wajib selesai

- [ ] Deploy Vercel + `vercel.json` (**jam pertama**, bukan terakhir).
- [ ] Landing: rak 3D + klik brand (camera zoom) + klik produk.
- [ ] Product page: viewer 3D (rotate/zoom via OrbitControls) + fallback foto + detail + pilih size.
- [ ] Minimal **3 model 3D**: AF1, Samba, 550.
- [ ] Catalog + filter brand.
- [ ] Verification: input kode + `/verify/:code` + valid/invalid state.
- [ ] QR di halaman produk.
- [ ] Cart → Checkout simulation → Order confirmation.
- [ ] Disclaimer akademik di footer.
- [ ] Loading state 3D (tidak boleh blank).
- [ ] `PROMPTS.md` diisi sambil jalan.

## P1 — Penting

- [ ] Hotspot.
- [ ] Wishlist.
- [ ] Search.
- [ ] Filter size / harga / kondisi + sort.
- [ ] Sertifikat verification.
- [ ] Size guide.
- [ ] Error state lengkap (bagian 33).
- [ ] Responsive polish.
- [ ] Model 3D ke-4 dan ke-5.

## P2 — Opsional

- [ ] Admin.
- [ ] Scanner QR di dalam web.
- [ ] Advanced animation.
- [ ] Extra products.
- [ ] Dark/light mode.

Jika waktu terbatas, **P2 langsung dipotong**.

---

# 43. Timeline

> **Revisi 7 Okt:** target Selasa terlewat (repo belum ada). Timeline dipadatkan ke ±25 jam tersisa.

## Rabu 7 Okt — sore (±16:00–19:00)

| Orang A — 3D | Orang B — Web |
|---|---|
| Generate 3 model (AF1, Samba, 550) dengan image-to-3D; log prompt ke `PROMPTS.md` | Setup Vite + router + `vercel.json`, push, **deploy ke Vercel** |
| Optimize GLB (≤3 MB) | `products.json` lengkap (skema bagian 16, deskripsi dibuat dengan LLM) |
| `ProductViewer` + OrbitControls + fallback, mulai dengan box placeholder | Navbar, Catalog + filter brand, Product page (detail + size) |

**Checkpoint 19:00:** URL Vercel hidup, klik produk di katalog → halaman produk dengan viewer 3D.

## Rabu 7 Okt — malam (±19:00–24:00)

| Orang A — 3D | Orang B — Web |
|---|---|
| `BrandShelf`: rak, shoebox untuk produk non-3D, label brand | Verify (`/verify`, `/verify/:code`) + QR |
| Camera zoom per brand (`CameraControls`) | Cart (`id+size`) → Checkout → Order success |
| Loading bar `useProgress` | Disclaimer, footer |
| (P1) Hotspot | (P1) Wishlist, search |

**Checkpoint 24:00:** seluruh alur Definisi Selesai (bagian 47) bisa dijalankan di URL Vercel, walaupun belum rapi. **Tidur.**

## Kamis 8 Okt — pagi (±08:00–12:00)

- Test checklist bagian 44 di laptop **dan HP** (scan QR asli dengan kamera HP).
- Perbaiki bug, responsive, error state.
- P1 yang belum selesai, hanya jika P0 sudah aman.

## Kamis 8 Okt — siang (±12:00–15:00)

- Screenshot semua halaman.
- Manual PDF + bagian GenAI dari `PROMPTS.md`.
- Materi presentasi + latihan demo script 2x.

## Kamis — maksimal 15:00

Target:

> **FREEZE PROJECT**

Setelah freeze:

- Jangan menambah fitur.
- Jangan mengganti arsitektur.
- Jangan mengganti model besar.
- Fokus testing dan submission.

Deadline:

> **17:00 WIB**

Sisakan buffer minimal 1–2 jam.

---

# 43A. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Hasil image-to-3D jelek / gagal | Showcase kosong | Coba 2–3 foto berbeda; jika tetap gagal, pakai model CC-BY dari Sketchfab (cantumkan kredit) atau fallback foto |
| GLB terlalu berat | Landing lambat, HP crash | Budget ≤3 MB, `dpr` dibatasi, lazy-load halaman 3D |
| Refresh / link QR → 404 di Vercel | Demo QR gagal di depan dosen | `vercel.json` rewrite sejak deploy pertama |
| Error 3D membuat seluruh halaman putih | Demo berhenti | `ErrorBoundary` di sekitar setiap `<Canvas>` |
| `localStorage` rusak / di-clear | Cart crash | `try/catch` pada `JSON.parse`, fallback ke `[]` |
| Dua orang saling menunggu | Waktu terbuang | Skema `products.json` dibekukan di jam pertama + placeholder box |
| Fitur baru tetap ditambah setelah 15:00 | Bug saat submission | Freeze adalah aturan, bukan saran |
| Merek & logo asli | Isu hak cipta | Disclaimer akademik + daftar kredit aset di manual |

---

# 44. Testing Checklist

## Landing

- [ ] Rak muncul.
- [ ] Semua brand dapat dipilih.
- [ ] Camera movement berjalan.
- [ ] Tidak blank ketika loading.

## Catalog

- [ ] Produk muncul.
- [ ] Search berjalan.
- [ ] Filter brand berjalan.
- [ ] Filter size berjalan.
- [ ] Filter harga berjalan.

## Product

- [ ] Detail produk benar.
- [ ] Size dapat dipilih.
- [ ] Add to wishlist berjalan.
- [ ] Add to cart berjalan.

## 3D

- [ ] Model muncul.
- [ ] Rotate berjalan.
- [ ] Zoom berjalan.
- [ ] Reset berjalan.
- [ ] Hotspot berjalan.
- [ ] Fallback gambar berjalan.

## Verification

- [ ] Kode valid berhasil.
- [ ] Kode invalid gagal.
- [ ] QR dapat dibuka.
- [ ] Product ID benar.

## Cart

- [ ] Produk masuk.
- [ ] Quantity berubah.
- [ ] Produk dapat dihapus.
- [ ] Total benar.

## Checkout

- [ ] Form dapat diisi.
- [ ] Order berhasil dibuat.
- [ ] Nomor order muncul.
- [ ] Cart dapat dikosongkan.
- [ ] Tidak ada pembayaran nyata.

## Deployment

- [ ] Vercel online.
- [ ] Semua asset dapat dimuat.
- [ ] Tidak ada console error kritis.
- [ ] Refresh halaman tidak merusak aplikasi.
- [ ] Link dapat dibuka dari perangkat lain.
- [ ] Buka `/verify/ORI-NK-AF1-001` langsung di tab baru → tidak 404.
- [ ] Scan QR dengan kamera HP → halaman verify terbuka.
- [ ] Test di mode incognito (storage kosong) → tidak crash.

---

# 45. Manual PDF

Isi manual:

1. Cover.
2. Identitas tim.
3. Deskripsi ORI.
4. Tujuan aplikasi.
5. Teknologi.
5a. **Penggunaan Generative AI** (dari `PROMPTS.md`: tool, prompt, hasil, before/after model 3D).
6. Struktur fitur.
7. Screenshot landing.
8. Screenshot 3D showcase.
9. Screenshot catalog.
10. Screenshot product detail.
11. Screenshot verification.
12. Screenshot QR.
13. Screenshot cart.
14. Screenshot checkout.
15. Screenshot order confirmation.
16. Daftar kode demo.
17. Disclaimer akademik.
18. Link deployment.

Kode demo:

```text
VALID
ORI-NK-AF1-001
ORI-AD-SMB-001
ORI-NB-550-001

INVALID
ORI-XXXX-999
```

---

# 46. Checklist Submission

- [ ] Data tim.
- [ ] Studi kasus.
- [ ] Repository.
- [ ] Website online di Vercel.
- [ ] Semua fitur P0 selesai.
- [ ] Demo script ditulis & dilatih.
- [ ] `PROMPTS.md` lengkap.
- [ ] Manual PDF selesai.
- [ ] Screenshot fitur.
- [ ] Kode verification demo.
- [ ] Disclaimer.
- [ ] Link deployment diuji.
- [ ] Google Form submission.
- [ ] Materi presentasi proses pembuatan.

---

# 47. Definisi Selesai

Proyek dianggap selesai apabila pengguna dapat menjalankan alur berikut tanpa bantuan:

```text
Open ORI
   ↓
See 3D Shelf
   ↓
Select Brand
   ↓
Select Product
   ↓
Open 3D Showcase
   ↓
Rotate / Zoom
   ↓
Inspect Hotspot
   ↓
View Product Detail
   ↓
Verify Product
   ↓
Add to Cart
   ↓
Checkout
   ↓
Receive Demo Order
```

Selain itu:

- Website dapat dibuka melalui URL publik.
- Tidak ada fitur inti yang rusak.
- 3D memiliki fallback.
- Verification memiliki valid dan invalid state.
- Checkout jelas merupakan simulasi.
- Data dummy konsisten.
- UI terlihat sebagai satu produk yang utuh.

---

# 48. Final Scope

ORI secara final terdiri dari:

```text
                    ORI
       Interactive Sneaker Experience
                       │
       ┌───────────────┴───────────────┐
       │                               │
  3D EXPERIENCE                   PRODUCT SYSTEM
       │                               │
  3D Brand Shelf                   Catalog
       │                               │
  Camera Transition                Search
       │                               │
  Product Showcase                 Filter
       │                               │
  Rotate / Zoom                    Product Detail
       │                               │
  Hotspots                         Wishlist
       │                               │
       └───────────────┬───────────────┘
                       │
                  VERIFICATION
                       │
                 Code + QR Dummy
                       │
                       ↓
                CHECKOUT SIMULATION
                       │
                       ↓
                 ORDER SUCCESS
```

## Arsitektur

```text
React + Vite
     │
     ├── React Three Fiber
     │       └── GLB / GLTF
     │
     ├── products.json
     │
     ├── localStorage
     │       ├── Cart
     │       └── Wishlist
     │
     └── sessionStorage
             └── Demo Order
```

## Prinsip utama

> **3D adalah daya tarik utama.**

> **Verification adalah fitur pembeda.**

> **Catalog, wishlist, cart, dan checkout mendukung pengalaman utama.**

> **Semua data dan transaksi bersifat dummy.**

> **Tidak ada backend atau payment nyata.**

> **Kualitas pengalaman dan kelancaran demo lebih penting daripada jumlah fitur.**

---

# 49. Satu Kalimat untuk Presentasi

> **ORI adalah prototipe interactive concept store sneakers dan streetwear yang menggunakan pengalaman 3D — dengan model produk yang dihasilkan Generative AI — sebagai cara utama untuk mengeksplorasi produk, dilengkapi simulasi verification, wishlist, keranjang, dan checkout untuk menunjukkan alur digital commerce secara utuh.**
