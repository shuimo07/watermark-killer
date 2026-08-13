// 适配器共享工具
import { proxyText } from './proxy.js';

/** 抓取页面 HTML（经 CORS 代理 + 移动端 UA） */
export async function fetchHtml(url) {
  return proxyText(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Referer: 'https://www.baidu.com/',
    },
  });
}

/** 依次尝试多个正则，返回第一个命中（返回捕获组 1 或整串） */
export function firstMatch(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1] !== undefined ? m[1] : m[0];
  }
  return null;
}

/** 提取 JSON 片段 */
export function extractJson(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      try {
        return JSON.parse(m[1]);
      } catch {
        // 尝试包裹在对象里
        try {
          return JSON.parse(`{${m[1]}}`);
        } catch {
          // ignore
        }
      }
    }
  }
  return null;
}

/** 反斜杠转义清理（JS 字符串内嵌 JSON 常见） */
export function unescapeStr(s) {
  return s.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\"/g, '"');
}

/** https 化 */
export function toHttps(u) {
  return u && u.startsWith('//') ? 'https:' + u : u;
}
