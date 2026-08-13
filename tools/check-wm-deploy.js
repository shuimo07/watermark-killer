// 检查部署状态 + 直接抓取线上 watermark.js 内容
const https = require('https');
const get = (u) =>
  new Promise((resolve) => {
    https.get(u, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (research)', Accept: 'application/vnd.github+json' } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    }).on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });

(async () => {
  const runs = await get('https://api.github.com/repos/shuimo07/watermark-killer/actions/runs?per_page=3');
  if (runs.s === 200) {
    console.log('=== 最近部署 ===');
    (JSON.parse(runs.b).workflow_runs || []).forEach((r) => console.log(r.created_at, r.status, r.conclusion, r.id));
  }
  const wm = await get('https://shuimo07.github.io/watermark-killer/js/lib/watermark.js?t=' + Date.now());
  console.log('\n=== 线上 watermark.js (cache-bust) ===');
  console.log('status:', wm.s, 'len:', wm.b.length);
  console.log('appendChild:', wm.b.includes('appendChild'));
  console.log('muted=true:', wm.b.includes('muted = true'));
  console.log('audioTrack null:', wm.b.includes('audioTrack: null'));
  console.log('vp9:', wm.b.includes('vp9'));
  console.log('head:', wm.b.slice(0, 120).replace(/\n/g, ' '));
})();
