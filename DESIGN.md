# Mi Tune — clay listening room

## Direction

Claymorphism melalui permukaan hangat, tepi empuk, highlight bagian dalam, dan kontrol audio taktil. Kanvas ivory, ink cokelat gelap, aksen terracotta, serta sage untuk status dan area sekunder. Artwork asli lagu menjadi fokus pada kartu dan Now Playing; hindari gradient, glow warna, dan animasi dekoratif berulang.

## References

- https://hype4.academy/tools/claymorphism-generator — volume, bentuk empuk, highlight dan bayangan.
- https://www.wendyzhou.se/blog/music-player-ui-design-inspiration/ — hierarki player dan kontrol audio.
- https://motion.dev/docs/react-animation — feedback interaksi dan reduced motion.

Referensi dipakai sebagai prinsip, bukan salinan layout. Radius dan bayangan berlapis dipakai karena Claymorphism diminta secara eksplisit.

## Tokens

Kanvas #f4efe7; surface #fbf8f2; ink #302c29; secondary text #6b6158; accent #a44730; tint #ecd0be; sage #dde3d2; line #e5ded3. Font Manrope Variable lokal dengan display berat 800, navigasi 600, body normal, dan ukuran teks sesuai hierarki. Panel 30 px, artwork 16–22 px, kontrol 14–18 px.

Perhitungan sRGB memverifikasi secondary text #6b6158 pada sidebar #eee8dc sebesar 4.952:1, pada panel lirik #eee9df sebesar 4.993:1, dan pada kanvas sebesar 5.278:1. Audit browser berikutnya tetap diperlukan karena gambar, opacity, dan latar campuran dapat memengaruhi hasil akhir.

## Layout and flow

Sidebar berlabel pada desktop; navigasi bawah pada ponsel. Pencarian berada di shell dan tidak mengganti halaman ketika digunakan dari Now Playing. Audio node dan dock berada di luar transisi halaman. Putar membuka /track/<trackId> dan memulai pemuatan otomatis, tanpa dialog persiapan. Audio yang sudah tersedia langsung dimainkan; audio baru masih bergantung pada waktu persiapan sumber.

Now Playing menempatkan artwork, metadata dan kontrol di kiri, lirik di kanan. Pada ponsel keduanya ditumpuk, kemudian daftar penemuan lagu. Highlight dan seek lirik hanya aktif untuk lagu yang sedang diputar. Tidak menciptakan lirik atau timestamp ketika sumber tidak menyediakan data.

Playlist memiliki cover dari artwork lagunya, enam gambar pilihan yang dibundel, atau gambar JPEG/PNG/WebP pengguna. Upload dipotong persegi dan dioptimalkan ke JPEG 512x512 sebelum disimpan. Playlist, favorit dan unduhan hanya tersedia untuk akun; tamu tetap dapat mencari dan memutar musik.

## Motion

Satu import surface Framer Motion. Page fade, feedback tekan pada tombol dan navigasi, serta pergantian status memiliki durasi pendek. Audio tidak masuk AnimatePresence. Lenis hanya aktif pada pointer fine tanpa preferensi reduced motion. Perubahan preferensi OS, jenis pointer, visibilitas dokumen, dan dialog diperhatikan secara langsung; scrolling dalam lirik dan dialog tidak diambil alih.

## Verification

Bukti browser dari redesign awal dicatat di direktori scratch mi-tune-redesign-live dan mi-tune-redesign-audit. Pada batch tersebut, MP3 Code Monkey yang sudah tersedia diverifikasi dengan jam audio nyata: pencarian di halaman lagu mempertahankan ID, route, dan pemutaran tanpa dialog. Home dan tujuh route diuji pada lebar desktop dan ponsel. Bukti historis tersebut bukan verifikasi tampilan revisi fitur terbaru.

Dialog native menjebak fokus dan mengembalikannya setelah Escape. Audit axe bukan bukti lengkap aksesibilitas. Pemeriksaan visual kualitatif melalui vision belum tersedia karena connection error; screenshot disediakan untuk tinjauan, bukan diklaim telah dilihat.

Revisi fitur terbaru lolos build produksi, 28 tes kontrak/logic dengan data terisolasi dan 5 pemeriksaan komponen jsdom. Tidak menjalankan ulang QA visual atau perjalanan pengguna live karena pengguna melakukan pengujian akhir aplikasi. Tampilan responsif, kontras pada warna/latar kustom, playback live, install PWA dan unduhan offline tetap perlu diperiksa pada versi ini.
