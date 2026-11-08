# Mi Tune

## Register

product

## Users and purpose

Aplikasi musik pribadi untuk mencari dan mendengarkan lagu YouTube Music, membuat koleksi, membaca lirik, berteman, serta memainkan unduhan tanpa jaringan. Digunakan melalui web/PWA pada desktop dan ponsel.

## Current design brief

Pengguna meminta rombak seluruh tampilan ke claymorphism dengan Framer Motion. Halaman detail lagu harus menempatkan artwork/informasi dan lirik berdampingan pada desktop. Pemutar harus tetap berjalan ketika pengguna mencari lagu lain atau berpindah halaman.

Revisi lanjutan mencakup Settings, profil akun yang dapat diedit, halaman login/register tersendiri, status dan pembatalan undangan teman, pembatasan fitur akun untuk tamu, streaming progresif serta lirik dengan gulir manual dan offset. Pengguna melakukan pengujian akhir aplikasi; pemeriksaan implementasi dibatasi ke build/startup, komponen inti dan kontrak keamanan dengan data terisolasi.

## Interaction principles

- Putar adalah satu klik. Pemuatan dan pemutaran otomatis; tidak ada popup persiapan.
- Artwork/judul dan mini-player membuka detail lagu, bukan tab browser baru.
- Audio dan antrean berada di shell aplikasi, bukan di halaman yang berganti.
- Hanya unduhan yang memerlukan konfirmasi izin konten.
- Data, jumlah lagu, metadata, cover dan lirik berasal dari layanan nyata atau koleksi perangkat. Tidak ada lagu, statistik, timestamp atau akun palsu di katalog produksi.
- Desktop, tablet dan ponsel memiliki susunan yang sesuai ruangnya, bukan versi desktop yang dikecilkan.

## Constraints

Pertahankan React/Vite, Tailwind v4, backend dan data yang ada. Framer Motion ditambahkan sesuai permintaan. Tidak mempublikasikan aplikasi, mengubah login browser, atau membuat akun pada database pengguna. Integrasi musik tidak resmi tidak melewati DRM atau login wall.
