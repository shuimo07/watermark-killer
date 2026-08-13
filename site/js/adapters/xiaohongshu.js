// 小红书适配器（尽力而为：反爬较强，失败时给出明确提示）
import { fetchHtml, firstMatch, unescapeStr, toHttps } from '../lib/adapter-utils.js';

export async function parse(text, url) {
  // 1. 短链展开获取页面
  let html;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    throw new Error('小红书链接访问失败：' + e.message);
  }

  // 2. 提取 noteId
  const noteId = firstMatch(html, [
    /"noteId"\s*:\s*"([0-9a-f]+)"/,
    /explore\/([0-9a-f]+)/,
    /discovery\/item\/([0-9a-f]+)/,
  ]);
  if (!noteId) throw new Error('未识别到小红书笔记 ID');

  // 3. 提取视频（sns-video CDN）或图集
  const mediaUrl = firstMatch(html, [
    /"masterUrl"\s*:\s*"([^"]+)"/,
    /"originVideoKey"\s*:\s*"([^"]+)"/,
    /https:\\u002F\\u002F[^"']*?sns-video[^"']*?\.mp4[^"']*/,
  ]);
  const images = (html.match(/https:\\u002F\\u002Fsns-webpic-qc\.xhscdn\.com[^"']+/g) || [])
    .map((x) => unescapeStr(toHttps(x)))
    .map((x) => (x.includes('!') ? x.split('!')[0] : x));
  const uniqueImages = [...new Set(images)].slice(0, 18);

  if (mediaUrl) {
    return {
      platform: 'xiaohongshu',
      type: 'video',
      title: firstMatch(html, [/"title"\s*:\s*"([^"]{1,120})"/]) || '小红书视频',
      cover: uniqueImages[0] || '',
      mediaUrl: unescapeStr(toHttps(mediaUrl)),
      images: [],
      desc: '',
    };
  }
  if (uniqueImages.length) {
    return {
      platform: 'xiaohongshu',
      type: 'images',
      title: '小红书图文',
      cover: uniqueImages[0],
      mediaUrl: null,
      images: uniqueImages,
      desc: '',
    };
  }
  throw new Error('小红书解析失败：页面需登录验证或内容已删除');
}
