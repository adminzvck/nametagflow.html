# NametagFlow v13.8.12

Koreksi font nama + NIP dan penyimpanan kelompok yang lebih efisien.
Baca **00-BACA-DULU.txt** sebelum memasang. Versi ini perlu pembaruan
**Apps Script serta GitHub**, kemudian hubungkan **Swis721 BT Bold** di PC.

| Bagian | Font | Ukuran | Lebar awal |
|---|---|---:|---:|
| Nama tanpa NIP | Arial Bold | 28 pt | 70% |
| Nama dengan NIP | Swis721 BT Bold | 21 pt | 70% |
| Nomor NIP | Swis721 BT Bold | 13 pt | 79% |

Batas nama tetap 73 mm tanpa logo / 55 mm dengan logo. PDF dan riwayat lama
mempertahankan profilnya; buat lembar baru untuk memakai koreksi ini.
Pengaturan nama tanpa NIP yang sudah disesuaikan pada v13.8.11 dipertahankan.

Pusat kini menerima hingga 100 perubahan per kelompok. Pengiriman ulang
upsert yang terputus menggunakan rencana simpan dan ID operasi lama secara
berkelompok. Pemeriksaan revisi, konflik, siklus cetak, dan verifikasi hasil
simpan tetap berjalan. Backend lama tetap kompatibel pada batas kirim lama.

Uji lokal: **103/103** uji aplikasi/backend dan **19/19** uji font.
Laporan: `tests/HASIL-UJI-V13.8.12.txt`.
Contoh visual: **Perbandingan-NIP-v13.8.12.pdf**.
Kecepatan nyata masih bergantung pada koneksi, ukuran Sheet, dan Google.
Belum dipasang atau diuji pada data produksi pengguna.

Font berlisensi tidak dibundel. Gambar/PDF contoh menyimpan outline saja.
Panduan terdahulu dalam `arsip-panduan` dan file berlabel versi lama adalah
arsip; gunakan panduan v13.8.12 untuk pemasangan saat ini.
