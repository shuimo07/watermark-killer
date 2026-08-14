// CORS 代理封装：自定义中继优先，多代理自动回退，错误信息带细节
import { CONFIG } from '../config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0';

const RELAY_KEY = 'wz_relay_v1';

/** 用户自建中继（localStorage 配置） */
export function getRelay() {
  try {
    const r = (localStorage.getItem(RELAY_KEY) || '').trim();
    if (r && /^https?:\/\/.+/.test(r)) return r.replace(/\/+$/, '');
  } catch { /* ignore */ }
  return null;
}

export function setRelay(url) {
  try {
    localStorage.setItem(RELAY_KEY, (url || '').trim());
  } catch { /* ignore */ }
}

const WORKER_KEY = 'wz_worker_v1';

/** 用户自建「真·无水印」后端（Cloudflare Worker，localStorage 配置） */
export function getWorker() {
  try {
    const r = (localStorage.getItem(WORKER_KEY) || '').trim();
    if (r && /^https?:\/\/.+/.test(r)) return r.replace(/\/+$/, '');
  } catch { /* ignore */ }
  return null;
}

export function setWorker(url) {
  try {
    localStorage.setItem(WORKER_KEY, (url || '').trim());
  } catch { /* ignore */ }
}

/** 把 URL 包装进代理/中继 */
export function wrapProxy(proxy, url) {
  return proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(url);
}

/**
 * 通用代理请求：自定义中继 → 公共代理链 → 直连
 * @returns {Promise<Response>}
 */
async function relay(method, url, { body, headers = {}, timeout = CONFIG.timeout } = {}) {
  const attempts = [];
  // 1) 自定义中继（若已配置）
  const relayUrl = getRelay();
  if (relayUrl) attempts.push(`relay:${relayUrl}`);
  // 2) 公共代理链（按方法区分）
  if (method === 'GET') {
    attempts.push('proxy:corsproxy.io', 'proxy:allorigins', 'direct');
  } else {
    attempts.push('proxy:corsproxy.io', 'proxy:cors.eu.org', 'direct');
  }

  let lastErr = null;
  for (const attempt of attempts) {
    let requestUrl = url;
    try {
      if (attempt.startsWith('relay:')) {
        requestUrl = wrapProxy(attempt.slice(6), url);
      } else if (attempt === 'proxy:corsproxy.io') {
        requestUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
      } else if (attempt === 'proxy:allorigins') {
        requestUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      } else if (attempt === 'proxy:cors.eu.org') {
        requestUrl = 'https://cors.eu.org/' + url;
      } else if (attempt === 'direct') {
        requestUrl = url;
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(requestUrl, {
        method,
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...headers },
        ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } catch (e) {
      lastErr = `${attempt}: ${e.message}`;
    }
  }
  throw new Error('所有通道失败 [' + attempts.join(' | ') + '] 最后错误: ' + lastErr);
}

/** GET 文本 */
export async function proxyText(url, opts) {
  const res = await relay('GET', url, opts);
  return res.text();
}

/** GET JSON */
export async function proxyJson(url, opts) {
  const res = await relay('GET', url, opts);
  return res.json();
}

/** POST JSON */
export async function proxyJsonPost(url, body, opts) {
  const res = await relay('POST', url, {
    ...opts,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
  });
  return res.json();
}

// 兼容旧接口
export async function proxyFetch(url, opts) {
  return relay('GET', url, opts);
}
