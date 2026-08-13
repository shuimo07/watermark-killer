// 平台识别与链接提取
import { CONFIG } from '../config.js';

const RULES = [
  { platform: 'douyin', name: '抖音', match: /(?:v\.douyin\.com|douyin\.com|iesdouyin\.com)/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
  { platform: 'kuaishou', name: '快手', match: /(?:v\.kuaishou\.com|kuaishou\.com|kuaishouapp\.com|chenzhongtech\.com)/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
  { platform: 'weishi', name: '微视', match: /h5\.weishi\.qq\.com/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
  { platform: 'weibo', name: '微博', match: /(?:weibo\.com|weibo\.cn|m\.weibo\.cn)/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
  { platform: 'xiaohongshu', name: '小红书', match: /(?:xiaohongshu\.com|xhslink\.com|xhscdn\.com)/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
  { platform: 'taobao', name: '淘宝', match: /(?:tb\.cn|taobao\.com|tmall\.com)/i, re: /https?:\/\/[^\s"'<>，。；]+/g },
];

/**
 * 从分享文案中识别平台并提取链接
 * @returns {{platform: string, url: string|null}}
 */
export function detect(text) {
  if (!text || !text.trim()) return { platform: 'unknown', url: null };
  for (const r of RULES) {
    if (r.match.test(text)) {
      const m = text.match(r.re);
      return { platform: r.platform, url: m ? m[0] : null };
    }
  }
  return { platform: 'unknown', url: null };
}

export function platformName(p) {
  return CONFIG.platformNames[p] || p;
}

export function platformIcon(p) {
  return CONFIG.platformIcons[p] || '🔗';
}
