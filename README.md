# Kas Pribadi

Aplikasi web lokal untuk mencatat pemasukan dan pengeluaran, melihat saldo otomatis, dan meninjau ringkasan bulanan.

## Menjalankan aplikasi

Untuk mencoba di komputer, jalankan server lokal dari folder proyek:

```powershell
python -m http.server 8000
```

Lalu buka `http://localhost:8000` di browser. Pada kunjungan pertama, buka halaman saat online agar aplikasi bisa menyimpan berkas untuk penggunaan offline.

Tidak ada proses build atau dependensi tambahan. Catatan disimpan di `localStorage` browser dan hanya tersedia di browser/perangkat yang sama.

## Publikasikan melalui GitHub Pages

Workflow GitHub Pages sudah tersedia di `.github/workflows/deploy-pages.yml`. Hubungkan atau salin proyek ini ke repository GitHub, pastikan branch deploy bernama `main`, lalu pada pengaturan repository buka **Settings → Pages** dan pilih **GitHub Actions** sebagai sumber deployment. Setiap push ke branch `main` akan menerbitkan aplikasi melalui HTTPS.

Jika branch utama repository bernama `master` atau nama lain, ubah nama branch di bagian `on.push.branches` workflow agar sesuai.

Sesudah deployment berhasil, buka alamat Pages di ponsel:

- **Android:** buka dengan Chrome, lalu ketuk **Pasang aplikasi**. Jika tombol belum muncul, buka menu Chrome dan pilih pemasangan atau tambahkan ke layar utama.
- **iPhone/iPad:** buka dengan Safari, ketuk **Bagikan → Tambahkan ke Layar Utama**.

Alamat `localhost` hanya merujuk ke perangkat yang menjalankan server; ponsel tidak bisa memasang aplikasi dari alamat lokal komputer. Tombol **Cara pasang** menampilkan petunjuk di aplikasi. Setelah termuat pertama kali, antarmuka dapat dibuka offline. Data transaksi dan kategori tetap tersimpan di browser perangkat tersebut; PWA ini tidak menyinkronkan data antarperangkat.

## Fitur

- Ringkasan saldo total, pemasukan, dan pengeluaran bulanan.
- Grafik saldo berjalan per tanggal; pilih titik untuk menyaring transaksi pada tanggal itu.
- Tambah, ubah, hapus, dan filter transaksi.
- Tambah dan hapus kategori pemasukan/pengeluaran secara terpisah. Riwayat transaksi lama tetap menyimpan nama kategori yang sudah dihapus.
- Riwayat seluruh transaksi dan pemilih bulan.
- Data tetap tersimpan lokal di browser.
