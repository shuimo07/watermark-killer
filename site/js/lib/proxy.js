// CORS 代理封装：多代理自动回退 + POST 支持
import { CONFIG } from '../config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0';

/** GET 代理链 */
export async function proxyFetch(url, { timeout = CONFIG.timeout, headers = {} } = {}) {
  let lastErr;
  for (const build of CONFIG.proxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(build(url), {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...headers },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('代理请求失败：' + (lastErr ? lastErr.message : '所有代理不可用'));
}

/** POST JSON 代理链（部分代理仅支持 GET，单独维护） */
export async function proxyJsonPost(url, body, { timeout = CONFIG.timeout } = {}) {
  const postProxies = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://cors-anywhere.herokuapp.com/${u}`,
  ];
  let lastErr;
  for (const build of postProxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(build(url), {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify(body),
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('POST 代理请求失败：' + (lastErr ? lastErr.message : '所有代理不可用'));
}

export async function proxyText(url, opts) {
  const res = await proxyFetch(url, opts);
  return res.text();
}

export async function proxyJson(url, opts) {
  const res = await proxyFetch(url, opts);
  return res.json();
}
