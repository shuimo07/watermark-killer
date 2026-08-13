// 批量测试可用 CORS POST 代理
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

const VID = 'v0269cg10004d9v15ha7dld1id7csccg';
const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
const TARGET = 'https://www.doubao.com/samantha/media/get_play_info?' + P;

const proxies = [
  ['test.cors.workers.dev', (t) => 'https://test.cors.workers.dev/' + t],
  ['cors.bridged.cc', (t) => 'https://cors.bridged.cc/' + t],
  ['api.cors.lol', (t) => 'https://api.cors.lol/?url=' + encodeURIComponent(t)],
  ['cors.eu.org(重试)', (t) => 'https://cors.eu.org/' + t],
  ['corsproxy.org', (t) => 'https://corsproxy.org/?url=' + encodeURIComponent(t)],
];

(async () => {
  for (const [name, build] of proxies) {
    const r = await req('POST', build(TARGET), { headers: { 'Content-Type': 'application/json' }, body: { key: VID } });
    const raw = r.body.toString().slice(0, 160).replace(/\s+/g, ' ');
    console.log(`${name} => ${r.status} ${r.body.length}B | ACAO:${r.headers['access-control-allow-origin'] || '-'} | ${raw}`);
    if (r.status === 200) {
      try {
        const j = JSON.parse(r.body.toString());
        console.log('   code:', j.code, '| main_url:', (j.data && j.data.original_media_info && j.data.original_media_info.main_url || '').slice(0, 80));
      } catch { /* not json */ }
    }
  }
})();
