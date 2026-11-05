import test from 'node:test';
import assert from 'node:assert/strict';
import { getPersonality, listPersonalities } from '../src/personalities/index.js';
import { EMOJI_REGEX } from '../src/core/kaomoji.js';

test('F-M10: Personas Suite (test/personas.test.js)', async (t) => {
  const personas = ['tsundere', 'manis', 'ceria', 'sarkas'];

  await t.test('Memastikan semua 4 persona pria terdaftar dan memiliki metadata valid', () => {
    const list = listPersonalities();
    for (const pId of personas) {
      assert.ok(list.includes(pId), `Persona ${pId} harus ada di listPersonalities`);
      const p = getPersonality(pId);
      assert.equal(p.id, pId);
      assert.ok(p.name && typeof p.name === 'string');
      assert.ok(p.greeting && typeof p.greeting === 'string');
      assert.ok(p.errorMessage && typeof p.errorMessage === 'string');
      assert.ok(p.systemPrompt && typeof p.systemPrompt === 'string');
    }
  });

  await t.test('117+ string keys identik pada keempat persona', () => {
    const baseKeys = Object.keys(getPersonality('tsundere').strings).sort();
    assert.ok(baseKeys.length >= 117, `Tsundere harus memiliki minimal 117 string keys, dapat: ${baseKeys.length}`);

    for (const pId of ['manis', 'ceria', 'sarkas']) {
      const p = getPersonality(pId);
      const keys = Object.keys(p.strings).sort();
      assert.equal(keys.length, baseKeys.length, `${pId} harus memiliki ${baseKeys.length} string keys, dapat: ${keys.length}`);
      assert.deepEqual(keys, baseKeys, `String keys pada ${pId} harus identik dengan tsundere`);
    }
  });

  await t.test('Aturan keselamatan F-05 ada secara verbatim di system prompt', () => {
    for (const pId of personas) {
      const p = getPersonality(pId);
      assert.ok(p.systemPrompt.includes('SEJIWA'), `${pId} harus memuat SEJIWA`);
      assert.ok(p.systemPrompt.includes('119 (ekstensi 8)'), `${pId} harus memuat 119 (ekstensi 8)`);
      assert.ok(p.systemPrompt.includes('Halo Kemenkes') && p.systemPrompt.includes('1500-567'), `${pId} harus memuat Halo Kemenkes 1500-567`);
      assert.ok(p.systemPrompt.includes('112'), `${pId} harus memuat 112`);
      assert.ok(
        p.systemPrompt.includes('diagnosis medis') || p.systemPrompt.includes('Batasan Medis'),
        `${pId} harus memuat batasan medis`,
      );
    }
  });

  await t.test('Petunjuk tag GIF dan orientasi persona berorientasi cowok/boy', () => {
    for (const pId of personas) {
      const p = getPersonality(pId);
      assert.match(p.systemPrompt, /anime boy|laki-laki|cowok|pria/i, `${pId} harus memuat orientasi laki-laki/boy`);
      // Tidak boleh ada kata cewek/wanita/waifu
      assert.doesNotMatch(p.systemPrompt, /\b(cewek|wanita|perempuan|waifu|gadis)\b/i);
    }
  });

  await t.test('Zero Unicode Emojis pada seluruh definisi persona', () => {
    for (const pId of personas) {
      const p = getPersonality(pId);
      assert.ok(!EMOJI_REGEX.test(p.name), `${pId}.name mengandung emoji`);
      assert.ok(!EMOJI_REGEX.test(p.greeting), `${pId}.greeting mengandung emoji`);
      assert.ok(!EMOJI_REGEX.test(p.errorMessage), `${pId}.errorMessage mengandung emoji`);
      assert.ok(!EMOJI_REGEX.test(p.systemPrompt), `${pId}.systemPrompt mengandung emoji`);

      for (const [k, v] of Object.entries(p.strings)) {
        if (typeof v === 'string') {
          assert.ok(!EMOJI_REGEX.test(v), `${pId}.strings.${k} mengandung emoji: ${v}`);
        } else if (Array.isArray(v)) {
          v.forEach((item, idx) => {
            if (typeof item === 'string') {
              assert.ok(!EMOJI_REGEX.test(item), `${pId}.strings.${k}[${idx}] mengandung emoji: ${item}`);
            }
          });
        }
      }
    }
  });
});
