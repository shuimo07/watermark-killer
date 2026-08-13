// 抓取 video-sharing 页面 JS 块，找 API 路径
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

const CDN = 'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/web/static/js';

(async () => {
  const files = [
    'async/video-sharing_page.9500d48e.js',
    'video-sharing.b2b17d21.js',
    '5407.0ec32a4a.js',
    '96769.b28171d3.js',
  ];
  for (const f of files) {
    const r = await get(CDN + '/' + f);
    const s = r.body.toString('utf8');
    console.log(`\n===== ${f} (${r.status}, ${s.length}B) =====`);
    // API 路径
    const apis = [...new Set(s.match(/["'`](\/?(?:api|web|aweme|v\d)\/[a-zA-Z0-9_\/.-]{3,90})["'`]/g) || [])].slice(0, 20);
    apis.forEach((a) => console.log('  api:', a));
    // 完整 URL
    const urls = [...new Set(s.match(/https?:\/\/[a-zA-Z0-9.-]+\.(?:com|cn|net)[^"'\s`]{3,100}/g) || [])].slice(0, 15);
    urls.forEach((u) => console.log('  url:', u));
    // share_id / video_id 相关
    const kw = [...new Set(s.match(/share_id|video_id|shareInfo|videoInfo|getVideo|detail/g) || [])].slice(0, 10);
    console.log('  keywords:', kw.join(', '));
    const ctx = s.match(/.{60}share_id.{120}/);
    if (ctx) console.log('  share_id context:', ctx[0].replace(/\s+/g, ' '));
  }
})();
