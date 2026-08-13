// 豆包适配器：分享链接 → 无水印视频直链
// 接口：POST https://www.doubao.com/samantha/media/get_play_info（社区逆向所得，公开可用）
import { proxyJsonPost } from '../lib/proxy.js';

const PLAY_PARAMS = {
  version_code: '20800',
  language: 'zh-CN',
  device_platform: 'web',
  aid: '497858',
  real_aid: '497858',
  pkg_type: 'release_version',
  device_id: '',
  pc_version: '2.51.7',
  region: '',
  sys_region: '',
  samantha_web: '1',
  'use-olympus-account': '1',
  web_tab_id: '',
};

export async function parse(text, url) {
  // 1. 提取 video_id
  const m = (url + ' ' + text).match(/video_id=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('未识别到豆包视频 ID（链接缺少 video_id 参数）');
  const vid = m[1];

  // 2. 调用播放信息接口
  const qs = new URLSearchParams(PLAY_PARAMS).toString();
  let data;
  try {
    data = await proxyJsonPost('https://www.doubao.com/samantha/media/get_play_info?' + qs, { key: vid });
  } catch (e) {
    throw new Error('豆包接口请求失败：' + e.message);
  }
  if (data.code !== 0) {
    throw new Error('豆包解析失败：' + (data.msg || '接口返回异常'));
  }
  const d = data.data || {};
  const info = d.original_media_info || d.media_info?.[0] || {};
  const mainUrl = info.main_url;
  if (!mainUrl) throw new Error('豆包解析失败：未获取到视频地址（链接可能已失效）');

  const meta = info.meta || {};
  const sizeNote = meta.width ? `（${meta.width}×${meta.height} · ${meta.definition || ''}）` : '';

  return {
    platform: 'doubao',
    type: 'video',
    title: '豆包AI视频' + sizeNote,
    cover: d.poster_url || '',
    mediaUrl: mainUrl,
    images: [],
    desc: '',
  };
}
