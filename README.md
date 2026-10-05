# NametagFlow v13.8.10

Paket lengkap: nama tanpa NIP memakai **Arial Bold asli tepat 28 pt**.
Baca **00-BACA-DULU.txt** untuk pemasangan dan **PETUNJUK.txt** untuk rinciannya.

- Upload seluruh isi folder ke lokasi `index.html` lama di GitHub.
- Tunggu GitHub Pages selesai, lalu Ctrl+Shift+R dan periksa versi V13.8.10.
- Buka Cetak Produksi → Kelola font → Deteksi font yang terpasang.
- Manual di Windows: pilih `C:\Windows\Fonts\arialbd.ttf` untuk Arial Bold.
- Buat lembar cetak baru; panel font menampilkan Arial Bold (lokal asli) · 28 pt.
- Batas 73/55 mm adalah maksimum. Nama pendek tidak dibesarkan ke batas itu.
- Nama dengan NIP dan baris NIP tetap memakai Swis721 BT Regular.
- Riwayat v13.8.6–v13.8.9 tetap menggunakan Arial Regular tersimpan secara terpisah.
- Backend tetap v13.8.6, identik dengan paket sebelumnya; Apps Script tidak perlu diubah.

Semua file paket sebelumnya dipertahankan. Font proprietary tidak disertakan.
PDF/PNG/SVG lama adalah arsip; baca CONTOH-LAMA.txt. Uji hasil terbaru pada
PC produksi melalui COBA-CETAK.html dan gunakan skala cetak 100% / Actual size.

Verifikasi: `node tests/run-tests.cjs` dan `node tests/local-font-tests.cjs`.
Hasil: 103 pengujian lulus; rincian dan batas verifikasi dalam tests/HASIL-UJI-V13.8.10.txt.
