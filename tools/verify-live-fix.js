// 验证线上修复是否生效
const https = require('https');
const get = (p) =>
  new Promise((resolve) => {
    https.get('https://shuimo07.github.io/watermark-killer/' + p, { rejectUnauthorized: false }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    }).on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });

(async () => {
  const app = await get('js/app.js');
  console.log('app.js:', app.s, '| referrer修复:', app.b.includes("referrer: ''"), '| Blob降级:', app.b.includes('attachVideoFallback'));
  const dl = await get('js/lib/download.js');
  console.log('download.js:', dl.s, '| referrer修复:', dl.b.includes("referrer: ''"));
})();
