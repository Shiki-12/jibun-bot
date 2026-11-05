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

// Pola regex untuk mendeteksi emoji Unicode tanpa mendeteksi angka 0-9, #, *
export const EMOJI_REGEX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;

// Pemetaan emoji umum ke mood kaomoji menggunakan escape \u{...}
const EMOJI_MOOD_MAP = new Map([
  // Malu
  ['\u{1F633}', 'malu'], // flushed face
  ['\u{1F648}', 'malu'], // see-no-evil monkey
  ['\u{1F970}', 'malu'], // smiling face with hearts
  ['\u{1F61C}', 'malu'], // winking face with tongue
  ['\u{1F92D}', 'malu'], // face with hand over mouth

  // Senang
  ['\u{1F60A}', 'senang'], // smiling face with smiling eyes
  ['\u{1F603}', 'senang'], // grinning face with big eyes
  ['\u{1F604}', 'senang'], // grinning face with smiling eyes
  ['\u{1F642}', 'senang'], // slightly smiling face
  ['\u{1F609}', 'senang'], // winking face
  ['\u{263A}', 'senang'],  // smiling face

  // Girang
  ['\u{1F600}', 'girang'], // grinning face
  ['\u{1F601}', 'girang'], // beaming face
  ['\u{1F602}', 'girang'], // face with tears of joy
  ['\u{1F606}', 'girang'], // squinting face
  ['\u{1F973}', 'girang'], // partying face
  ['\u{1F389}', 'girang'], // party popper
  ['\u{1F525}', 'girang'], // fire
  ['\u{1F388}', 'girang'], // balloon

  // Kesal
  ['\u{1F624}', 'kesal'], // face with steam from nose
  ['\u{1F620}', 'kesal'], // angry face
  ['\u{1F621}', 'kesal'], // pouting face / enraged
  ['\u{1F644}', 'kesal'], // face with rolling eyes
  ['\u{1F92C}', 'kesal'], // face with symbols on mouth
  ['\u{1F928}', 'kesal'], // face with raised eyebrow
  ['\u{1F4A2}', 'kesal'], // anger symbol

  // Sedih
  ['\u{1F622}', 'sedih'], // crying face
  ['\u{1F62D}', 'sedih'], // loudly crying face
  ['\u{1F614}', 'sedih'], // pensive face
  ['\u{1F61E}', 'sedih'], // disappointed face
  ['\u{1F97A}', 'sedih'], // pleading face
  ['\u{1F625}', 'sedih'], // sad but relieved
  ['\u{1F613}', 'sedih'], // downcast face with sweat
  ['\u{1F494}', 'sedih'], // broken heart

  // Bingung
  ['\u{1F914}', 'bingung'], // thinking face
  ['\u{1F9D0}', 'bingung'], // face with monocle
  ['\u{1F615}', 'bingung'], // confused face
  ['\u{1F92F}', 'bingung'], // exploding head

  // Bosan
  ['\u{1F611}', 'bosan'], // expressionless face
  ['\u{1F610}', 'bosan'], // neutral face
  ['\u{1F629}', 'bosan'], // weary face
  ['\u{1F62A}', 'bosan'], // sleepy face
  ['\u{1F634}', 'bosan'], // sleeping face

  // Kaget
  ['\u{1F632}', 'kaget'], // astonished face
  ['\u{1F62E}', 'kaget'], // face with open mouth
  ['\u{1F628}', 'kaget'], // fearful face
  ['\u{1F631}', 'kaget'], // face screaming in fear
  ['\u{1F635}', 'kaget'], // dizzy face

  // Lembut
  ['\u{2615}', 'lembut'], // hot beverage
  ['\u{1F33F}', 'lembut'], // herb
]);

// Semua kaomoji unik yang ada di palet KAOMOJI
const ALL_KNOWN_KAOMOJI = Array.from(
  new Set(Object.values(KAOMOJI).flat()),
);

// Regex untuk mendeteksi kaomoji dari palet
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Urutkan dari yang terpanjang ke terpendek agar matching akurat
const KAOMOJI_MATCH_REGEX = new RegExp(
  ALL_KNOWN_KAOMOJI.slice().sort((a, b) => b.length - a.length).map(escapeRegex).join('|'),
  'g',
);

/**
 * Ambil kaomoji acak dari palet mood.
 * Mengembalikan string kosong jika mood tidak dikenal.
 */
export function kao(mood, rng = Math.random) {
  const list = KAOMOJI[mood];
  if (!list || list.length === 0) return '';
  const idx = Math.floor(rng() * list.length);
  return list[idx] || list[0];
}

/**
 * Escape karakter HTML aman (&, <, >).
 */
export function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Hapus seluruh emoji Unicode tanpa merusak angka, tanda pagar (#), atau bintang (*).
 */
export function stripEmoji(text) {
  if (typeof text !== 'string') return '';
  return text.replace(EMOJI_REGEX, '');
}

/**
 * Cek apakah teks sudah mengandung kaomoji dari palet.
 */
export function hasKaomoji(text) {
  if (typeof text !== 'string') return false;
  return new RegExp(KAOMOJI_MATCH_REGEX.source, 'u').test(text);
}

/**
 * Hapus seluruh kaomoji dari teks (misalnya untuk jalur TTS).
 */
export function stripKaomoji(text) {
  if (typeof text !== 'string') return '';
  const cleaned = text.replace(new RegExp(KAOMOJI_MATCH_REGEX.source, 'g'), '');
  return cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

/**
 * Sanitasi balasan teks sebelum dikirim ke user atau ke TTS:
 * 1. Lindungi tag seperti [GIF: ...] atau tag aksi [TAG: ...]
 * 2. Jika teks belum punya kaomoji, ganti emoji pertama yang cocok dengan kaomoji setara.
 * 3. Hapus seluruh emoji Unicode lainnya.
 * 4. Batasi jumlah kaomoji per balasan sesuai maxKaomoji.
 * 5. Rapikan spasi ganda tanpa merusak baris baru.
 * 6. Jika stripKaomoji: true, hapus semua kaomoji.
 */
export function sanitizeReply(text, { maxKaomoji, stripKaomoji: shouldStripKaomoji = false } = {}) {
  if (typeof text !== 'string') return '';

  const maxKao = maxKaomoji !== undefined
    ? maxKaomoji
    : Number(process.env.MAX_KAOMOJI_PER_REPLY || 1);

  // 1. Ekstrak dan amankan tag seperti [GIF: ...] atau tag aksi [TAG: ...]
  const tags = [];
  let processed = text.replace(/\[[A-Z_]+(?::[^\]]*)?\]/g, (match) => {
    const placeholder = `__TAG_PLACEHOLDER_${tags.length}__`;
    tags.push(match);
    return placeholder;
  });

  // Jika diminta hapus kaomoji total (untuk TTS)
  if (shouldStripKaomoji) {
    processed = stripEmoji(processed);
    processed = stripKaomoji(processed);
    // Kembalikan tags
    tags.forEach((tag, i) => {
      processed = processed.replace(`__TAG_PLACEHOLDER_${i}__`, tag);
    });
    return processed.replace(/[ \t]+/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '').trim();
  }

  // 2. Cek apakah sudah ada kaomoji di teks
  const alreadyHasKaomoji = hasKaomoji(processed);

  // Cari emoji pertama yang punya mood padanan jika belum ada kaomoji
  let replacedFirstEmoji = false;
  if (!alreadyHasKaomoji) {
    // Cari kemunculan emoji pertama
    processed = processed.replace(EMOJI_REGEX, (match) => {
      if (!replacedFirstEmoji) {
        // Cek apakah ada mood untuk emoji ini
        const mood = EMOJI_MOOD_MAP.get(match);
        if (mood) {
          replacedFirstEmoji = true;
          return ` ${kao(mood)} `;
        }
      }
      return '';
    });
  }

  // Hapus semua sisa emoji Unicode
  processed = stripEmoji(processed);

  // 3. Batasi kaomoji maksimal maxKao
  let count = 0;
  processed = processed.replace(new RegExp(KAOMOJI_MATCH_REGEX.source, 'g'), (match) => {
    count++;
    if (count <= maxKao) {
      return match;
    }
    return ''; // buang kelebihan kaomoji
  });

  // 4. Kembalikan tags
  tags.forEach((tag, i) => {
    processed = processed.replace(`__TAG_PLACEHOLDER_${i}__`, tag);
  });

  // 5. Rapikan spasi ganda per baris tanpa merusak baris baru (\n)
  processed = processed
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return processed;
}

