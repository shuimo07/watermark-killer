// Cloudflare Worker：豆包真·无水印后端
// 部署后把豆包登录 cookie 存为 Secret（加密环境变量）DOUBAO_COOKIE，切勿写进代码/git/聊天
// 用法：GET https://<你的worker>.workers.dev/?video_id=<vid>
// 返回：{"code":0,"url":"<无水印直链>"}  或  {"code":<错误码>,"msg":"..."}

const SALT = 'TdTC5rgxYgkOUrPHpnM7pByyRiuCmrWKGWs521cXdST0m69/COjWjSanLjfBqVovHwWlGJKu8pSXMrYqOKrdWA==';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0';

// 允许的站点来源（可自行增删）
const ALLOWED_ORIGINS = [
  'https://shuimo07.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function b64UrlToBytes(v) {
  const s = String(v || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s.padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha512(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-512', data));
}

async function decryptFplayUrl(raw, keySeed) {
  const encrypted = b64UrlToBytes(raw);
  const ciphertext = encrypted.slice(4);
  const seed = b64UrlToBytes(keySeed);
  const keyMaterial = new Uint8Array(128);
  const salt = b64UrlToBytes(SALT);
  keyMaterial.set(await sha512(seed), 0);
  keyMaterial.set(salt, 64);
  const derived = await sha512(keyMaterial);
  const keyBytes = derived.slice(0, 16);
  const iv = derived.slice(16, 32);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext));
  let end = decrypted.length;
  const pad = decrypted[end - 1];
  if (pad >= 1 && pad <= 16) {
    let ok = true;
    for (let i = 0; i < pad; i++) if (decrypted[end - 1 - i] !== pad) { ok = false; break; }
    if (ok) end -= pad;
  }
  return new TextDecoder().decode(decrypted.slice(0, end)).trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + '/') || (o.endsWith('.github.io') && origin.endsWith('.github.io')));

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowed ? origin : 'null',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (!allowed) return json({ code: 403, msg: '来源不被允许' }, 403);

    const cookie = env.DOUBAO_COOKIE;
    if (!cookie) return json({ code: 500, msg: '后端未配置 DOUBAO_COOKIE' }, 500);

    const vid = new URL(request.url).searchParams.get('video_id');
    if (!vid) return json({ code: 400, msg: '缺少 video_id' }, 400);

    try {
      // 1. 取视频模型（含 fallback_api）
      const modelRes = await fetch('https://www.doubao.com/alice/resource/get_video_model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Origin: 'https://www.doubao.com', Referer: 'https://www.doubao.com/video-sharing', Cookie: cookie },
        body: JSON.stringify({ params: [{ uri: vid }] }),
      });
      const modelJson = await modelRes.json();
      if (modelJson.code !== 0) return json({ code: modelJson.code, msg: modelJson.msg || '登录态失效，请更新 cookie' });

      const videoModel = JSON.parse(modelJson.data.results[0].video_model_result.video_model);
      const apiUrl = new URL(videoModel.fallback_api);
      if (!apiUrl.searchParams.get('key_seed')) return json({ code: 500, msg: 'fallback_api 无 key_seed' });
      apiUrl.searchParams.delete('force_fids');
      apiUrl.searchParams.delete('logo_type');
      apiUrl.searchParams.set('codec_type', '1');

      // 2. 取加密播放信息
      const infoRes = await fetch(apiUrl.toString(), {
        headers: { 'User-Agent': UA, Referer: 'https://www.doubao.com/', Cookie: cookie },
      });
      const infoJson = await infoRes.json();
      const info = infoJson.video_info && infoJson.video_info.data;
      if (!info || !info.key_seed) return json({ code: 500, msg: '播放信息异常' });

      const v1 = info.video_list && info.video_list.video_1;
      const urls = [];
      for (const k of ['main_url', 'backup_url_1']) {
        if (v1 && v1[k]) {
          try { const d = await decryptFplayUrl(v1[k], info.key_seed); if (d) urls.push(d); } catch { /* skip */ }
        }
      }
      if (!urls.length) return json({ code: 500, msg: '解密无水印直链失败' });
      return json({ code: 0, url: urls[0], urls });
    } catch (e) {
      return json({ code: 500, msg: e.message });
    }
  },
};
