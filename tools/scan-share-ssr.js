// 搜分享页 HTML 里的 SSR loader 数据 / 视频信息
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(res.statusCode + '|' + Buffer.concat(chunks).toString('utf8')));
    });
    req.setTimeout(20000, () => { req.destroy(); resolve('TIMEOUT'); });
    req.on('error', (e) => resolve('ERR ' + e.message));
  });
}

(async () => {
  const html = await get('https://www.doubao.com/video-sharing?source_type=mobile&share_id=52509024516402690&video_id=v0269cg10004d9v2uga7dld8dlfmap30');
  console.log('len:', html.length);
  for (const kw of ['loaderData', 'videoInfo', 'video_list', 'fallback', 'poster_url', 'video_model', 'watermark', 'key_seed', 'main_url', 'alice', 'samantha']) {
    let i = -1, n = 0;
    const out = [];
    while ((i = html.indexOf(kw, i + 1)) !== -1 && n < 3) { out.push(html.slice(Math.max(0, i - 60), i + 120).replace(/\s+/g, ' ')); n++; }
    console.log(`\n[${kw}] x${n}`);
    out.forEach((o) => console.log('  ' + o));
  }
})();
