// 深入分析豆包分享页：找 API 路由
const https = require('https');

function get(url, ua) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: { 'User-Agent': ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
  });
}

const shareUrl = 'https://www.doubao.com/video-sharing?source_type=mobile&share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg';

(async () => {
  // 1. 移动端域名
  let r = await get('https://m.doubao.com/video-sharing?source_type=mobile&share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg');
  console.log('=== m.doubao.com ===');
  console.log('status:', r.status, '| type:', r.headers['content-type'], '| len:', r.body.length);
  const mhtml = r.body.toString('utf8');
  console.log('含 video_id:', mhtml.includes('v0269cg10004d9v15ha7dld1id7csccg'), '| 含 mp4:', /\.mp4/.test(mhtml), '| 含 og:video:', /og:video/.test(mhtml));
  const mp4s = [...new Set(mhtml.match(/https?:\\?\/\\?\/[^"'\s\\]+?\.mp4[^"'\s\\]*/g) || [])].slice(0, 3);
  console.log('mp4:', mp4s);

  // 2. 桌面分享页里的 JS bundle 与 API 线索
  r = await get(shareUrl);
  const html = r.body.toString('utf8');
  console.log('\n=== 分享页 API 线索 ===');
  const apis = [...new Set(html.match(/["'](\/api\/[^"']{3,80})["']/g) || [])].slice(0, 15);
  apis.forEach((a) => console.log('  api:', a));
  console.log('含 share_id 字样:', /share_id/.test(html));
  console.log('含 video-sharing:', /video-sharing/.test(html));
  // script 标签
  const scripts = [...new Set(html.match(/<script[^>]+src="([^"]+)"/g) || [])].slice(0, 8);
  scripts.forEach((s) => console.log('  script:', s));

  // 3. 常见 API 路径尝试
  const paths = [
    '/api/video/detail?share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg',
    '/api/video/video_info?share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg',
    '/api/share/video?share_id=52513203282116866',
    '/api/v1/video/detail?video_id=v0269cg10004d9v15ha7dld1id7csccg',
  ];
  for (const p of paths) {
    r = await get('https://www.doubao.com' + p);
    console.log('\n  ' + p + ' => ' + r.status + ' ' + r.headers['content-type'] + ' ' + r.body.length + 'B');
    if (r.body.length > 0 && r.body.length < 600) console.log('    body:', r.body.toString().slice(0, 400));
  }
})();
