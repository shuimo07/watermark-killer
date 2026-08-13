// 测试豆包接口 GET 变体 + 替代 CORS 代理
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
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

const VID = 'v0269cg10004d9v15ha7dld1id7csccg';
const P = { version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' };

(async () => {
  // 1. GET 变体（key 放 query）
  const qs = new URLSearchParams({ ...P, key: VID }).toString();
  let r = await req('GET', 'https://www.doubao.com/samantha/media/get_play_info?' + qs);
  console.log('=== GET 变体 ===');
  console.log('status:', r.status, 'len:', r.body.length);
  console.log('body head:', r.body.toString().slice(0, 150));

  // 2. allorigins 代理（GET /raw）
  const target = 'https://www.doubao.com/samantha/media/get_play_info?' + new URLSearchParams(P).toString();
  r = await req('POST', 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target), { headers: { 'Content-Type': 'application/json' }, body: { key: VID } });
  console.log('\n=== allorigins POST /raw ===');
  console.log('status:', r.status, 'len:', r.body.length, 'head:', r.body.toString().slice(0, 120));

  // 3. cors.eu.org POST
  r = await req('POST', 'https://cors.eu.org/' + target, { headers: { 'Content-Type': 'application/json' }, body: { key: VID } });
  console.log('\n=== cors.eu.org POST ===');
  console.log('status:', r.status, 'len:', r.body.length, 'head:', r.body.toString().slice(0, 150));

  // 4. cors-anywhere worker 实例
  r = await req('POST', 'https://cors-anywhere.azm.workers.dev/' + target, { headers: { 'Content-Type': 'application/json' }, body: { key: VID } });
  console.log('\n=== cors-anywhere.azm.workers.dev POST ===');
  console.log('status:', r.status, 'len:', r.body.length, 'head:', r.body.toString().slice(0, 150));

  // 5. codetabs GET 代理（仅 GET，测 GET 变体）
  const qs2 = new URLSearchParams({ ...P, key: VID }).toString();
  r = await req('GET', 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://www.doubao.com/samantha/media/get_play_info?' + qs2));
  console.log('\n=== codetabs GET 代理（GET 变体）===');
  console.log('status:', r.status, 'len:', r.body.length, 'head:', r.body.toString().slice(0, 150));
})();
