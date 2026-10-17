# NametagFlow v13.8.14

Perbaikan hasil audit: menjaga setelan cetak saat pembaruan, membatalkan
respons login/log yang kedaluwarsa, dan mencegah dialog cetak muncul kembali
setelah ditutup. Transaksi lokal dan tinjauan konflik mengikuti sesi asal.

Baca **00-BACA-DULU.txt** lalu unggah isi folder aplikasi ke GitHub Pages.
Backend tetap **v13.8.12**; tidak perlu deploy ulang jika versi tersebut aktif.

Semua 10 model mempertahankan geometri v13.8.13, termasuk enam model logo
dan kurva PDF. Contoh PDF v13.8.13 tetap relevan. Font berlisensi tidak dibundel.
Pengaturan yang sudah terlanjur berubah sebelumnya perlu disetel ulang.

Pengujian lokal: **127/127** aplikasi/backend dan **19/19** font (146 total).
Lihat **LAPORAN-AUDIT-V13.8.14.txt** dan **tests/HASIL-UJI-V13.8.14.txt**.

Belum dipasang pada GitHub/akun pengguna. Pengujian memakai data sintetis;
kecepatan jaringan dan hasil printer produksi belum diukur.
Panduan/contoh versi lama disimpan sebagai arsip.
