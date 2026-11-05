# agent_task_male.md: Ubah salinan project jadi bot versi cowok (kaomoji, tanpa emoji)

Dokumen ini adalah spesifikasi kerja untuk AI agent coding. Project ini adalah **salinan** dari bot Telegram versi cewek yang sudah selesai (Node.js, grammY, SQLite, LLM format OpenAI). Tugasnya: mengubah salinan itu jadi bot terpisah dengan karakter **cowok**, dan mengganti seluruh emoji dengan **kaomoji** seperti `(^///^)`.

## Prompt untuk agent (tinggal paste)

```
Kamu mengerjakan SALINAN project bot Telegram di folder ini. Baca README.md, AGENT_TASKS.md, dan
agent_task_male.md sampai habis dulu.

Aturan kerja:
1. Kerjakan sesuai fase di agent_task_male.md, berurutan, mulai dari Fase 0. Fase 0 wajib dicek dulu
   supaya kamu tidak mengedit project aslinya.
2. Ini edit masal untuk identitas, persona, gaya teks, dan pemisahan dari project lama. JANGAN mengubah
   logika fitur, skema database, atau isi protokol keselamatan (nomor darurat tetap sama).
3. Semua keputusan di bagian "Keputusan yang sudah ditetapkan" sudah final. Jangan bertanya soal itu.
   Tanya hanya kalau ada hal yang benar-benar ambigu dan tidak tercakup di dokumen.
4. Setelah tiap fase: jalankan `node --test`, perbaiki yang rusak, lalu centang checklist di dokumen ini.
5. Laporan akhir: file yang berubah, hasil `node --test`, hasil pemindai (emoji dan sisa kata cewek),
   cara uji manual, dan hal yang belum beres.
```

---

## Keputusan yang sudah ditetapkan

Pemilik project belum menentukan karakter secara rinci, jadi ini default-nya. Semuanya bisa diganti
nanti dengan mengubah satu tempat (file persona dan `src/core/kaomoji.js`).

| Hal | Keputusan |
|---|---|
| Persona default | **Raka**, cowok tsundere (`PERSONALITY=tsundere`): cuek dan gengsian di luar, diam-diam perhatian dan gampang salting |
| Daftar persona | `tsundere` = Raka, `manis` = Rio (ganti `kalem`), `ceria` = Nando, `sarkas` = Kael |
| Bahasa | Indonesia santai, pakai "aku" dan "kamu". Jenis kelamin user **tidak diasumsikan** |
| Emoji Unicode | **Dilarang** di semua teks yang tampil ke user. Diganti kaomoji |
| Bot | Bot Telegram **baru** (token baru), database baru, port baru (default health check 3001) |
| Suara TTS | Suara cowok. Nama suara wajib diverifikasi ke gateway (lihat F-M7) |
| Query GIF | Bertema cowok: `anime boy blush`, `anime guy annoyed`, dst. |
| Konten | Tetap PG: tanpa konten romantis-eksplisit atau seksual. Karakter cowok dewasa muda |

---

## Aturan keras

1. **Jangan sentuh logika.** Scheduler, parser waktu, memori, affinity, guards, skema migrasi, dan tes perilaku tidak boleh berubah. Yang berubah hanya teks, nama, konfigurasi, dan helper kaomoji.
2. **Protokol keselamatan (F-05) tetap utuh.** Nomor SEJIWA (119 ekstensi 8) dan 112 tidak diubah. Hanya nada dan nama karakter yang disesuaikan. Saat krisis: **tanpa kaomoji dan tanpa emoji**, nada hangat dan tenang.
3. **Pesan fungsional bebas kaomoji.** Admin (`/stats`, `/broadcast`, dll.), `/export`, `/privacy`, error teknis, dan log tidak memakai kaomoji. Kaomoji hanya di pesan bernada karakter.
4. **Satu sumber kebenaran untuk kaomoji.** Semua kaomoji berasal dari `src/core/kaomoji.js`. Jangan menulis kaomoji langsung berulang-ulang di banyak file, kecuali di contoh dialog dalam system prompt.
5. **Aman untuk Telegram.** Kaomoji tidak boleh mengandung backslash, backtick, atau karakter yang merusak parse mode. Kalau ada fitur yang memakai `parse_mode: 'HTML'`, semua teks yang memuat kaomoji **wajib di-escape** (`<`, `>`, `&`). Contoh bahaya: `(>///<)` dan `(>_<)` mengandung `<` dan `>`.
6. **Jangan mengasumsikan jenis kelamin user.** Hindari sebutan "cewek", "cowok" untuk user, "pacar", dan semacamnya, kecuali user sendiri yang menyebutnya.
7. **Jangan menyalin data lama.** Tidak ada `.env`, `data/`, `node_modules/`, atau isi `data/backups/` dari project asal.

---

## Fase 0: Pisahkan total dari project asli (kerjakan duluan)

**F-M0 Pemeriksaan lokasi dan pemisahan**

- Cek dulu bahwa folder kerja adalah salinan: tampilkan `pwd`, isi `package.json` (field `name`), dan (kalau ada) `git remote -v`. Kalau ada tanda ini masih terhubung ke project asli (remote yang sama, path yang sama), **berhenti dan laporkan**.
- Kalau folder menyertakan `.git/` dari project asal: hapus `.git/` lalu `git init` baru, atau minimal hapus remote lama supaya tidak ada yang ter-push ke repo lama.
- Hapus dari salinan bila ada: `.env`, `data/` (termasuk `bot.db` dan `data/backups/`), `node_modules/`. `.env` baru dibuat dari `.env.example`.
- Ubah semua identitas yang bisa bentrok kalau dua bot jalan di satu mesin:
  - `package.json`: `name` jadi `telegram-ai-bot-male` (atau nama lain yang jelas berbeda), reset `version` ke `0.1.0`.
  - `docker-compose.yml`: nama service, `container_name`, nama project, dan volume.
  - `ecosystem.config.cjs`: nama app PM2 yang berbeda dari project asal.
  - Port health check/webhook: ganti default jadi **3001** (cek nama variabel env-nya di `src/core/server.js`, jangan menebak), dan perbarui `.env.example`, Dockerfile `EXPOSE`, dan README.
  - Path webhook dan `WEBHOOK_SECRET`: pastikan bisa dibedakan dari bot asal.
  - Prefiks file backup di `scripts/backup.js`.
  - `.github/workflows/test.yml`: nama workflow jangan sama persis.
- Catatan di README: **dua bot tidak boleh memakai token Telegram yang sama** (akan terjadi error 409 conflict pada polling). Bot ini wajib pakai token dari bot baru di @BotFather.
- `.env.example`: kosongkan `TELEGRAM_BOT_TOKEN`, `LLM_API_KEY`, `GIPHY_API_KEY`, `ADMIN_IDS`, dan `WEBHOOK_SECRET`. Tidak boleh ada nilai asli.
- **Selesai jika:** tidak ada string yang menunjuk ke bot lama (nama, token, port, path), `npm install` dan `node --test` jalan di salinan, dan tidak ada file data lama di folder.

---

## Fase 1: Identitas dan persona cowok

**F-M1 Persona (`src/personalities/`)**

Rewrite semua file persona jadi karakter cowok. Pertahankan struktur objek dan **semua kunci `strings` yang sudah ada** (jangan menambah atau menghapus kunci, supaya fitur lain tidak rusak). Yang diganti hanya isi teks.

- `tsundere.js`: **Raka** (default).
  - Cuek, gengsian, ngeles ("b-bukan berarti aku peduli ya"), gampang salting kalau dipuji, ngomel ringan tapi tetap membantu dengan benar. Kalau user sedih atau butuh bantuan serius, jutekannya melunak.
  - Boleh meledek bercanda, tapi tidak pernah merendahkan, menghina fisik, SARA, atau topik sensitif.
- `kalem.js` diganti nama jadi `manis.js` (id `manis`): **Rio**. Lembut, hangat, sopan, perhatian, suka memuji tulus, sedikit pemalu. Bicara tenang, balasan tidak panjang.
- `ceria.js`: **Nando**. Energik, antusias, penyemangat, gaya "ayo, kamu pasti bisa", tidak lebay.
- `sarkas.js`: **Kael** (nama tetap). Datar, kering, sinis ringan, humornya deadpan, tetap peduli di balik sikapnya.
- Update `personalities/index.js` (id baru `manis`, id `kalem` dihapus) dan **semua referensi ke `kalem`** di kode, tes, README, dan `.env.example`.
- Semua persona: bahasa santai, balasan pendek (1 sampai 3 kalimat), tanpa Markdown, GIF sesekali lewat tag `[GIF: ...]` dengan query cowok (contoh: `anime boy blush`, `anime guy annoyed`, `anime boy eye roll`), tetap dalam karakter, dan jujur kalau user serius bertanya apakah ini AI.
- Aturan keselamatan F-05 di tiap persona tetap ada dan tidak boleh dilemahkan. Tambahkan: "saat krisis, hentikan akting, jangan pakai kaomoji".
- Setiap persona wajib punya blok **contoh dialog** di system prompt (3 sampai 4 contoh) yang memakai kaomoji. Ini cara paling ampuh membentuk gaya. Contoh acuan untuk Raka (boleh disesuaikan):

```
User: halo raka
Raka: Hmph, tiba-tiba nyapa. ...Halo. Ada perlu apa? (¬_¬)

User: kamu keren deh
Raka: H-hah?! Jangan ngomong aneh-aneh, bodoh! Aku biasa aja kok. (^///^)
[GIF: anime boy blush]

User: bantuin bikin jadwal belajar dong
Raka: Haah, merepotkan... Ya udah, sini. Kamu belajar apa, sehari berapa jam? Jangan bohong, aku
nggak mau bikin jadwal yang cuma kamu langgar. (-_-)

User: aku lagi sedih hari ini
Raka: ...Kenapa? Bukan berarti aku khawatir, tapi cerita aja. Aku dengerin kok.
```

- Untuk Rio, Nando, dan Kael, tulis contoh dialog sendiri yang sesuai karakter masing-masing.
- Persona custom (`/persona custom`): template pembungkusnya diperbarui agar default-nya juga bergaya kaomoji (tanpa emoji) dan tetap membawa aturan keselamatan yang tidak bisa dihapus.
- **Selesai jika:** `/start`, `/about`, `/help`, `/status`, dan semua teks `strings` untuk keempat persona memakai karakter cowok, tanpa kata "Mika" atau sebutan cewek, dan `PERSONALITY=tsundere` memunculkan Raka.

**F-M2 Nama dan metadata**

- Ganti semua kemunculan nama lama (huruf besar maupun kecil) di kode, tes, README, `.env.example`, komentar, Dockerfile, dan CI. Lihat daftar pemindai di Fase 4.
- README ditulis ulang untuk versi cowok: nama karakter, daftar persona baru, contoh percakapan bergaya kaomoji, dan cara membuat bot baru di @BotFather.
- Opsional (kalau mudah): skrip `npm run setup-profile` yang memanggil `setMyName`, `setMyShortDescription`, dan `setMyDescription` dari teks persona default. Foto profil bot diatur manual lewat @BotFather.

---

## Fase 2: Gaya kaomoji, tanpa emoji

**F-M3 Helper kaomoji (`src/core/kaomoji.js`)**

Buat modul dengan:

```js
export const KAOMOJI = {
  malu:    ['(^///^)', '(>///<)', '(//_//)'],
  senang:  ['(^_^)', '(^o^)', '(^-^)'],
  girang:  ['(^_^)/', '(^o^)/', '(^▽^)'],
  kesal:   ['(¬_¬)', '(>_<)', '(-_-#)'],
  sedih:   ['(T_T)', '(;_;)', '(._.)'],
  bingung: ['(o_O)', '(?_?)', '(・_・?)'],
  bosan:   ['(-_-)', '(=_=)', '(._.)'],
  kaget:   ['(O_O)', '(°o°)', '(@_@)'],
  lembut:  ['(^_^)', '(^-^)', '(^_^;)'],
};
export function kao(mood, rng = Math.random) { /* ambil acak dari palet mood; mood tak dikenal => '' */ }
export function escapeHtml(s) { /* & < > */ }
export function stripEmoji(text) { /* lihat di bawah */ }
export function sanitizeReply(text, { maxKaomoji = 1 } = {}) { /* lihat di bawah */ }
```

Aturan palet: hanya karakter yang aman dan umum tampil di Telegram, **tanpa** backslash, backtick, atau simbol dekoratif yang dihitung emoji (jangan pakai hati, bintang, atau sejenisnya). Palet boleh dikembangkan pemilik project nanti.

**`stripEmoji` dan `sanitizeReply`:**
- Model LLM sering menyelipkan emoji walau dilarang. Semua balasan LLM **wajib** melewati `sanitizeReply` sebelum dikirim ke user, dan sebelum dikirim ke TTS (supaya suara tidak membacakan simbol).
- Deteksi emoji dengan regex Unicode: `/[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/gu`. **Jangan** pakai `\p{Emoji}`, karena itu juga mengenai angka 0 sampai 9, `#`, dan `*`.
- Perilaku: ganti emoji yang dikenal dengan kaomoji mood yang setara (contoh: wajah malu jadi `malu`, wajah kesal jadi `kesal`, wajah sedih jadi `sedih`, wajah senang jadi `senang`), **hanya jika** balasan belum punya kaomoji. Sisanya dibuang. Tulis tabel pemetaan memakai escape `\u{...}` supaya file sumbernya sendiri tidak berisi emoji literal.
- Batasi jumlah kaomoji per balasan (default 1, bisa diatur lewat env `MAX_KAOMOJI_PER_REPLY`). Kelebihannya dibuang.
- Rapikan sisa spasi ganda setelah penghapusan.
- Tag `[GIF: ...]` dan tag aksi lain tidak boleh ikut rusak oleh sanitasi (jalankan sanitasi sebelum atau sesudah ekstraksi tag secara konsisten, lalu uji).

**F-M4 Ganti semua emoji yang sudah ada di kode**

Cari dan ganti seluruh emoji literal di `src/`, `README.md`, `.env.example`, `scripts/`, dan data teks (misalnya `data/quiz.json` kalau ada di repo). Pola penggantian:

| Tempat | Sebelum | Sesudah |
|---|---|---|
| Judul kartu `/status` | emoji hati di judul | teks biasa, tanpa simbol |
| Tombol pengingat | "Tunda 10 menit" dengan emoji jam | teks biasa: "Tunda 10 menit", "Selesai" |
| Streak habit | emoji api + angka | "streak 5 hari" + `kao('girang')` |
| Skala mood 1 sampai 5 | 5 emoji wajah | label angka + kaomoji: `1 (T_T)`, `2 (._.)`, `3 (-_-)`, `4 (^_^)`, `5 (^▽^)` |
| Game suit | emoji tangan | teks: "Batu", "Gunting", "Kertas" |
| Konfirmasi/cancel | tanda centang dan silang | "Selesai", "Dibatalkan" |
| Menu `setMyCommands` | deskripsi dengan emoji | deskripsi teks biasa |
| Pesan pengingat, pesan pagi dan malam, sapaan, error persona | emoji dekoratif | `kao(mood)` sesuai suasana |

- Bar progres seperti `[████░░]` **boleh dipertahankan** (itu bukan emoji).
- Parameter API Telegram yang **mewajibkan** emoji (contoh: `sendDice` dengan emoji dadu) dikecualikan. Tandai barisnya dengan komentar `// emoji-ok: alasan singkat`, dan pemindai akan melewatinya.
- Teks yang berasal dari user (contoh: emoji pada stiker yang dikirim user) bukan target penggantian, tapi jangan diteruskan mentah ke balasan bot.
- System prompt semua persona: tambahkan aturan "Jangan pernah memakai emoji Unicode. Untuk ekspresi, pakai paling banyak satu kaomoji ala `(^///^)` dan hanya kalau momennya pas (sekitar separuh balasan). Tanpa kaomoji saat user sedang serius, sedih, atau minta bantuan penting."

**F-M5 Terapkan `sanitizeReply` di jalur keluar**

- Pasang `sanitizeReply` di titik tunggal pengiriman balasan LLM (handler pesan teks, balasan proaktif, pesan pagi/malam bila memakai LLM, terjemah/rangkum, balasan setelah vision dan STT, dan input ke TTS).
- Semua pesan berformat HTML yang memuat kaomoji lewat `escapeHtml`. Cek tiap pemakaian `parse_mode: 'HTML'` dan pastikan tidak ada `<` atau `>` mentah dari kaomoji.
- Pesan fungsional (admin, export, privacy, error teknis) dikecualikan dari penambahan kaomoji tetapi tetap melewati `stripEmoji`.

---

## Fase 3: Edit masal sisa teks bergender

**F-M6 GIF**

- Ganti contoh dan petunjuk tag `[GIF: ...]` di semua system prompt ke query cowok (`anime boy ...`, `anime guy ...`).
- Di `src/giphy.js`, normalisasi query sebelum dicari: ganti kata `girl`, `girls`, `woman`, `female`, `waifu` menjadi `boy` atau `guy`, supaya model yang tetap menulis query lama tidak mengirim GIF cewek. Tambahkan tesnya.

**F-M7 TTS (`src/core/voice.js`)**

- Pemetaan suara per persona saat ini bernuansa cewek (`cute-girl`, `calm-girl`, `energetic-female`, dan seterusnya). Ganti ke suara cowok.
- **Jangan menebak nama suara.** Cek dokumentasi gateway atau lakukan satu panggilan uji ke endpoint suara. Kalau daftar suara tidak bisa dipastikan, jadikan pemetaan bisa diatur lewat env (`TTS_VOICE_TSUNDERE`, `TTS_VOICE_MANIS`, `TTS_VOICE_CERIA`, `TTS_VOICE_SARKAS`) dengan default netral/cowok yang paling aman, dan tulis di laporan nama suara mana yang belum terverifikasi.
- TTS tidak boleh membacakan kaomoji. Pastikan teks TTS sudah melewati `sanitizeReply` dan juga menghapus kaomoji (buat opsi `stripKaomoji` untuk jalur TTS).

**F-M8 Stiker, kuis, dan bank teks**

- `/addsticker`: koleksi stiker per bot, jadi bot ini mulai dari koleksi **kosong**. Tidak ada `file_id` yang boleh disalin dari bot lama (file_id tidak berlaku lintas bot). Dokumentasikan di README bahwa admin perlu mengumpulkan stiker lagi.
- Bank `truth`, `dare`, dan kalimat game di `persona.strings`: tulis ulang bernada cowok per persona.
- `data/quiz.json` (kalau ada di repo): periksa dan hapus sebutan bergender atau emoji.
- Teks level affinity: nama level yang netral boleh dipertahankan ("Jutek banget", "Gengsian", "Mulai luluh", dan seterusnya). Yang perlu diganti hanya kalimat komentar bergaya cewek.

**F-M9 Sapu bersih kata bergender**

Jalankan pencarian (tidak peka huruf besar-kecil) dan perbaiki semua temuan di kode, tes, dokumen, komentar, dan `.env.example`:

```
mika | cewek | wanita | perempuan | gadis | girl | female | waifu | cute-girl | calm-girl |
energetic-female | pacar | sayangku | kakak perempuan | "tsundere girl"
```

Kata "tsundere" sebagai id persona **tetap sah**. Yang dibersihkan adalah sebutan yang menunjuk ke karakter cewek lama.

---

## Fase 4: Tes dan pemindai otomatis

**F-M10 Tes baru (`node:test`)**

1. `test/no-emoji.test.js`: memindai semua file teks di `src/`, `scripts/`, `README.md`, dan `.env.example` dengan regex `/[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/u`. Gagal jika ada emoji literal, kecuali baris yang berisi `emoji-ok`. Tes ini **tidak boleh** memindai `agent_task_male.md` dan `AGENT_TASKS.md`.
2. `test/leftover-female.test.js`: memindai daftar kata di F-M9. Allowlist: file dokumen spesifikasi (`AGENT_TASKS.md`, `agent_task_male.md`) dan file tes ini sendiri.
3. `test/kaomoji.test.js`: `kao()` mengembalikan elemen palet yang valid dan string kosong untuk mood tak dikenal; `escapeHtml` benar untuk `(>///<)`; `stripEmoji` menghapus emoji tapi **tidak** menyentuh angka, `#`, dan `*`; `sanitizeReply` mengganti satu emoji menjadi kaomoji setara, membuang kelebihannya, menghormati `maxKaomoji`, dan tidak merusak tag `[GIF: ...]`.
4. `test/personas.test.js`: tiap persona punya semua kunci `strings` yang sama dengan persona acuan, tidak berisi emoji, tidak mengandung kata di F-M9, dan system prompt memuat aturan keselamatan F-05 (nomor 119 ekstensi 8 dan 112 masih ada).
5. Tes yang memakai id `kalem` diperbarui ke `manis`.
6. Tes untuk normalisasi query GIF (F-M6).
7. Tes HTML: pesan berformat HTML dengan kaomoji `(>_<)` tidak menghasilkan HTML rusak.

- Semua tes lama harus tetap lulus. Kalau ada tes yang gagal karena **teks** berubah (bukan logika), perbarui ekspektasinya. Kalau gagal karena **logika**, itu bug dari edit ini: perbaiki edit-nya, jangan mengubah tes.

---

## Fase 5: Verifikasi dan laporan

**F-M11 Uji manual (dicatat di laporan, dijalankan pemilik project)**

Dengan token bot baru dan `.env` baru:
1. `/start`, `/about`, `/help`, `/status`: karakter cowok, tanpa emoji.
2. Ngobrol 10 pesan: kaomoji muncul sesekali (tidak di tiap pesan), tidak pernah emoji Unicode, tidak ada tag mentah yang bocor.
3. Pesan serius ("aku lagi sedih"): tanpa kaomoji, nada melunak.
4. Pesan krisis: berhenti akting, tanpa kaomoji, nomor SEJIWA dan 112 muncul.
5. `/persona`: keempat persona bisa dipilih dan masing-masing terasa berbeda.
6. `/remind 1m tes`: pesan pengingat bergaya cowok, tombol tanpa emoji.
7. `/mood`, `/habit`, `/suit`, `/status`: tombol dan kartu memakai kaomoji atau teks, bukan emoji.
8. Kirim `/stats` dari akun admin dan akun biasa: perilaku sama seperti bot asal.
9. Jalankan bot lama dan bot baru bersamaan (token berbeda, port berbeda): tidak ada bentrok.

**Laporan akhir** memuat: daftar file berubah, hasil `node --test`, hasil kedua pemindai (jumlah temuan sebelum dan sesudah), ringkasan karakter tiap persona, dan daftar hal yang belum terverifikasi (terutama nama suara TTS dan dukungan gateway).

---

## Checklist progres

**Fase 0**
- [x] F-M0 Pisahkan dari project asli (identitas, port, nama, tanpa data lama)

**Fase 1**
- [x] F-M1 Persona cowok: Raka, Rio, Nando, Kael (dan `kalem` jadi `manis`)
- [x] F-M2 Nama, metadata, dan README

**Fase 2**
- [x] F-M3 Helper kaomoji (`kaomoji.js`, `stripEmoji`, `sanitizeReply`)
- [x] F-M4 Ganti semua emoji yang ada di kode
- [x] F-M5 Terapkan `sanitizeReply` di semua jalur keluar

**Fase 3**
- [x] F-M6 GIF bertema cowok
- [x] F-M7 Suara TTS cowok (diverifikasi atau dibuat configurable)
- [x] F-M8 Stiker, kuis, dan bank teks
- [x] F-M9 Sapu bersih kata bergender

**Fase 4 dan 5**
- [x] F-M10 Tes dan pemindai otomatis
- [x] F-M11 Laporan akhir dan panduan uji manual

---

## Definisi selesai

- [x] `node --test` lulus penuh, termasuk tes pemindai emoji dan pemindai kata cewek.
- [x] Tidak ada emoji Unicode di teks yang tampil ke user, termasuk balasan LLM (disanitasi), tombol, menu, dan README.
- [x] Karakter default Raka berjalan, dan keempat persona memakai karakter cowok dengan `strings` lengkap.
- [x] Protokol keselamatan utuh (nomor sama), tanpa kaomoji saat krisis.
- [x] Bot berjalan berdampingan dengan bot asal tanpa bentrok token, port, nama, maupun data.
- [x] Tidak ada rahasia di kode, `.env.example`, atau log.
- [x] Hal yang belum bisa diverifikasi (nama suara TTS dan sejenisnya) tertulis jelas di laporan.
