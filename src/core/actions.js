import { getSetting, applyGifSetting } from './settings.js';
import { getSummary, getFacts } from './facts.js';
import { getAffinity } from './affinity.js';

const TAG_REGEX = /\[([A-Za-z0-9_]+)(?::\s*([^\]]*?))?\]/g;
const UNCLOSED_TAG_AT_END = /\[([A-Za-z0-9_]+):\s*[^\]]*$/;

/**
 * Ekstraksi tag aksi [NAMA: arg1 | arg2] dari teks balasan LLM.
 * Membersihkan seluruh tag (baik valid maupun tidak valid) dari teks akhir.
 *
 * @param {string} raw - Teks mentah dari balasan LLM
 * @param {Array<object>} registeredTags - Daftar definisi tag yang terdaftar
 * @returns {{ text: string, actions: Array<object>, invalidTags: Array<object> }}
 */
export function extractActions(raw = '', registeredTags = []) {
  if (!raw || typeof raw !== 'string') {
    return { text: '', actions: [], invalidTags: [] };
  }

  const tagMap = new Map();
  for (const tag of registeredTags) {
    if (tag?.name) {
      tagMap.set(tag.name.toUpperCase(), tag);
    }
  }

  const actions = [];
  const invalidTags = [];

  // Tangani kemungkinan tag terpotong di akhir output
  let cleanText = raw.replace(UNCLOSED_TAG_AT_END, (match, name) => {
    invalidTags.push({
      name: name.toUpperCase(),
      raw: match,
      reason: 'Tag tidak tertutup lengkap',
    });
    return '';
  });

  // Cari dan validasi semua kemunculan tag
  cleanText = cleanText.replace(TAG_REGEX, (match, name, rawArgs) => {
    const upperName = name.toUpperCase();
    const tagDef = tagMap.get(upperName);

    if (!tagDef) {
      invalidTags.push({
        name: upperName,
        raw: match,
        reason: `Tag '${upperName}' tidak terdaftar`,
      });
      return '';
    }

    const args = (rawArgs ?? '')
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const minArgs = tagDef.minArgs ?? 1;
    const maxArgs = tagDef.maxArgs ?? Infinity;
    const maxArgLength = tagDef.maxArgLength ?? 500;

    if (args.length < minArgs) {
      invalidTags.push({
        name: upperName,
        raw: match,
        reason: `Jumlah argumen kurang (minimal ${minArgs})`,
      });
      return '';
    }

    if (args.length > maxArgs) {
      invalidTags.push({
        name: upperName,
        raw: match,
        reason: `Jumlah argumen berlebih (maksimal ${maxArgs})`,
      });
      return '';
    }

    const tooLong = args.find((a) => a.length > maxArgLength);
    if (tooLong) {
      invalidTags.push({
        name: upperName,
        raw: match,
        reason: `Argumen melebihi panjang maksimal (${maxArgLength} karakter)`,
      });
      return '';
    }

    actions.push({
      name: upperName,
      args,
      raw: match,
      def: tagDef,
    });

    return '';
  });

  // Rapikan baris kosong dan spasi ganda akibat penghapusan tag
  cleanText = cleanText
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .trim();

  return {
    text: cleanText,
    actions,
    invalidTags,
  };
}

/**
 * Format waktu saat ini sesuai zona waktu user untuk disisipkan ke prompt.
 * Contoh: "Rabu, 04 Nov 2026, 20.12 WIB (Asia/Jakarta)"
 */
export function formatNowContext(ctx, date = new Date(), persona = null) {
  const isEn = persona?.language !== 'id';
  const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
  const lang = isEn ? 'en' : getSetting(ctx, 'lang', 'id');
  const locale = lang === 'en' ? 'en-US' : 'id-ID';

  let formattedTime = '';
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    formattedTime = formatter.format(date);
  } catch {
    formattedTime = date.toISOString();
  }

  const userName = ctx?.from?.first_name || 'User';
  if (isEn) {
    return `Current time: ${formattedTime} (${tz})\nUser name: ${userName}`;
  }
  return `Sekarang: ${formattedTime} (${tz})\nNama user: ${userName}`;
}

export const GLOBAL_SAFETY_RULES = `## Safety & Crisis Rules (Mandatory & Highest Priority)
1. Mental Health Crisis & Self-Harm:
   - If user exhibits signs of acute mental crisis, severe despair, suicidal thoughts, or desire to self-harm: STOP ALL persona acting, harshness, or sarcasm immediately. Do not use kaomoji.
   - Strictly forbidden to mock, belittle, dismiss, or act harshly.
   - Respond with warmth, calmness, genuine support, and direct concern in English.
   - Listen and validate their feelings, and urge them to contact trusted people or official emergency hotlines:
     * Hotline SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)
     * Halo Kemenkes: 1500-567
     * Layanan Darurat Nasional: 112
     * Or nearest healthcare facility / emergency room.
2. Batasan Medis (Medical Boundaries):
   - Strictly forbidden to provide clinical medical diagnoses (diagnosis medis) for physical or psychological conditions.
   - Strictly forbidden to prescribe medications, drug dosages (dosis obat), or dangerous remedies.
   - Always direct user to consult a licensed medical doctor or healthcare professional.`;

/**
 * Gabungkan system prompt dasar persona dengan petunjuk tag aktif dan konteks waktu.
 */
export function buildSystemPrompt({ persona, tags = [], ctx }) {
  const isEn = persona?.language !== 'id';
  let prompt = persona?.systemPrompt ?? '';

  const gifFreq = getSetting(ctx, 'gif_freq', 'normal');
  prompt = applyGifSetting(prompt, gifFreq);

  // Pastikan aturan keselamatan selalu ada di setiap system prompt
  if (!prompt.includes('SEJIWA') || !prompt.includes('119')) {
    prompt += `\n\n${GLOBAL_SAFETY_RULES}`;
  }

  // Sisipkan ringkasan percakapan sebelumnya jika tersedia (F-14)
  if (ctx?.chat?.id) {
    try {
      const summary = getSummary(ctx.chat.id, persona?.id);
      if (summary) {
        prompt += isEn
          ? `\n\n## Previous Conversation Summary\n${summary}`
          : `\n\n## Ringkasan Percakapan Sebelumnya\n${summary}`;
      }
    } catch {}
  }

  // Sisipkan fakta stabil tentang user jika tersedia (F-14)
  if (ctx?.from?.id) {
    try {
      const facts = getFacts(ctx.from.id, 15);
      if (facts.length > 0) {
        prompt += isEn
          ? `\n\n## Things You Know About the User\n${facts.map((f) => `- ${f.fact}`).join('\n')}`
          : `\n\n## Hal yang Kamu Ketahui tentang User\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
      }
    } catch {}
  }

  // Sisipkan level kedekatan / affinity (F-20)
  if (ctx?.from?.id) {
    try {
      const tz = getSetting(ctx, 'tz', 'Asia/Jakarta');
      const aff = getAffinity(ctx.from.id, tz, Date.now(), persona?.id);
      const title = persona?.affinityTitles?.[aff.level] ?? aff.title;
      const instruction = persona?.affinityInstructions?.[aff.level] ?? aff.promptInstruction;
      prompt += isEn
        ? `\n\n## Relationship Level (Affinity)\nCurrent status: Level ${aff.level} - "${title}" (${aff.points} points).\nTone instruction: ${instruction}`
        : `\n\n## Level Kedekatan (Affinity)\nStatus hubungan saat ini: Level ${aff.level} - "${title}" (${aff.points} poin).\nInstruksi nada bicara: ${instruction}`;
    } catch {}
  }

  // Kumpulkan hint untuk tag aktif yang memiliki promptHint
  const activeHints = tags
    .filter((t) => t.promptHint && (t.name !== 'GIF' || gifFreq !== 'off'))
    .map((t) => `- [${t.name}: ...]: ${t.promptHint}`);

  if (activeHints.length > 0) {
    prompt += isEn
      ? `\n\n## Available Action Tags\nInclude one or more action tags at the very end of your response if relevant:\n${activeHints.join(
          '\n',
        )}\nRules: Never mention or explain action tags to the user. Write tags at the end of the reply. NEVER output [GIF: ...] and [STICKER: ...] together in the same response (choose one or none).`
      : `\n\n## Tag Aksi Tersedia\nSertakan satu atau lebih tag aksi di baris paling akhir balasan bila relevan:\n${activeHints.join(
          '\n',
        )}\nAturan: Jangan pernah menyebutkan atau menjelaskan tag aksi kepada user. Tulis tag di akhir balasan. JANGAN pernah mengeluarkan tag [GIF: ...] dan [STICKER: ...] secara bersamaan dalam satu balasan (pilih salah satu atau tidak sama sekali).`;
  }

  const nowContext = formatNowContext(ctx, new Date(), persona);
  prompt += isEn
    ? `\n\n## Current Context\n${nowContext}`
    : `\n\n## Konteks Saat Ini\n${nowContext}`;

  if (isEn) {
    prompt += `\n\n## Strict English Output & Action Enforcement
- Every single word of your response MUST be in natural English.
- This rule applies to ALL generated text without exception: spoken dialogue, stage directions, physical actions in asterisks (*...*), gestures, thoughts, and narration.
- Under NO circumstance should any Indonesian, Chinese, or foreign-language words appear in your output, including in roleplay actions (e.g. NEVER write *Mengangkat alis sedikit, pandangan tajam*, *Menatap dingin*, *Menghela napas*, *Suara dingin, nada praktis*; write *Raises an eyebrow slightly, gaze sharp*, *Glares coldly*, *Sighs*, *Cold voice, practical tone*).
- Default to natural dialogue with minimal to no stage directions. If roleplay actions are included, they must be strictly and entirely in English.
- Any previous messages in conversation history that were written in Indonesian or other languages are strictly historical context. Do NOT imitate their language. Your reply must always be 100% English.`;
  }

  return prompt;
}
