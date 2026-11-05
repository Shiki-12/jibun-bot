import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KAOMOJI,
  EMOJI_REGEX,
  kao,
  escapeHtml,
  stripEmoji,
  hasKaomoji,
  stripKaomoji,
  sanitizeReply,
} from '../src/core/kaomoji.js';

test('F-M10: Kaomoji Helper Suite (test/kaomoji.test.js)', async (t) => {
  await t.test('kao() mengembalikan kaomoji non-empty valid per kategori', () => {
    const categories = Object.keys(KAOMOJI);
    assert.ok(categories.length >= 8);

    for (const cat of categories) {
      const val = kao(cat);
      assert.ok(typeof val === 'string');
      assert.ok(val.length > 0);
      assert.ok(KAOMOJI[cat].includes(val));
    }

    assert.equal(kao('unknown_mood_xyz'), '');
    assert.equal(kao(null), '');
    assert.equal(kao(undefined), '');
  });

  await t.test('escapeHtml() mengubah karakter HTML khusus (<, >, &)', () => {
    assert.equal(escapeHtml('<script>alert("xss & fun")</script>'), '&lt;script&gt;alert("xss &amp; fun")&lt;/script&gt;');
    assert.equal(escapeHtml('Normal text 123'), 'Normal text 123');
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
  });

  await t.test('stripEmoji() menghapus unicode emoji tanpa merusak teks biasa / angka / simbol', () => {
    const raw = 'Halo! 😊👋 Apa kabar di 2026? #1 *bold* [tag: 123]';
    const cleaned = stripEmoji(raw);
    assert.equal(cleaned, 'Halo!  Apa kabar di 2026? #1 *bold* [tag: 123]');

    const numbersAndPunctuation = '1. Opsi #test *star* 100%';
    assert.equal(stripEmoji(numbersAndPunctuation), numbersAndPunctuation);

    // Kaomoji tidak boleh terhapus oleh stripEmoji
    const withKao = 'Iya deh (¬_¬)';
    assert.equal(stripEmoji(withKao), withKao);
  });

  await t.test('hasKaomoji() mendeteksi kaomoji dari palet secara tepat', () => {
    assert.equal(hasKaomoji('Halo (^_^) selamat pagi'), true);
    assert.equal(hasKaomoji('Apaan sih (¬_¬)'), true);
    assert.equal(hasKaomoji('Sedih banget (T_T)'), true);
    assert.equal(hasKaomoji('Teks biasa tanpa kaomoji'), false);
    assert.equal(hasKaomoji('Hanya kurung (biasa) saja'), false);
    assert.equal(hasKaomoji(''), false);
    assert.equal(hasKaomoji(null), false);
  });

  await t.test('stripKaomoji() menghapus kaomoji untuk jalur audio/TTS', () => {
    const textWithKao = 'Selamat pagi semuanya! (^_^) Semangat ya! (¬_¬)';
    const clean = stripKaomoji(textWithKao);
    assert.equal(clean, 'Selamat pagi semuanya! Semangat ya!');

    assert.equal(stripKaomoji('Teks tanpa kaomoji'), 'Teks tanpa kaomoji');
    assert.equal(stripKaomoji(''), '');
    assert.equal(stripKaomoji(null), '');
  });

  await t.test('sanitizeReply() mengonversi emoji, melindungi tag, dan membatasi kaomoji', () => {
    // 1. Emoji yang dikenal dikonversi ke kaomoji jika belum punya kaomoji
    const res1 = sanitizeReply('Selamat pagi! 😊');
    assert.ok(hasKaomoji(res1));
    assert.ok(!EMOJI_REGEX.test(res1));

    // 2. Jika sudah punya kaomoji, emoji dihapus tanpa menambah kaomoji baru
    const res2 = sanitizeReply('Sudah ada kaomoji (¬_¬) jangan tambah lagi 😂');
    assert.ok(!res2.includes('😂'));
    assert.ok(res2.includes('(¬_¬)'));

    // 3. Tag aksi dilindungi dan tidak rusak
    const res3 = sanitizeReply('Halo! [GIF: wave_boy] Apa kabar? 😊');
    assert.ok(res3.includes('[GIF: wave_boy]'));
    assert.ok(!EMOJI_REGEX.test(res3));

    // 4. Pembatasan maxKaomoji
    const multipleKao = 'Satu (^_^) dua (¬_¬) tiga (T_T)';
    const limited = sanitizeReply(multipleKao, { maxKaomoji: 1 });
    assert.equal(limited, 'Satu (^_^) dua tiga');

    // 5. Mode stripKaomoji untuk TTS
    const forTts = sanitizeReply('Halo dunia! 😊 (^_^) [GIF: boy]', { stripKaomoji: true });
    assert.equal(forTts, 'Halo dunia! [GIF: boy]');
  });
});

