// 下载与保存工具
import { proxyFetch } from './proxy.js';

/** 下载 Blob：优先直连（referrer:'' 绕过防盗链；CDN 开放 CORS 时如豆包视频），失败回退 CORS 代理 */
export async function fetchBlob(url) {
  try {
    const res = await fetch(url, { mode: 'cors', referrer: '' });
    if (res.ok) return await res.blob();
    throw new Error('HTTP ' + res.status);
  } catch {
    const res = await proxyFetch(url, { timeout: 120000 });
    return res.blob();
  }
}

/** 触发浏览器下载 */
export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 3000);
}

/** 拼接文件名（平台_时间戳） */
export function makeFilename(platform, ext) {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  return `${platform || 'video'}_${ts}.${ext}`;
}

/** 下载单张图片 */
export async function downloadImage(url, filename) {
  const blob = await fetchBlob(url);
  saveBlob(blob, filename);
}

/** 从 URL 推断扩展名 */
export function extFromUrl(url, fallback = 'mp4') {
  const m = url.match(/\.(mp4|mov|m4v|webm|jpg|jpeg|png|webp|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : fallback;
}
