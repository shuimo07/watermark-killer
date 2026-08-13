// 适配器统一入口
import * as douyin from './douyin.js';
import * as kuaishou from './kuaishou.js';
import * as weishi from './weishi.js';
import * as weibo from './weibo.js';
import * as xiaohongshu from './xiaohongshu.js';
import * as taobao from './taobao.js';

export const adapters = { douyin, kuaishou, weishi, weibo, xiaohongshu, taobao };

/**
 * 统一解析入口
 * @param {string} platform 平台 key
 * @param {string} text 原始分享文案
 * @param {string} url 提取出的链接
 * @returns {Promise<ParseResult>}
 */
export async function parse(platform, text, url) {
  const a = adapters[platform];
  if (!a) throw new Error('不支持的平台');
  const result = await a.parse(text, url);
  result.platform = platform;
  return result;
}
