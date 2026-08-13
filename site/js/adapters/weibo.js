// 微博适配器
import { fetchHtml, firstMatch, unescapeStr, toHttps } from '../lib/adapter-utils.js';

export async function parse(text, url) {
  // 1. 归一化为移动版 URL
  const m = url.match(/weibo\.com\/(?:\d+\/)?([A-Za-z0-9]+)/) || url.match(/weibo\.cn\/[^\/]+\/([A-Za-z0-9]+)/);
  const id = m ? m[1] : firstMatch(text, [/\/([A-Za-z0-9]{8,})/]);
  if (!id) throw new Error('未识别到微博内容 ID');

  // 2. 抓移动版页面
  const html = await fetchHtml(`https://m.weibo.cn/status/${id}`);
  if (/不存在|页面不存在|403|验证/.test(html)) {
    // 部分请求需要 cookie，尝试从桌面版页面提取
    const html2 = await fetchHtml(`https://weibo.com/ajax/statuses/show?id=${id}`);
    if (html2 && !html2.startsWith('{')) throw new Error('微博解析失败：需要登录或验证');
  }

  // 3. 提取视频/图集
  const mediaUrl = firstMatch(html, [
    /"url"\s*:\s*"(https?:\\u002F\\u002F[^"]*?\.mp4[^"]*)"/,
    /https:\/\/f\.video\.weibocdn\.com\/[^"'\s]+\.mp4[^"'\s]*/,
  ]);
  const images = (html.match(/https:\/\/wx[0-9]?\.sinaimg\.cn\/[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*/g) || [])
    .map((x) => unescapeStr(toHttps(x)));
  const uniqueImages = [...new Set(images)].slice(0, 18);

  if (mediaUrl) {
    return {
      platform: 'weibo',
      type: 'video',
      title: firstMatch(html, [/"text"\s*:\s*"([^"]{1,120})"/]) ? '' : '微博视频',
      cover: uniqueImages[0] || '',
      mediaUrl: unescapeStr(toHttps(mediaUrl)),
      images: [],
      desc: '',
    };
  }
  if (uniqueImages.length) {
    return {
      platform: 'weibo',
      type: 'images',
      title: '微博图文',
      cover: uniqueImages[0],
      mediaUrl: null,
      images: uniqueImages,
      desc: '',
    };
  }
  throw new Error('微博解析失败：未获取到内容（微博需登录内容较多）');
}
