// 豆包深度探测：初始状态、bundle、带引荐的 API
const https = require('https');

function get(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', ...headers },
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
  const r = await get(shareUrl);
  const html = r.body.toString('utf8');
  console.log('=== 初始状态/OG ===');
  console.log('__INITIAL_STATE__:', html.includes('__INITIAL_STATE__'));
  console.log('application/ld+json:', html.includes('application/ld+json'));
  console.log('og:title:', html.match(/property="og:title" content="([^"]*)"/));
  console.log('og:video:', html.match(/property="og:video[^"]*" content="([^"]*)"/));
  console.log('window.__:', [...new Set(html.match(/window\.__[A-Z_]{3,40}/g) || [])].slice(0, 10));

  console.log('\n=== 全部 script src ===');
  const scripts = [...new Set(html.match(/<script[^>]+src="([^"]+)"/g) || [])].map((s) => s.replace(/^<script[^>]+src="|"$/g, ''));
  scripts.forEach((s) => console.log(' ', s));

  console.log('\n=== 带 Referer/Origin 试 API ===');
  const vid = 'v0269cg10004d9v15ha7dld1id7csccg';
  const sid = '52513203282116866';
  const ref = { Referer: shareUrl, Origin: 'https://www.doubao.com', 'X-Requested-With': 'XMLHttpRequest' };
  const tries = [
    `/api/video/detail?share_id=${sid}&video_id=${vid}`,
    `/api/video/info?share_id=${sid}&video_id=${vid}`,
    `/api/share/detail?share_id=${sid}`,
    `/api/v1/video/share?share_id=${sid}`,
    `/api/video_share/info?video_id=${vid}`,
  ];
  for (const p of tries) {
    const x = await get('https://www.doubao.com' + p, ref);
    console.log(`  ${p} => ${x.status} ${x.body.length}B ${x.body.length < 200 ? x.body.toString().slice(0, 150) : ''}`);
  }
})();
