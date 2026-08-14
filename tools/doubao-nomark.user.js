// ==UserScript==
// @name         Watermark_killer 豆包真·无水印下载
// @namespace    https://github.com/shuimo07/watermark-killer
// @version      1.0.0
// @description  在豆包视频分享页（已登录状态）一键下载逐像素、保留原画面、零 logo 的无水印视频
// @match        https://www.doubao.com/video-sharing?*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// 原理（豆包登录态接口）：
//   get_video_model → video_model.fallback_api → 删除 logo_type/force_fids → FPLAY AES-CBC 解密 → 真实无水印直链
// 仅在你已登录豆包的浏览器中有效。

(function () {
  'use strict';

  const FPLAY_KDF_SALT = 'TdTC5rgxYgkOUrPHpnM7pByyRiuCmrWKGWs521cXdST0m69/COjWjSanLjfBqVovHwWlGJKu8pSXMrYqOKrdWA==';

  function b64UrlToBytes(v) {
    const s = String(v || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = s.padEnd(Math.ceil(s.length / 4) * 4, '=');
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function sha512(data) {
    return new Uint8Array(await crypto.subtle.digest('SHA-512', data));
  }

  async function decryptFplayUrl(raw) {
    const encrypted = b64UrlToBytes(raw);
    const ciphertext = encrypted.slice(4); // 前 4 字节为长度头，跳过
    const seed = b64UrlToBytes(rawKeySeedRef);
    const keyMaterial = new Uint8Array(128);
    const salt = b64UrlToBytes(FPLAY_KDF_SALT);
    keyMaterial.set(await sha512(seed), 0);
    keyMaterial.set(salt, 64);
    const derived = await sha512(keyMaterial);
    const keyBytes = derived.slice(0, 16);
    const iv = derived.slice(16, 32);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);
    const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext));
    // 去 PKCS7 填充
    let end = decrypted.length;
    const pad = decrypted[end - 1];
    if (pad >= 1 && pad <= 16) {
      let ok = true;
      for (let i = 0; i < pad; i++) if (decrypted[end - 1 - i] !== pad) { ok = false; break; }
      if (ok) end -= pad;
    }
    return new TextDecoder().decode(decrypted.slice(0, end)).trim();
  }

  let rawKeySeedRef = '';

  function getVid() {
    return new URL(location.href).searchParams.get('video_id');
  }

  function getNoWatermarkApi(fallbackApi) {
    try {
      const url = new URL(fallbackApi);
      if (!url.searchParams.get('key_seed')) return null;
      url.searchParams.delete('force_fids');
      url.searchParams.delete('logo_type');
      url.searchParams.set('codec_type', '1');
      return url.toString();
    } catch { return null; }
  }

  async function resolveCleanUrl(vid) {
    const modelRes = await fetch('https://www.doubao.com/alice/resource/get_video_model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: [{ uri: vid }] }),
      credentials: 'include',
    });
    const modelJson = await modelRes.json();
    if (modelJson.code !== 0) throw new Error(modelJson.msg || '获取视频模型失败（请确认已登录豆包）');
    const videoModel = JSON.parse(modelJson.data.results[0].video_model_result.video_model);
    const apiUrl = getNoWatermarkApi(videoModel.fallback_api);
    if (!apiUrl) throw new Error('fallback_api 无 key_seed');
    const infoRes = await fetch(apiUrl, { credentials: 'include' });
    const infoJson = await infoRes.json();
    const info = infoJson.video_info.data;
    rawKeySeedRef = info.key_seed;
    const urls = [];
    const v1 = info.video_list && info.video_list.video_1;
    if (v1) { if (v1.main_url) urls.push(v1.main_url); if (v1.backup_url_1) urls.push(v1.backup_url_1); }
    const decrypted = [];
    for (const u of urls) {
      try { const d = await decryptFplayUrl(u); if (d) decrypted.push(d); } catch { /* skip */ }
    }
    return decrypted;
  }

  async function download(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function addButton() {
    if (document.getElementById('wmk-nowm-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'wmk-nowm-btn';
    btn.textContent = '⬇️ 下载真·无水印视频';
    btn.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;' +
      'background:#111;color:#7cc0ff;border:none;border-radius:24px;padding:12px 22px;font-size:15px;' +
      'font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    btn.addEventListener('click', async () => {
      const vid = getVid();
      if (!vid) { alert('未识别到 video_id'); return; }
      btn.textContent = '解析中…';
      btn.disabled = true;
      try {
        const urls = await resolveCleanUrl(vid);
        if (!urls.length) throw new Error('未解析到无水印直链');
        await download(urls[0], 'doubao_' + vid + '_无水印.mp4');
        btn.textContent = '✅ 已开始下载';
      } catch (e) {
        alert('失败：' + e.message);
        btn.textContent = '⬇️ 下载真·无水印视频';
      } finally {
        btn.disabled = false;
      }
    });
    document.body.appendChild(btn);
  }

  // 分享页是 SPA，轮询等待挂载
  let tries = 0;
  const timer = setInterval(() => {
    if (getVid()) { addButton(); clearInterval(timer); }
    else if (++tries > 60) clearInterval(timer);
  }, 1000);
})();
