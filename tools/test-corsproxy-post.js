// 实测 corsproxy.io 是否支持 POST JSON 转发（豆包接口的关键依赖）
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(25000, () => { r.destroy(); resolve({ status: 0, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const params = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' });
  const target = 'https://www.doubao.com/samantha/media/get_play_info?' + params;
  const proxied = 'https://corsproxy.io/?url=' + encodeURIComponent(target);
  const r = await req('POST', proxied, {
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36' },
    body: { key: 'v0269cg10004d9v15ha7dld1id7csccg' },
  });
  console.log('corsproxy.io POST status:', r.status, 'len:', r.body.length);
  const raw = r.body.toString('utf8');
  console.log('head:', raw.slice(0, 200));
  try {
    const j = JSON.parse(raw);
    console.log('code:', j.code);
    if (j.data && j.data.original_media_info) console.log('main_url:', (j.data.original_media_info.main_url || '').slice(0, 100));
  } catch { console.log('(非 JSON)'); }
})();
