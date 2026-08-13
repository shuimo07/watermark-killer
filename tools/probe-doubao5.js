// 检查分享页 HTML 中的 _SSR_DATA 是否内嵌视频信息
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: Buffer.from('TIMEOUT') }); });
    req.on('error', (e) => resolve({ status: 0, body: Buffer.from('ERR ' + e.message) }));
  });
}

(async () => {
  const shareUrl = 'https://www.doubao.com/video-sharing?source_type=mobile&share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg';
  const r = await get(shareUrl);
  const html = r.body.toString('utf8');
  console.log('len:', html.length);
  console.log('_SSR_DATA present:', html.includes('_SSR_DATA'));
  const idx = html.indexOf('_SSR_DATA');
  if (idx !== -1) {
    console.log('--- _SSR_DATA 上下文（前后 3000 字符）---');
    console.log(html.slice(idx - 100, idx + 3000));
  }
  // 兜底：搜索 play/url/video 关键词附近
  for (const kw of ['playUrl', 'videoUrl', 'play_url', 'main_url', 'url_list', 'videoInfo', 'cover']) {
    const i = html.indexOf(kw);
    console.log(`${kw}: ${i === -1 ? '无' : '有 @' + i}`);
    if (i !== -1) console.log('   context:', html.slice(Math.max(0, i - 150), i + 250).replace(/\s+/g, ' '));
  }
})();
