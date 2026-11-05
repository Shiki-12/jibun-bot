# Telegram AI Bot (Male Persona Edition)

Bot Telegram berbasis AI dengan karakter pria (male persona), memori percakapan persisten, integrasi GIF anime boy, dan ekspresi emosi menggunakan kaomoji murni tanpa emoji Unicode.

Persona bawaan default: **Raka**, cowok tsundere.

---

## Zero Unicode Emoji & Kaomoji Policy

Bot ini menerapkan kebijakan **Zero Unicode Emoji**:
- **Ekspresi Kaomoji:** Semua ekspresi karakter dan emosi disampaikan menggunakan kaomoji ala Jepang seperti `(^///^)`, `(¬_¬)`, `(^_^)`, `(T_T)`, `(ง •̀_•́)ง`.
- **Bebas Simbol Emoji:** Seluruh pesan, tombol inline keyboard, template sistem, ringkasan jadwal, dan log tidak memuat karakter Unicode emoji.
- **Indikator Teks Bersih:** Status tombol atau daftar menggunakan format teks dan kurung siku, misalnya `[x] Selesai`, `[ ] Belum`, `[Sholat]`, `[Timer]`, `[Pomodoro]`, `[Batu]`.
- **Egress Sanitization:** Balasan dari model LLM secara otomatis disaring oleh sanitasi egress (`sanitizeReply`) untuk mengonversi emoji menjadi kaomoji atau menghapus emoji liar sebelum dikirim ke pengguna Telegram maupun generator suara (TTS).

---

## Fitur Utama

- **Male Personas:** 4 kepribadian pria bawaan (Raka/tsundere, Rio/manis, Nando/ceria, Kael/sarkas) serta dukungan persona kustom (`/persona custom <deskripsi>`).
- **LLM Gateway:** Kompatibel dengan API format OpenAI (`/chat/completions`), mendukung pergantian base URL dan model melalui `.env` dengan mekanisme retry dan fallback model cadangan.
- **Memori Percakapan SQLite:** Disimpan di SQLite lokal (`data/bot.db`) dengan mode WAL (*Write-Ahead Logging*).
- **Koleksi GIF Anime Boy:** AI menyisipkan tag `[GIF: kata kunci]` dan bot otomatis mencarikan animasi bertema anime boy via Giphy API.
- **Protokol Action Tags:** Ekstraksi tag aksi modular `[NAMA: arg1 | arg2]` dengan validasi parameter serta injeksi waktu dan konteks pengguna.
- **Penjaga & Keamanan:** Whitelist ID (`ALLOWED_USER_IDS`), akses admin (`ADMIN_IDS`), rate limiter per menit, batas panjang pesan, dan filter pesan basi.
- **Privasi Grup:** Di grup, bot hanya merespons jika di-mention atau pesannya dibalas (reply).
- **Perintah Dasar:** `/start`, `/help` (daftar perintah otomatis), `/forget` (hapus riwayat), `/about` (informasi bot dan persona aktif).
- **Pengaturan Lengkap:** `/settings` (menu inline zona waktu, frekuensi GIF, persona), `/timezone <nama_iana>`.
- **Pengingat (Reminders):** `/remind <waktu> <teks>` (relatif, jam, tanggal, interval berulang), `/reminders` (daftar aktif dengan tombol batal `[Batal]`), `/cancel <id>`, tombol inline tunda (10m/1j) dan selesai.
- **To-Do List:** `/todo <teks>` (opsional `@waktu` terhubung ke pengingat), `/list` (daftar aktif dengan tombol `[v]` dan `[Hapus]`), `/done <nomor>`, `/deltodo <nomor>`.
- **Catatan (Notes):** `/note <teks>` (hashtag otomatis), `/note <id>`, `/notes` (paginasi 10 item), `/delnote <id>`, `/findnote <kata>`.
- **Pesan Terjadwal:** `/morning <HH:mm>` (sapaan pagi, agenda to-do & ringkasan cuaca), `/night <HH:mm>` (evaluasi to-do malam & check-in mood), `/schedules`.
- **Memori Jangka Panjang & Fakta:** Ekstraksi fakta profil otomatis, peringkasan riwayat panjang, `/memory`, `/delfact <id>`, `/clearfacts`.
- **Sistem Affinity (Level Dere):** Level kedekatan bertahap (0-4), batas poin harian anti-farming, peluruhan lembut, kartu status `/status`.
- **Stiker Telegram:** Pengelolaan stiker reaksi oleh admin (`/addsticker <mood>`), `/stickers`, `/delsticker <id>`, dan respons otomatis terhadap stiker pengguna.
- **Chat Proaktif:** Sapaan otomatis saat pengguna lama tidak aktif (opt-in `/proactive on|off`), evaluasi jam tenang (`/quiet`), batas 1x/hari.
- **Game & Hiburan:** `/suit` (batu-gunting-kertas), `/tebak` (angka 1-100), `/quiz` (trivia), `/truth`, `/dare`, `/pilih` (opsi acak), `/dadu`, `/koin`, papan peringkat `/skor`.
- **Mood Jurnal:** Skala suasana hati 1-5 dan catatan harian (`/mood`), rekapitulasi grafik 7 hari (`/moodweek`), dan perlindungan krisis darurat.
- **Baca Gambar (Vision):** Analisis dan komentar foto multimodal OpenAI (`LLM_VISION_MODEL`) hingga 20 MB, perintah `/vision`.
- **Pesan Suara & TTS:** Generator balasan audio `.mp3` via endpoint TTS gateway (`/voice on|off`) dengan suara vokal pria per persona (`male-young`, `male-calm`, `male-energetic`), batas voice note 60 detik.
- **Cuaca & Kota Domisili:** Prakiraan cuaca via Open-Meteo (`/cuaca [kota]`), simpan domisili default (`/kota <nama>`), saran cuaca khas karakter, integrasi sapaan pagi.
- **Jadwal Sholat & Adzan:** Jadwal sholat resmi Kemenag RI via Aladhan API (`/sholat [kota]`), pengingat adzan otomatis (`/adzan on [menit]`, `/adzan off`), penyampaian hormat netral.
- **Kurs, Kalkulator & Konversi:** Kurs mata uang real-time (`/kurs`), kalkulator aritmetika aman tanpa eval (`/hitung`), konversi satuan panjang/berat/volume/suhu (`/konversi`).
- **Timer & Pomodoro:** Timer hitung mundur sekali jalan (`/timer <durasi> [nama]`, `/canceltimer <id>`), sesi Pomodoro kerja/istirahat bertahap (`/pomodoro [work] [break] [cycles]`, `/stop`).
- **Habit Tracker & Streak:** Pelacak kebiasaan harian (`/habit add <nama> [jam]`, `/habit done <id>`, `/habits`), perhitungan streak harian, pengingat dengan tombol `[Sudah]` dan `[Lewat]`.
- **Pencatatan Keuangan:** Catat pengeluaran harian (`/catat <nominal> <keterangan>`) dengan parser nominal fleksibel (`25k`, `1.5jt`), klasifikasi kategori otomatis, rekap periode (`/rekap`), ekspor CSV (`/exportcsv`).
- **Terjemah & Rangkum:** Terjemahan multi-bahasa (`/terjemah <bahasa> <teks>`), perangkuman teks panjang (`/rangkum <teks>`), proteksi keamanan tautan URL (SSRF).
- **Fitur Grup:** Persona tersendiri per grup, perangkuman obrolan grup `/rangkum_grup [jumlah]` berbasis buffer 200 pesan, mode nimbrung otomatis `/chatty on|off`, sambutan anggota baru `/welcome on|off`.
- **Operasional Admin:** Perintah khusus `ADMIN_IDS` untuk pantau statistik (`/stats`), blokir user (`/ban`, `/unban`), broadcast pesan terproteksi (`/broadcast`), ubah model dinamis (`/model`), dan mode pemeliharaan (`/maintenance`).
- **Privasi & Ekspor Data:** Hak privasi penuh sesuai standar perlindungan data; unduh seluruh data format JSON (`/export`), hapus seluruh data permanen via konfirmasi dua langkah (`/deleteme`), dan transparansi `/privacy`.
- **Deployment Produksi:** Dockerfile & docker-compose.yml (port 3001), konfigurasi PM2, endpoint pemantauan `/health` (port 3001), mode webhook opsional, dan pencadangan database online (`npm run backup`).

---

## Panduan Instalasi & Menjalankan

### Persyaratan Sistem
- Node.js versi 20 atau lebih baru (direkomendasikan Node.js 22 LTS).
- Akun Telegram untuk membuat bot via [@BotFather](https://t.me/BotFather).
- API Key OpenAI atau penyedia LLM gateway yang kompatibel.

### Langkah Setup

```bash
# 1. Clone repository
git clone https://github.com/username/telegram-ai-bot-male.git
cd telegram-ai-bot-male

# 2. Pasang dependensi
npm install

# 3. Konfigurasi file environment
cp .env.example .env
# Edit file .env dan sesuaikan BOT_TOKEN, LLM_API_KEY, dll.

# 4. Jalankan bot
npm start
```

Untuk mode pengembangan dengan auto-reload:
```bash
npm run dev
```

Untuk menjalankan seluruh test suite otomatis:
```bash
npm test
```

---

## Daftar Persona Pria (Male Personas)

Ganti kepribadian aktif menggunakan perintah `/persona <nama>` atau buka menu interaktif dengan `/persona`:

1. **Raka (`tsundere`) - Default**
   - Karakter cowok tsundere yang luarnya dingin, jutek, dan suka gengsi ("B-bukan berarti aku peduli ya!"), namun diam-diam sangat perhatian dan mudah tersipu/salting jika dipuji.
   - Kaomoji khas: `(¬_¬)`, `(^///^)`, `( `_´ )`.
   - Suara TTS default: `male-young`.

2. **Rio (`manis`)**
   - Karakter pria muda yang hangat, sopan, sabar, penuh perhatian, dan menenangkan. Selalu menghargai perasaan pengguna dan memberikan dorongan semangat positif.
   - Kaomoji khas: `(^_^)`, `(o^ ^o)`, `(^-^)`.
   - Suara TTS default: `male-calm`.

3. **Nando (`ceria`)**
   - Karakter cowok energik, humoris, optimis, dan ekspresif. Menyukai petualangan dan hal seru, selalu siap menyemangati hari pengguna dengan penuh antusias.
   - Kaomoji khas: `(^▽^)`, `(ง •̀_•́)ง`, `(^_^)/`.
   - Suara TTS default: `male-energetic`.

4. **Kael (`sarkas`)**
   - Karakter pria santai berdarah dingin (deadpan), sarkastik cerdas, ironis, dan blak-blakan namun tetap kompeten, objektif, dan logis tanpa merendahkan atau toxic.
   - Kaomoji khas: `(-_-)`, `(=_=)`.
   - Suara TTS default: `male-calm`.

5. **Jiang Cheng (`jiang_cheng`) — Exclusive Personality (Mo Dao Zu Shi)**
   - Pemimpin dewasa Klan Jiang dari Yunmeng yang bermukim di Lotus Pier, terinspirasi dari novel asli karya Mo Xiang Tong Xiu.
   - **Karakter Berbahasa Inggris (English-Only Persona):** Berbicara sepenuhnya dalam bahasa Inggris yang alami, lugas, dan berwibawa, bahkan jika pengguna mengirim pesan dalam bahasa Indonesia atau multibahasa.
   - Karakterisasi: Bangga, tegas, berwibawa, kompetitif, dan protektif. Kepedulian ditunjukkan melalui tindakan nyata, pengingat keselamatan, dan teguran praktis—bukan melalui gombalan, rengekan, atau klise tsundere romcom (bebas dari gagap "B-bukan berarti aku peduli ya", blush, dan kata "baka").
   - Kaomoji default: nol (tanpa emotikon anak-anak).
   - Titik cerita default: Dafan Mountain (awal alur masa kini), dengan batas spoiler ketat (tidak membocorkan rahasia golden core atau akhir novel).
   - Suara TTS default: `male-calm` (dapat di-override via `TTS_VOICE_JIANG_CHENG`).
   - Sistem Affinity & Memori Terisolasi: Poin kedekatan dan riwayat percakapan Jiang Cheng tersimpan secara terpisah dalam basis data sehingga tidak saling mencemari konteks dengan persona lain.
   - *Catatan Kurasi:* Kategori "Exclusive Personalities" merupakan klasifikasi kurasi karakter fiksi berkualitas tinggi, **bukan fitur berbayar atau paywall**. Karakter ini bersifat fan-inspired tidak resmi.

6. **Persona Kustom (`custom`)**
   - Pengguna dapat merancang persona cowok sendiri melalui perintah:
     `/persona custom <deskripsi>`
     Contoh: `/persona custom Detektif muda cerdas era Victorian yang gemar menganalisis teka-teki logika.`

> [!IMPORTANT]
> **Aturan Keselamatan Krisis & Batasan Medis (F-05):**
> Seluruh persona (termasuk persona custom) terikat aturan keselamatan absolut yang tidak dapat dinonaktifkan:
> - Jika pengguna mengindikasikan krisis mental berat atau keinginan menyakiti diri, seluruh akting karakter segera berhenti dan bot memberikan informasi bantuan darurat resmi:
>   * Hotline SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)
>   * Halo Kemenkes: 1500-567
>   * Layanan Darurat Nasional: 112
> - Bot tidak pernah memberikan diagnosis medis klinis maupun saran dosis obat keras.

---

## Konfigurasi Variabel Lingkungan (.env)

| Variabel | Keterangan | Nilai Bawaan / Contoh |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Token autentikasi bot Telegram dari BotFather | Wajib diisi |
| `LLM_API_KEY` | Kunci akses API LLM | Wajib diisi |
| `LLM_BASE_URL` | Base URL endpoint kompatibel OpenAI | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Model LLM utama | `llama-3.3-70b-versatile` |
| `PERSONALITY` | Persona default saat bot pertama kali dijalankan | `tsundere` |
| `PORT` | Port server HTTP health check & webhook | `3001` |
| `MAX_KAOMOJI_PER_REPLY`| Batas maksimal kaomoji dalam satu pesan balasan | `1` |
| `TTS_VOICE_DEFAULT` | Karakter suara vokal TTS default | `male-young` |
| `TTS_VOICE_TSUNDERE`| Suara vokal TTS persona Raka (tsundere) | `male-young` |
| `TTS_VOICE_MANIS` | Suara vokal TTS persona Rio (manis) | `male-calm` |
| `TTS_VOICE_CERIA` | Suara vokal TTS persona Nando (ceria) | `male-energetic` |
| `TTS_VOICE_SARKAS` | Suara vokal TTS persona Kael (sarkas) | `male-calm` |
| `TTS_VOICE_JIANG_CHENG` | Suara vokal TTS persona Jiang Cheng (exclusive) | `male-calm` |
| `TTS_VOICE_CUSTOM` | Suara vokal TTS persona custom | `normal-male` |
| `FEATURES` | Daftar modul fitur aktif | `all` |
| `ADMIN_IDS` | ID Telegram angka pengelola bot (dipisahkan koma) | `12345678,98765432` |

---

## Contoh Interaksi Bot

### 1. Percakapan Kasual (Persona: Raka / Tsundere)
```
User: Halo Raka, lagi ngapain?
Raka: Hmph, tumben nyapa. Aku lagi nggak ngapa-ngapain sih. Ada apa? Bukan berarti aku nungguin chat kamu ya! (¬_¬)
```

```
User: Kamu keren banget deh hari ini!
Raka: H-hah?! Jangan ngomong aneh-aneh sembarangan, bodoh! Bikin salting aja... (^///^)
[GIF: anime boy blush]
```

### 2. Pengingat Jadwal (/remind)
```
User: /remind 15m angkat jemuran
Bot:  Pengingat berhasil dipasang untuk 15 menit lagi: "angkat jemuran". Jangan sampai lupa ya! (¬_¬)
```
*(Saat waktu pengingat tiba)*
```
Bot:  Hei, waktunya: angkat jemuran. Awas kalau sampai lupa dan kehujanan! (¬_¬)
      [Tunda 10m]  [Tunda 1j]  [Selesai]
```

### 3. Jadwal Sholat & Adzan (/sholat, /adzan)
```
User: /sholat Jakarta
Bot:  *Jadwal Sholat untuk Jakarta*
      *05 Nov 2026* (25 Jumada al-ula 1448 H)

      * Imsak:   `03:55` WIB
      * Subuh:   `04:05` WIB
      * Terbit:  `05:26` WIB
      * Dzuhur:  `11:36` WIB
      * Ashar:   `14:55` WIB
      * Maghrib: `17:47` WIB
      * Isya:    `18:59` WIB

      _Metode: Kemenag RI (Kementerian Agama Republik Indonesia)_
```
*(Notifikasi adzan otomatis ketika aktif)*
```
Bot:  [Sholat] Pengingat Sholat: 10 menit lagi masuk waktu Dzuhur (11:36 WIB) untuk wilayah Jakarta dan sekitarnya.
```

### 4. Permainan Suit Interaktif (/suit)
```
User: /suit
Bot:  Ayo main suit! Pilih batu, gunting, atau kertas:
      [Batu]  [Gunting]  [Kertas]
```
*(Setelah memilih tombol)*
```
Bot:  *Hasil Suit*

      * Kamu: Batu
      * Bot: Gunting

      Cih, kamu menang kebetulan doang kan?! (+3 poin) (¬_¬)
      [Main Lagi]
```

### 5. Percakapan Karakter: Jiang Cheng (Exclusive - English Only)
```
User: Halo, siapa kamu?
Jiang Cheng: Jiang Cheng. Leader of the Yunmeng Jiang Clan. Now, what is it you need?
```
```
User: Kamu hebat banget!
Jiang Cheng: That praise is far too generous. ...Still, thank you.
```
```
User: Aku mau begadang padahal besok harus ujian.
Jiang Cheng: If tomorrow is important, why are you throwing away your rest? Finish what is essential, then go to sleep.
```
```
User: Aku sedih.
Jiang Cheng: What happened? You don't have to explain everything at once. I'm listening.
```
```
User: Kok kamu galak sih?
Jiang Cheng: Being firm is not the same as being hostile. If something is bothering you, say it plainly.
```

---

## Deployment ke Server VPS

### Menggunakan Docker Compose (Port 3001)

File `docker-compose.yml` telah dikonfigurasi dengan container name `telegram-ai-bot-male` pada port `3001`:

```bash
# Build dan jalankan container
docker compose up -d --build

# Periksa status log kontainer
docker compose logs -f bot-male
```

### Menggunakan PM2

```bash
# Install PM2 dan jalankan
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Health Check

Periksa status kesiapan bot pada port 3001:
```bash
curl http://localhost:3001/health
```
Respon JSON:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-11-05T12:00:00.000Z",
  "model": "llama-3.3-70b-versatile",
  "maintenance": false
}
```

---

## Lisensi

Didistribusikan di bawah lisensi MIT. Bebas digunakan dan dimodifikasi untuk kebutuhan pengembangan bot personal maupun komunitas.
