import { extractActions } from './core/actions.js';

const API_KEY = process.env.GIPHY_API_KEY;

/**
 * Pisahkan tag [GIF: kata kunci] dari balasan AI menggunakan extractActions generik.
 * @returns {{ text: string, gifQuery: string | null }}
 */
export function extractGif(raw) {
  const { text, actions } = extractActions(raw, [
    { name: 'GIF', minArgs: 1, maxArgs: 1 },
  ]);
  const gifAction = actions.find((a) => a.name === 'GIF');
  return {
    text,
    gifQuery: gifAction ? gifAction.args[0] : null,
  };
}

/**
 * Normalisasi query GIF agar berorientasi persona laki-laki.
 */
export function normalizeGifQuery(query) {
  if (!query || typeof query !== 'string') return 'anime boy';
  let q = query.trim().toLowerCase();
  // Ganti kata-kata cewek ke cowok // female-ok: replacement list
  q = q.replace(/\b(girl|girls|woman|women|female|waifu|she)\b/gi, 'boy'); // female-ok: replacement list
  // Jika query tidak menyebut anime boy / guy / man / male, tambahkan prefix/suffix agar konsisten
  if (!/\b(boy|guy|man|male|husband)\b/i.test(q)) {
    q = `anime boy ${q}`.trim();
  }
  return q;
}

/** Cari GIF di Giphy dan kembalikan URL acak dari hasil teratas, atau null. */
export async function searchGif(query) {
  if (!API_KEY) return null;

  const normalized = normalizeGifQuery(query);
  const url = new URL('https://api.giphy.com/v1/gifs/search');
  url.search = new URLSearchParams({
    api_key: API_KEY,
    q: normalized,
    limit: '10',
    rating: 'pg-13',
    lang: 'en',
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Giphy error ${res.status}`);

  const { data } = await res.json();
  if (!data?.length) return null;

  const pick = data[Math.floor(Math.random() * data.length)];
  // downsized_medium lebih ringan dibanding original, aman untuk batas ukuran Telegram.
  return pick.images?.downsized_medium?.url ?? pick.images?.original?.url ?? null;
}
