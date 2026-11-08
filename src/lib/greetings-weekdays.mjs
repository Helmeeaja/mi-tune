const pools = {
  '1-morning': [
    ['Pagi! Mau buka minggu ini dengan lagu apa?', 'Morning! What’s your first song of the week?'],
    ['Senin pagi, favorit lama atau lagu baru?', 'Monday morning: an old favorite or something new?'],
    ['Mulai Senin dengan lagu yang kamu suka.', 'Start Monday with a song you love.'],
    ['Selamat pagi. Coba lihat lagu yang lagi ramai.', 'Good morning. Take a look at what’s trending.'],
    ['Lagu pertama buat Senin sudah ada di sini.', 'Your first Monday song is right here.'],
    ['Mau musik atau podcast buat pagi ini?', 'Music or a podcast this morning?'],
    ['Senin nggak harus ribet. Pilih lagu, lalu putar.', 'Keep Monday simple. Pick a song and press play.'],
    ['Ada lagu baru buat menemani awal minggu.', 'There’s something new to hear this week.']
  ],
  '1-afternoon': [
    ['Siang! Mau dengar apa buat lanjut Senin?', 'Afternoon! What are you playing this Monday?'],
    ['Cari lagu buat siang ini? Coba pilihan di bawah.', 'Need an afternoon track? Try these picks.'],
    ['Senin siang, waktunya ganti lagu.', 'Monday afternoon. Time for a different song.'],
    ['Favoritmu tetap ada, kalau belum ingin coba yang baru.', 'Your favorites are here if you’re not ready for something new.'],
    ['Mau jeda sebentar? Ada podcast buat didengar.', 'Taking a break? There’s a podcast to try.'],
    ['Lanjutkan siang ini dengan lagu pilihanmu.', 'Keep the afternoon going with your pick.'],
    ['Senin siang bisa ditemani satu album penuh.', 'Monday afternoon could use a whole album.'],
    ['Sudah punya lagu buat diputar berikutnya?', 'Have you picked your next song yet?']
  ],
  '1-evening': [
    ['Sore! Mau lagu yang santai buat Senin ini?', 'Evening! Fancy something mellow this Monday?'],
    ['Lagu pelan atau tetap upbeat? Pilih saja.', 'Mellow or upbeat? Your choice.'],
    ['Senin sore, coba dengar sesuatu yang beda.', 'Monday evening. Try something different.'],
    ['Balik ke album favorit juga boleh.', 'You can always go back to a favorite album.'],
    ['Ada pilihan akustik buat sore ini.', 'Some acoustic picks for this evening.'],
    ['Podcast baru bisa jadi pilihan buat Senin sore.', 'A new podcast could be your Monday evening pick.'],
    ['Mau satu lagu lagi sebelum malam?', 'One more song before tonight?'],
    ['Pilih yang enak didengar sore Senin ini.', 'Play whatever sounds good this Monday evening.']
  ],
  '1-night': [
    ['Malam! Masih mau dengar satu lagu lagi?', 'Evening! Still up for one more song?'],
    ['Senin malam, mau lanjut album yang tadi?', 'Monday night. Want to finish that album?'],
    ['Ada lagu santai buat menutup Senin.', 'Some mellow songs to finish Monday.'],
    ['Lagu lama juga enak diputar lagi malam ini.', 'Tonight’s a good time to revisit an old favorite.'],
    ['Belum mengantuk? Coba episode podcast baru.', 'Not sleepy yet? Try a new podcast episode.'],
    ['Kalau ingin musik pelan, mulai dari sini.', 'If you want something quiet, start here.'],
    ['Senin hampir selesai. Apa lagu terakhirnya?', 'Monday’s nearly over. What’s your last song?'],
    ['Putar satu lagi, atau simpan buat besok.', 'Play another, or save it for tomorrow.']
  ],
  '2-morning': [
    ['Pagi! Ada lagu yang ingin kamu dengar Selasa ini?', 'Morning! What do you feel like hearing this Tuesday?'],
    ['Selasa pagi, coba mulai dari chart terbaru.', 'Tuesday morning. Start with the latest chart.'],
    ['Putar favoritmu buat membuka Selasa.', 'Put on a favorite to start Tuesday.'],
    ['Mau cari penyanyi baru pagi ini?', 'Want to find a new artist this morning?'],
    ['Lagu baru atau album yang sudah hafal?', 'A new song or an album you know by heart?'],
    ['Selamat pagi. Podcast juga ada di sini.', 'Good morning. There are podcasts here too.'],
    ['Selasa dimulai dengan pilihanmu sendiri.', 'Tuesday starts with your own pick.'],
    ['Coba dengar satu lagu yang belum pernah kamu putar.', 'Try a song you haven’t played before.']
  ],
  '2-afternoon': [
    ['Siang! Selasa ini mau ditemani musik apa?', 'Afternoon! What’s on for Tuesday?'],
    ['Lanjut playlist tadi, atau mulai yang baru?', 'Keep that playlist going, or start a new one?'],
    ['Ada pilihan baru buat siang Selasa.', 'Some fresh picks for Tuesday afternoon.'],
    ['Butuh lagu instrumental? Cari di sini.', 'Looking for instrumentals? Search here.'],
    ['Siang ini, coba dengar artis yang belum kamu kenal.', 'Try an artist you haven’t heard this afternoon.'],
    ['Lagu yang lagi ramai bisa jadi pilihan berikutnya.', 'A trending song could be your next pick.'],
    ['Mau dengar cerita dulu? Buka podcast.', 'In the mood for a story? Try a podcast.'],
    ['Pilih lagu buat menemani sisa Selasa.', 'Pick a song for the rest of Tuesday.']
  ],
  '2-evening': [
    ['Sore! Selasa ini mau yang santai atau ramai?', 'Evening! Taking it mellow or upbeat this Tuesday?'],
    ['Ada lagu akustik buat Selasa sore.', 'Acoustic songs for Tuesday evening.'],
    ['Coba album yang belum sempat kamu dengar.', 'Try an album you haven’t got around to yet.'],
    ['Sore ini bisa mulai dari lagu favorit lama.', 'Start this evening with an old favorite.'],
    ['Mau ganti dari musik ke podcast?', 'Want to switch from music to a podcast?'],
    ['Selasa sore, waktunya pilih lagu berikutnya.', 'Tuesday evening. Pick your next track.'],
    ['Kalau suka lagunya, simpan ke koleksi.', 'If you like the song, save it to your library.'],
    ['Lagu santai buat didengar sampai selesai.', 'A mellow song to hear all the way through.']
  ],
  '2-night': [
    ['Malam! Mau lagu pelan buat Selasa ini?', 'Evening! Something quiet for Tuesday night?'],
    ['Ada favorit yang ingin kamu putar ulang?', 'Got a favorite you want to hear again?'],
    ['Selasa malam, satu episode podcast dulu?', 'Tuesday night. How about a podcast episode?'],
    ['Lanjut mendengarkan, nggak perlu pilih ulang.', 'Keep listening. No need to pick again.'],
    ['Mau coba album baru malam Selasa ini?', 'Want to try a new album this Tuesday night?'],
    ['Pilihan malam ini bisa mulai dari jazz.', 'Tonight’s picks could start with jazz.'],
    ['Satu lagu yang kamu suka buat menutup Selasa.', 'A song you love to end Tuesday.'],
    ['Belum selesai mendengar? Tambah lagu ke antrean.', 'Not done listening? Add a song to the queue.']
  ],
  '3-morning': [
    ['Pagi! Rabu ini mau mulai dari musik atau podcast?', 'Morning! Music or a podcast this Wednesday?'],
    ['Tengah minggu, coba lagu yang belum pernah diputar.', 'Midweek. Try a song you’ve never played.'],
    ['Selamat pagi Rabu. Favoritmu siap diputar.', 'Good Wednesday morning. Your favorites are ready.'],
    ['Ada lagu baru buat memulai tengah minggu.', 'Something new to start the middle of your week.'],
    ['Mau tahu yang lagi banyak didengar pagi ini?', 'Want to see what people are playing this morning?'],
    ['Rabu pagi bisa dimulai dengan satu album.', 'Wednesday morning could start with an album.'],
    ['Cari judulnya, lalu langsung putar.', 'Search the title, then press play.'],
    ['Pilih lagu pembuka buat Rabu ini.', 'Pick your opening track for Wednesday.']
  ],
  '3-afternoon': [
    ['Siang! Mau lanjut playlist buat Rabu ini?', 'Afternoon! Keeping your Wednesday playlist going?'],
    ['Tengah minggu, waktunya dengar sesuatu yang baru.', 'Midweek. Time to hear something new.'],
    ['Lagu instrumental atau pop buat siang Rabu?', 'Instrumentals or pop this Wednesday afternoon?'],
    ['Ada pilihan dari chart buat dicoba siang ini.', 'Some chart picks to try this afternoon.'],
    ['Mau cari lagu yang tadi terngiang?', 'Looking for that song stuck in your head?'],
    ['Siang Rabu bisa juga ditemani podcast.', 'Wednesday afternoon works for podcasts too.'],
    ['Pilih yang kamu suka, bukan cuma yang populer.', 'Pick what you like, not just what’s popular.'],
    ['Antrean kosong? Coba tambah satu lagu baru.', 'Empty queue? Add a new song.']
  ],
  '3-evening': [
    ['Sore! Lagu apa buat Rabu ini?', 'Evening! What’s your Wednesday song?'],
    ['Coba jazz atau akustik buat sore Rabu.', 'Try jazz or acoustic songs this Wednesday evening.'],
    ['Mau dengar album sampai lagu terakhir?', 'Want to hear an album through to the last track?'],
    ['Ada podcast buat menemani sore tengah minggu.', 'A podcast for your midweek evening.'],
    ['Lanjut lagu favorit, atau coba pilihan baru.', 'Keep a favorite on, or try a fresh pick.'],
    ['Sore ini, putar sesuatu yang memang kamu suka.', 'This evening, play something you actually enjoy.'],
    ['Lagu yang enak nggak harus dari chart.', 'A good song doesn’t have to be on the chart.'],
    ['Mau pilih penyanyi dulu? Cari namanya.', 'Rather start with an artist? Search their name.']
  ],
  '3-night': [
    ['Malam! Rabu ini mau ditutup dengan lagu apa?', 'Evening! What’s your last song this Wednesday?'],
    ['Ada pilihan pelan buat malam tengah minggu.', 'Some quieter picks for a midweek night.'],
    ['Masih mau mendengar? Lanjut antreannya.', 'Still listening? Keep the queue going.'],
    ['Rabu malam, coba podcast dari kreator baru.', 'Wednesday night. Try a podcast from a new creator.'],
    ['Satu lagu lama buat malam ini juga oke.', 'An old favorite sounds good tonight too.'],
    ['Mau album yang santai buat Rabu malam?', 'A mellow album for Wednesday night?'],
    ['Putar yang berikutnya, atau ulang favoritmu.', 'Play the next track, or replay your favorite.'],
    ['Lagu terakhir dulu sebelum menutup Rabu.', 'One last song for Wednesday.']
  ],
  '4-morning': [
    ['Pagi! Mau mulai Kamis dengan lagu apa?', 'Morning! What are you starting Thursday with?'],
    ['Kamis pagi, coba pilihan yang lagi ramai.', 'Thursday morning. Try what’s trending.'],
    ['Ada penyanyi yang ingin kamu dengar pagi ini?', 'Any artist you feel like hearing this morning?'],
    ['Favorit lama masih jadi pilihan buat Kamis.', 'An old favorite still works for Thursday.'],
    ['Mau lagu upbeat buat membuka hari?', 'An upbeat track to start the day?'],
    ['Pagi Kamis bisa dimulai dengan podcast juga.', 'Thursday morning can start with a podcast too.'],
    ['Pilih satu album, lalu biarkan diputar.', 'Pick an album and let it play.'],
    ['Cari lagu baru buat masuk playlist Kamis.', 'Find a new song for your Thursday playlist.']
  ],
  '4-afternoon': [
    ['Siang! Kamis ini mau dengar apa lagi?', 'Afternoon! What else are you hearing this Thursday?'],
    ['Coba lagu baru di sela playlist favorit.', 'Try a new song between your favorites.'],
    ['Ada pilihan santai buat siang Kamis.', 'Some mellow picks for Thursday afternoon.'],
    ['Mau lanjut album yang belum habis?', 'Want to finish that album?'],
    ['Siang ini, coba dengar rekomendasi dari chart.', 'Try a few chart picks this afternoon.'],
    ['Podcast atau musik buat sisa Kamis?', 'Podcasts or music for the rest of Thursday?'],
    ['Lagu berikutnya bisa kamu pilih sendiri.', 'You can pick the next song yourself.'],
    ['Kamis siang, waktunya cek koleksi favorit.', 'Thursday afternoon. Check your favorites.']
  ],
  '4-evening': [
    ['Sore! Mau lagu yang santai buat Kamis ini?', 'Evening! Something mellow this Thursday?'],
    ['Ada lagu lama yang pas buat diputar sore ini.', 'An old favorite to replay this evening.'],
    ['Kamis sore, coba album dari artis baru.', 'Thursday evening. Try an album by a new artist.'],
    ['Mau podcast yang belum pernah kamu dengar?', 'A podcast you’ve never heard before?'],
    ['Jazz, akustik, atau tetap pop?', 'Jazz, acoustic, or sticking with pop?'],
    ['Pilih lagu favorit buat menemani Kamis sore.', 'Pick a favorite for Thursday evening.'],
    ['Sore ini, satu lagu baru dulu.', 'This evening, start with one new song.'],
    ['Kalau sudah cocok, lanjutkan albumnya.', 'If it’s sounding good, keep the album going.']
  ],
  '4-night': [
    ['Malam! Kamis ini masih mau satu lagu lagi?', 'Evening! One more song this Thursday?'],
    ['Ada musik santai buat Kamis malam.', 'Mellow music for Thursday night.'],
    ['Mau dengar episode terbaru malam ini?', 'Want to hear the latest episode tonight?'],
    ['Pilih satu lagu sebelum Jumat datang.', 'Pick a song before Friday arrives.'],
    ['Kamis malam bisa mulai dari album favorit.', 'Thursday night can start with a favorite album.'],
    ['Cari lagu yang ingin kamu dengar ulang.', 'Find the song you want to replay.'],
    ['Lanjut antreanmu buat malam Kamis.', 'Keep your Thursday night queue going.'],
    ['Mau menutup hari dengan piano atau akustik?', 'Piano or acoustic songs to end the day?']
  ]
}

export const weekdayGreetings = Object.fromEntries(Object.entries(pools).map(([key, values]) => [key, values.map(([id, en]) => ({ id, en }))]))
