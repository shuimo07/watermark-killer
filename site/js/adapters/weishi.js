// 微视适配器
import { fetchHtml, firstMatch, unescapeStr, toHttps } from '../lib/adapter-utils.js';
import { proxyJson } from '../lib/proxy.js';

export async function parse(text, url) {
  // 1. 从 URL/文本提取 feedid（微视视频 ID）
  let feedid = firstMatch(url + ' ' + text, [
    /feedid=([A-Za-z0-9]+)/,
    /video\/([A-Za-z0-9]+)/,
    /media\/([A-Za-z0-9]+)/,
  ]);
  if (!feedid) {
    // 抓页面找
    const html = await fetchHtml(url);
    feedid = firstMatch(html, [/feedid["']?\s*[:=]\s*["']([A-Za-z0-9]+)/]);
    if (!feedid) throw new Error('未识别到微视视频 ID');
  }

  // 2. 调微视公开接口
  const data = await proxyJson(
    `https://h5.weishi.qq.com/webapp/json/weishi/WSH5GetPlayPage?feedid=${feedid}&recommendtype=2&datalen=20&pagenum=1&from=weishi`
  );
  const feeds = (data && data.feeds) || [];
  const feed = feeds.find((f) => f && (f.id === feedid || f.feedid === feedid)) || feeds[0];
  if (!feed) throw new Error('微视解析失败：接口未返回数据');

  const vinfo = feed.video_info || {};
  const mediaUrl = toHttps((vinfo.video_url || (vinfo.url_list && vinfo.url_list[0] && vinfo.url_list[0].url)) || '');
  if (!mediaUrl) throw new Error('微视解析失败：未获取到视频地址');

  return {
    platform: 'weishi',
    type: 'video',
    title: unescapeStr(feed.feed_desc || '微视视频').trim(),
    cover: toHttps(vinfo.cover_url || ''),
    mediaUrl,
    images: [],
    desc: '',
  };
}
