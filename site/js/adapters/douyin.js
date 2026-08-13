// 抖音适配器：分享文案/链接 → 无水印视频直链
import { fetchHtml, firstMatch, extractJson, unescapeStr, toHttps } from '../lib/adapter-utils.js';
import { proxyJson } from '../lib/proxy.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** 从文本提取 aweme_id */
function extractAwemeId(text) {
  return firstMatch(text, [
    /"aweme_id"\s*:\s*"(\d+)"/,
    /"itemId"\s*:\s*"(\d+)"/,
    /(?:video|note)\/(\d{10,25})/,
    /"item_id"\s*:\s*"(\d+)"/,
    /data-e2e="video-detail"[\s\S]{0,2000}?(\d{15,25})/,
  ]);
}

/** 从页面 HTML 提取播放地址（无水印优先） */
function extractPlayFromHtml(html) {
  // 内嵌 JSON 中的 play_addr
  const m = html.match(/play_addr[^}]*?"url_list"\s*:\s*(\[[^\]]+\])/);
  if (m) {
    try {
      const list = JSON.parse(m[1].replace(/\\u002F/g, '/'));
      const noWm = list.find((u) => !/playwm/.test(u) && /play/.test(u)) || list[0];
      if (noWm) return unescapeStr(toHttps(noWm));
    } catch { /* ignore */ }
  }
  // 直接匹配视频 URL
  const u = firstMatch(html, [
    /"play_addr"\s*:\s*\{[^}]*?"uri"\s*:\s*"([^"]+)"/,
    /https:\/\/[^"'\s]+?\/play(?:wm)?\/[^"'\s]+/,
  ]);
  if (u) {
    if (/playwm/.test(u)) return u.replace('/playwm/', '/play/');
    return unescapeStr(toHttps(u));
  }
  return null;
}

export async function parse(text, url) {
  // 1. 解析 aweme_id
  let html = '';
  let awemeId = null;

  if (/v\.douyin\.com/i.test(url)) {
    // 短链：抓分享页 HTML 提取 id
    html = await fetchHtml(url);
    awemeId = extractAwemeId(html);
    if (!awemeId) awemeId = extractAwemeId(text);
  } else {
    awemeId = extractAwemeId(text) || extractAwemeId(url);
  }

  if (!awemeId) throw new Error('未识别到抖音视频 ID，请确认链接格式');

  // 2. 尝试公开 iteminfo 接口
  try {
    const info = await proxyJson(
      `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${awemeId}`,
      { headers: { 'User-Agent': UA, Referer: 'https://www.douyin.com/' } }
    );
    const item = info.item_list && info.item_list[0];
    if (item) {
      const play = item.video && item.video.play_addr;
      const urls = (play && play.url_list) || [];
      let mediaUrl = urls.find((u) => !/playwm/.test(u)) || urls[0] || null;
      if (mediaUrl) {
        mediaUrl = mediaUrl.replace('/playwm/', '/play/');
        return {
          platform: 'douyin',
          type: 'video',
          title: (item.desc || '').trim() || '抖音视频',
          cover: toHttps((item.video && item.video.cover && item.video.cover.url_list && item.video.cover.url_list[0]) || ''),
          mediaUrl: toHttps(mediaUrl),
          images: [],
          desc: item.desc || '',
        };
      }
    }
  } catch { /* 接口不可用时回退页面解析 */ }

  // 3. 回退：抓详情页解析
  if (!html) html = await fetchHtml(`https://www.douyin.com/video/${awemeId}`);
  const mediaUrl = extractPlayFromHtml(html);
  if (!mediaUrl) throw new Error('抖音解析失败：未获取到视频地址（接口可能已变更）');

  return {
    platform: 'douyin',
    type: 'video',
    title: firstMatch(html, [/"desc"\s*:\s*"([^"]{1,120})"/]) || '抖音视频',
    cover: firstMatch(html, [/"cover"\s*:\s*"([^"]+)"/]) || '',
    mediaUrl: unescapeStr(toHttps(mediaUrl)),
    images: [],
    desc: '',
  };
}
