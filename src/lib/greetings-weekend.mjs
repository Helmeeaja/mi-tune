const pools = {
  '5-morning': [
    ['Pagi! Lagu apa buat membuka Jumat?', 'Morning! What’s your first Friday song?'],
    ['Akhir pekan sudah dekat. Mau dengar apa dulu?', 'The weekend’s close. What are you playing first?'],
    ['Jumat pagi, coba lagu yang lagi ramai.', 'Friday morning. Try what’s trending.'],
    ['Favoritmu bisa jadi lagu pembuka hari ini.', 'A favorite could be your first track today.'],
    ['Mau musik yang agak upbeat buat Jumat?', 'Something upbeat for Friday?'],
    ['Pagi ini, coba podcast dari kreator baru.', 'Try a podcast from a new creator this morning.'],
    ['Ada lagu baru buat playlist akhir pekan.', 'Something new for your weekend playlist.'],
    ['Jumat dimulai. Pilih lagu yang kamu suka.', 'Friday’s here. Pick a song you love.']
  ],
  '5-afternoon': [
    ['Siang! Mau mulai playlist akhir pekan sekarang?', 'Afternoon! Ready to start the weekend playlist?'],
    ['Jumat siang, lagu berikutnya apa?', 'Friday afternoon. What’s your next track?'],
    ['Coba pilihan dari chart buat siang Jumat.', 'Try some chart picks this Friday afternoon.'],
    ['Mau lanjut musik atau beralih ke podcast?', 'More music or switching to a podcast?'],
    ['Akhir pekan bisa mulai dari lagu favorit.', 'The weekend could start with a favorite song.'],
    ['Siang ini, tambah sesuatu yang baru ke antrean.', 'Add something new to your queue this afternoon.'],
    ['Jumat cocok buat memutar album yang belum dicoba.', 'Friday’s a good time to try that album.'],
    ['Pilih musik buat sisa Jumatmu.', 'Pick some music for the rest of your Friday.']
  ],
  '5-evening': [
    ['Sore! Jumat ini mau santai atau ikut bernyanyi?', 'Evening! Taking it easy or singing along this Friday?'],
    ['Akhir pekan dimulai. Mau dengar lagu apa?', 'The weekend’s here. What do you want to hear?'],
    ['Ada pilihan baru buat Jumat sore.', 'Some new picks for Friday evening.'],
    ['Mau kembali ke playlist favorit akhir pekan?', 'Going back to your favorite weekend playlist?'],
    ['Lagu santai atau sesuatu yang lebih ramai?', 'Something mellow or a little more upbeat?'],
    ['Jumat sore juga enak buat mendengar podcast.', 'Friday evening works for a podcast too.'],
    ['Coba putar satu album baru sore ini.', 'Try a new album this evening.'],
    ['Lagu berikutnya buat membuka akhir pekan.', 'The next track to start your weekend.']
  ],
  '5-night': [
    ['Malam! Jumat ini mau dengar apa lagi?', 'Hey! What else are you playing this Friday night?'],
    ['Satu lagu lagi buat awal akhir pekan?', 'One more track to start the weekend?'],
    ['Jumat malam, coba pilihan yang lebih upbeat.', 'Friday night. Try something more upbeat.'],
    ['Lanjut album favoritmu malam ini.', 'Keep your favorite album going tonight.'],
    ['Mau podcast buat Jumat malam?', 'A podcast for Friday night?'],
    ['Ada lagu yang ingin kamu putar berulang?', 'Got a song you want to keep on repeat?'],
    ['Playlist Jumat malam bisa mulai dari sini.', 'Your Friday night playlist can start here.'],
    ['Pilih yang kamu suka buat malam akhir pekan.', 'Play what you like this weekend night.']
  ],
  '6-morning': [
    ['Pagi! Sabtu ini mau ditemani lagu apa?', 'Morning! What’s on for Saturday?'],
    ['Mau lagu santai buat membuka akhir pekan?', 'Something mellow to start the weekend?'],
    ['Sabtu pagi, coba dengar sesuatu yang baru.', 'Saturday morning. Try something new.'],
    ['Ada album favorit buat diputar pagi ini.', 'A favorite album to put on this morning.'],
    ['Musik atau podcast buat pagi Sabtu?', 'Music or a podcast this Saturday morning?'],
    ['Mulai Sabtu dari lagu yang memang kamu suka.', 'Start Saturday with a song you really like.'],
    ['Mau lihat yang lagi populer akhir pekan ini?', 'Want to see what’s popular this weekend?'],
    ['Pagi Sabtu, pilih lagu lalu nikmati.', 'Saturday morning. Pick a song and enjoy it.']
  ],
  '6-afternoon': [
    ['Siang! Mau cari lagu baru Sabtu ini?', 'Afternoon! Finding something new this Saturday?'],
    ['Coba artis yang belum pernah kamu dengar.', 'Try an artist you’ve never heard before.'],
    ['Sabtu siang, album lama atau rilisan baru?', 'Saturday afternoon: an old album or a new release?'],
    ['Ada podcast buat dicoba siang akhir pekan.', 'A podcast to try this weekend afternoon.'],
    ['Lagu baru bisa masuk playlist favoritmu.', 'A new song could make it onto your favorites.'],
    ['Siang Sabtu cocok buat menjelajahi koleksi.', 'Saturday afternoon. Browse your library.'],
    ['Mau cari lagu dari judul atau nama artis?', 'Search by song title or artist name.'],
    ['Pilih lagu berikutnya buat Sabtu ini.', 'Pick your next song for Saturday.']
  ],
  '6-evening': [
    ['Sore! Sabtu ini mau lagu santai?', 'Evening! Something mellow this Saturday?'],
    ['Ada pilihan akustik buat sore akhir pekan.', 'Some acoustic picks for Saturday evening.'],
    ['Mau lanjut album yang tadi diputar?', 'Want to keep that album playing?'],
    ['Sabtu sore, coba episode podcast baru.', 'Saturday evening. Try a new podcast episode.'],
    ['Putar ulang lagu yang kamu suka sore ini.', 'Replay a song you love this evening.'],
    ['Lagu lama atau artis baru buat Sabtu sore?', 'An old favorite or a new artist for Saturday evening?'],
    ['Kalau ingin jazz, mulai dari pencarian.', 'In the mood for jazz? Start with a search.'],
    ['Tambah lagu buat antrean Sabtu malam nanti.', 'Add a song for your Saturday night queue.']
  ],
  '6-night': [
    ['Malam! Sabtu ini masih mau mendengar?', 'Hey! Still listening this Saturday night?'],
    ['Mau lanjut playlist akhir pekanmu?', 'Keeping your weekend playlist going?'],
    ['Sabtu malam, pilih satu lagu yang paling kamu suka.', 'Saturday night. Pick a song you really love.'],
    ['Ada podcast yang belum kamu coba malam ini.', 'A podcast you haven’t tried yet tonight.'],
    ['Lagu pelan juga cocok buat Sabtu malam.', 'Something quiet works for Saturday night too.'],
    ['Album berikutnya bisa kamu pilih sendiri.', 'You can choose the next album.'],
    ['Mau tambah satu lagu lagi buat Sabtu malam?', 'One more song for Saturday night?'],
    ['Putar lagi yang tadi, kalau masih ingin dengar.', 'Play that one again if you’re still enjoying it.']
  ],
  '0-morning': [
    ['Pagi! Minggu ini mau dimulai dengan lagu apa?', 'Morning! What’s your first Sunday song?'],
    ['Lagu santai buat Minggu pagi ada di sini.', 'Some mellow songs for Sunday morning.'],
    ['Mau kembali ke favorit lama pagi ini?', 'Going back to an old favorite this morning?'],
    ['Minggu pagi, coba dengar satu album penuh.', 'Sunday morning. Try a whole album.'],
    ['Musik akustik atau podcast buat membuka Minggu?', 'Acoustic songs or a podcast to start Sunday?'],
    ['Pilih lagu yang enak buat didengar pagi ini.', 'Pick something you’d enjoy hearing this morning.'],
    ['Ada pilihan baru buat pagi akhir pekan.', 'Some fresh picks for a weekend morning.'],
    ['Nikmati pagi dengan lagu yang kamu suka.', 'Enjoy the morning with a song you love.']
  ],
  '0-afternoon': [
    ['Siang! Mau lanjut mendengar di hari Minggu?', 'Afternoon! Keeping the music on this Sunday?'],
    ['Ada lagu baru buat sisa akhir pekan.', 'Something new for the rest of the weekend.'],
    ['Minggu siang, coba pilihan jazz atau indie.', 'Sunday afternoon. Try some jazz or indie.'],
    ['Mau dengar podcast dari kreator favoritmu?', 'Want a podcast from your favorite creator?'],
    ['Siang ini bisa ditemani album yang kamu suka.', 'An album you love for this afternoon.'],
    ['Lagu berikutnya buat Minggu, pilih di sini.', 'Pick your next Sunday song here.'],
    ['Lanjut playlist lama atau buat yang baru?', 'Keep an old playlist going or make a new one?'],
    ['Coba simpan satu penemuan baru hari Minggu ini.', 'Save a new find this Sunday.']
  ],
  '0-evening': [
    ['Sore! Mau lagu apa buat menutup akhir pekan?', 'Evening! What’s your song to end the weekend?'],
    ['Minggu sore, favorit lama selalu bisa diputar.', 'Sunday evening. There’s always an old favorite to play.'],
    ['Ada musik santai buat sore Minggu.', 'Some mellow music for Sunday evening.'],
    ['Mau satu episode podcast sebelum malam?', 'A podcast episode before tonight?'],
    ['Coba dengar album baru sampai selesai sore ini.', 'Try a new album from start to finish this evening.'],
    ['Pilih lagu yang ingin kamu bawa ke minggu depan.', 'Pick a song to take into next week.'],
    ['Lanjutkan antrean buat sisa Minggu sore.', 'Keep your queue going for Sunday evening.'],
    ['Mau kembali ke lagu yang tadi kamu simpan?', 'Want to go back to that song you saved?']
  ],
  '0-night': [
    ['Malam! Lagu apa buat penutup Minggu?', 'Hey! What’s your last song for Sunday?'],
    ['Ada pilihan pelan buat akhir pekan ini.', 'Some quieter picks to end the weekend.'],
    ['Minggu malam, masih mau satu lagu lagi?', 'Sunday night. Still up for one more song?'],
    ['Mau lanjut episode yang belum selesai?', 'Want to finish that episode?'],
    ['Lagu favorit buat menutup minggu juga oke.', 'A favorite song sounds good to end the week.'],
    ['Minggu malam ini bisa ditemani album santai.', 'A mellow album for this Sunday night.'],
    ['Simpan lagu baru buat diputar minggu depan.', 'Save a new song for next week.'],
    ['Putar pilihanmu buat akhir Minggu malam.', 'Play your own pick to finish Sunday night.']
  ]
}

export const weekendGreetings = Object.fromEntries(Object.entries(pools).map(([key, values]) => [key, values.map(([id, en]) => ({ id, en }))]))
