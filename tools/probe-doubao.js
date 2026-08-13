// 探测豆包分享页结构与视频地址规律
const https = require('https');

function get(url, { ua, referer } = {}) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          'User-Agent': ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          ...(referer ? { Referer: referer } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    );
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
  });
}

const shareUrl = 'https://www.doubao.com/video-sharing?source_type=mobile&share_id=52513203282116866&video_id=v0269cg10004d9v15ha7dld1id7csccg';

(async () => {
  // 1. 分享页（移动 UA）
  let r = await get(shareUrl, { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  console.log('=== 分享页(移动UA) ===');
  console.log('status:', r.status, '| type:', r.headers['content-type'], '| len:', r.body.length);
  const html = r.body.toString('utf8');
  console.log('head:', html.slice(0, 300).replace(/\s+/g, ' '));
  console.log('含 video_id:', html.includes('v0269cg10004d9v15ha7dld1id7csccg'));
  console.log('含 mp4:', /\.mp4/.test(html), '| 含 play:', /play/.test(html), '| 含 snssdk:', /snssdk/.test(html), '| 含 volc:', /volc|tos-|p3-sign|doubao\.com\/video/.test(html));
  const mp4s = [...new Set(html.match(/https?:\\?\/\\?\/[^"'\s\\]+?\.mp4[^"'\s\\]*/g) || [])].slice(0, 5);
  console.log('mp4 候选:', mp4s);
  const jsUrls = [...new Set(html.match(/https?:\\?\/\\?\/[^"'\s]+?\.(?:js|json)[^"'\s]*/g) || [])].slice(0, 5);
  console.log('js/json 候选:', jsUrls);

  // 2. 分享页（桌面 UA + 引荐）
  r = await get(shareUrl, { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', referer: 'https://www.doubao.com/' });
  console.log('\n=== 分享页(桌面UA) ===');
  console.log('status:', r.status, '| type:', r.headers['content-type'], '| len:', r.body.length);
  const html2 = r.body.toString('utf8');
  console.log('含 video_id:', html2.includes('v0269cg10004d9v15ha7dld1id7csccg'), '| 含 mp4:', /\.mp4/.test(html2), '| 含 play:', /play/.test(html2));

  // 3. 构造 aweme play 接口（无签名探测）
  const vid = 'v0269cg10004d9v15ha7dld1id7csccg';
  for (const u of [
    'https://aweme.snssdk.com/aweme/v1/play/?video_id=' + vid,
    'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=' + vid,
    'https://www.doubao.com/api/video/play?video_id=' + vid,
  ]) {
    r = await get(u, { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', referer: 'https://www.doubao.com/' });
    console.log('\n=== ' + u + ' ===');
    console.log('status:', r.status, '| type:', r.headers['content-type'], '| len:', r.body.length);
    if (r.body.length < 200) console.log('body:', r.body.toString().slice(0, 150));
  }
})();
