// 复查 corsproxy.io 当前状态（github.io Origin）
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
  const TARGET = 'https://www.doubao.com/samantha/media/get_play_info?' + P;
  const r = await req('POST', 'https://corsproxy.io/?url=' + encodeURIComponent(TARGET), {
    headers: { 'Content-Type': 'application/json', Origin: 'https://shuimo07.github.io' },
    body: JSON.stringify({ key: 'v0269cg10004d9v2uga7dld8dlfmap30' }),
  });
  console.log('corsproxy.io status:', r.status, '| ACAO:', r.headers['access-control-allow-origin'] || '无');
  console.log('body:', r.body.toString().slice(0, 300));
})();
