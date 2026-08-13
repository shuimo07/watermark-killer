// 快手适配器
import { fetchHtml, firstMatch, unescapeStr, toHttps } from '../lib/adapter-utils.js';

export async function parse(text, url) {
  // 1. 短链展开 → 获取页面 HTML
  let html = '';
  if (/v\.kuaishou\.com/i.test(url)) {
    html = await fetchHtml(url);
  } else {
    html = await fetchHtml(url);
  }

  // 2. 提取 photoId
  const photoId = firstMatch(html, [
    /"photoId"\s*:\s*"([^"]+)"/,
    /photoId=([A-Za-z0-9_-]+)/,
    /short-video\/([A-Za-z0-9_-]+)/,
    /fw\/photo\/([A-Za-z0-9_-]+)/,
  ]);
  if (!photoId) throw new Error('未识别到快手视频 ID');

  // 3. 页面内嵌数据提取播放地址
  let mediaUrl = firstMatch(html, [
    /"playUrl"\s*:\s*"([^"]+)"/,
    /"photoUrl"\s*:\s*"([^"]+)"/,
    /https:\\u002F\\u002F[^"']+?\.mp4[^"']*/,
    /"url"\s*:\s*"([^"]*?\.mp4[^"]*)"/,
  ]);
  if (mediaUrl) mediaUrl = unescapeStr(mediaUrl);

  // 4. 回退：尝试 GraphQL 接口（最简化）
  if (!mediaUrl) {
    try {
      const { proxyJson } = await import('../lib/proxy.js');
      const data = await proxyJson('https://www.kuaishou.com/graphql', {
        headers: { 'Content-Type': 'application/json' },
      });
      // 若走到这里说明接口返回了（实际需 POST，此处作为占位回退）
      mediaUrl = null;
    } catch { /* ignore */ }
  }

  if (!mediaUrl) {
    throw new Error('快手解析失败：未获取到视频地址（快手反爬较强，可尝试更换链接）');
  }

  return {
    platform: 'kuaishou',
    type: 'video',
    title: firstMatch(html, [/"caption"\s*:\s*"([^"]{1,120})"/, /<title>([^<]{1,80})<\/title>/]) || '快手视频',
    cover: firstMatch(html, [/"coverUrl"\s*:\s*"([^"]+)"/, /"cover"\s*:\s*"([^"]+)"/]) || '',
    mediaUrl: toHttps(mediaUrl),
    images: [],
    desc: '',
  };
}
