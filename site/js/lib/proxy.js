// CORS 代理封装：多代理自动回退
import { CONFIG } from '../config.js';

export async function proxyFetch(url, { timeout = CONFIG.timeout, headers = {} } = {}) {
  let lastErr;
  for (const build of CONFIG.proxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(build(url), {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers },
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

export async function proxyText(url, opts) {
  const res = await proxyFetch(url, opts);
  return res.text();
}

export async function proxyJson(url, opts) {
  const res = await proxyFetch(url, opts);
  return res.json();
}
