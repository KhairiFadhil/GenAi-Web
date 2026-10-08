# PROMPTS — Log Penggunaan Generative AI

Catat setiap pemakaian AI yang penting. Ini bahan manual PDF bagian 5a dan presentasi "proses pembuatan".

| # | Tanggal | Area | Tool | Prompt (ringkas) | Hasil | Revisi manual |
|---|---|---|---|---|---|---|
| 1 | 2026-10-07 | Planning | Claude Code | "Sempurnakan planning KONSEP_FINAL.md" | Timeline revisi, bagian GenAI, risiko, skema data | Review tim |
| 2 | 2026-10-07 | Code | Claude Code | "Scaffold project ORI sesuai planning" | Vite + router + semua halaman + 3D dasar | — |
| 3 | 2026-10-07 | Debug | Claude Code | "Jalankan repo" → "blackscreen" | Akar masalah: `useEffect` mengembalikan Promise dari `scrollTo` sehingga seluruh app crash. Diperbaiki di `App.jsx` | — |
| 4 | 2026-10-07 | 3D | Claude Code | "Sempurnakan web, pakai model di `ori-proto`" | Model sepatu prosedural (`src/three/shoe.js`): 6 varian stripe, ketebalan sole per produk, 9 colorway di `products.json`, anchor hotspot dihitung dari geometri | Cek kecocokan warna per produk |
| 5 | 2026-10-07 | Visual | Claude Code + three.js | Render foto studio dari model prosedural | 18 foto `public/img/products/*.webp` (3/4 + samping), `og.webp`, ilustrasi SVG hoodie & tee | — |
| 6 | 2026-10-07 | Copy | Claude Code | Teks hotspot per produk | Label & deskripsi hotspot di `products.json` | Review tim |
| 7 | 2026-10-07 | Code / UI | Claude Code | "Tutup gap KONSEP + polish" | Rak 3D model kubus per brand, viewer (sudut kamera, zoom, hotspot fly-to), katalog + filter, sertifikat verifikasi, wishlist → cart, checkout, menu mobile, size guide | — |
| 8 | 2026-10-07 | 3D | Claude Code | "Modelnya masih kurang bagus, poles sampai 90% mirip produk asli" | Generator ditulis ulang per model: 9 siluet (low/high-top, cupsole, vulkanisir, Boost), panel overlay, jahitan, tali + simpul, decal teks, knit zebra, ambient occlusion. Dibandingkan dengan foto referensi Wikimedia Commons per iterasi | Cek kemiripan per produk |
| 9 | 2026-10-08 | Audit & Backend | Claude Code | "Audit, sempurnakan, responsif semua device; lanjut backend dan database" | Audit 11 ukuran layar × 11 halaman + aksesibilitas (axe), perbaikan form/landscape/target sentuh; backend Vercel Functions + Neon Postgres (order, stok live, riwayat verifikasi, newsletter) dengan fallback mode lokal, diuji dengan Postgres lokal (PGlite) | Setup database oleh pemilik project Vercel |
| 10 | | 3D | (Meshy / Tripo / Rodin) | Foto AF1 → image-to-3D | `public/models/nike-af1.glb` (opsional, viewer sudah mendukung GLB) | gltf-transform optimize |

## Before / After

- [ ] Screenshot `ori-proto` (prototipe awal) vs model di halaman produk
- [ ] Screenshot rak sebelum (shoebox abu-abu) vs sesudah (rak kubus per brand)
