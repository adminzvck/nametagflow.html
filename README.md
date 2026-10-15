# NametagFlow v13.8.11 - proporsi tulisan Corel

Nama tanpa NIP memakai Arial Bold asli 28 pt dengan lebar awal **70%**.
Pengaturan ini mengikuti proporsi mendatar yang paling umum pada referensi
15 SEPTEMBER 02.cdr: rasio lebar/tinggi sekitar 0,69913.

Baca **00-BACA-DULU.txt** untuk pemasangan dan **PERUBAHAN-V13.8.11.txt** untuk rincian.

- Upload seluruh isi folder aplikasi ke lokasi index.html lama di GitHub.
- Setelah penerbitan selesai, Ctrl+Shift+R dan pastikan versi V13.8.11.
- Buat lembar cetak **baru**. PDF dan riwayat lama tidak berubah.
- Cetak Produksi > Ukuran tulisan > Lebar nama tanpa NIP: 70% (dapat diatur 40-100%).
- Font tetap Arial Bold (arialbd.ttf); tidak perlu mengganti ke Arial Regular.
- Nama dengan NIP dan baris NIP tetap memakai pengaturan sebelumnya.
- Backend tetap v13.8.6. Apps Script tidak perlu diperbarui untuk revisi ini.
- Font proprietary tidak dibundel. Font dibaca dari PC produksi.

**Perbandingan-Sebelum-Sesudah.pdf** memuat contoh nama yang sama pada kedua profil.
Contoh baru ini memakai outline Arial Bold yang tertanam dalam referensi CDR,
tanpa membundel file font. Pengukuran kerning contoh Node dapat sedikit berbeda
dari browser produksi. PDF/PNG/SVG versi sebelumnya tetap merupakan arsip.

Verifikasi: `node tests/run-tests.cjs` (93/93) dan
`node tests/local-font-tests.cjs` (16/16). Lihat tests/HASIL-UJI-V13.8.11.txt.
