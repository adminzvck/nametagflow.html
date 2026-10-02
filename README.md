# NametagFlow v13.8.9

Paket lengkap untuk memperbarui repository NametagFlow yang sudah dipakai.
Mulai dari **00-BACA-DULU.txt**, lalu ikuti **PETUNJUK.txt**.

- Unggah seluruh isi paket ke folder yang berisi `index.html` lama.
- Pertahankan struktur `vendor/`, `licenses/`, `tests/`, dan `backend/`.
- Setelah GitHub Pages selesai, muat ulang situs dengan Ctrl+Shift+R.
- Hubungkan Arial Regular dan Swis721 BT Regular pada setiap PC produksi.
- Uji melalui `COBA-CETAK.html`; cetak dengan skala 100% / Actual size.
- Backend disertakan sebagai sumber lengkap dan tetap v13.8.6; perubahan font
  tidak memerlukan update backend yang sudah kompatibel.

Baca `CONTOH-LAMA.txt` sebelum memakai PDF/PNG/SVG arsip. Contoh hasil font asli
terbaru perlu dibuat di PC yang memiliki font tersebut.

Verifikasi lokal: `node tests/run-tests.cjs` dan `node tests/local-font-tests.cjs`.

**Font:** buka Cetak Produksi → Kelola font. Keterangan font yang benar-benar
 dipakai terlihat pada panel **Font pada lembar ini**, tepat di atas pratinjau.
Lembar baru menggunakan Arial Regular/Swis721 BT Regular asli sesuai model.
Arsip lama tetap memakai profil lamanya; buat lembar baru untuk font terbaru.
