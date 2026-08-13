// 精确复现 <video> 元素的请求（Range + Sec-Fetch-* + 无 Referer）测试 CDN 反应
const https = require('https');

function req(method, url, { headers = {} } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    r.end();
  });
}

function apiCall(vid) {
  return new Promise((resolve) => {
    const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
    const target = 'https://www.doubao.com/samantha/media/get_play_info?' + P;
    const u = new URL('https://corsproxy.io/?url=' + encodeURIComponent(target));
    const r = https.request(u, { method: 'POST', rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', 'Content-Type': 'application/json', Origin: 'https://shuimo07.github.io' }, body: JSON.stringify({ key: vid }) });
    let d = '';
    r.on('response', (res) => { res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); });
    r.on('error', () => resolve(null));
    r.end();
  });
}

(async () => {
  const j = await apiCall('v0269cg10004d9v2uga7dld8dlfmap30');
  if (!j || j.code !== 0) { console.log('API fail'); return; }
  const mainUrl = j.data.original_media_info.main_url;
  console.log('main_url:', mainUrl.slice(0, 60) + '…');

  const base = { 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' };
  const scenarios = [
    ['纯 GET 无头', { ...base }],
    ['GET + Range:bytes=0-', { ...base, Range: 'bytes=0-' }],
    ['GET + Range + Sec-Fetch(video)', { ...base, Range: 'bytes=0-', 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' }],
    ['GET + Range + Sec-Fetch + doubao Referer', { ...base, Range: 'bytes=0-', 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site', Referer: 'https://www.doubao.com/' }],
  ];
  for (const [name, hdrs] of scenarios) {
    const r = await req('GET', mainUrl, { headers: hdrs });
    console.log(`${r.status === 200 || r.status === 206 ? '✅' : '❌'} ${name} => ${r.status} ${r.headers['content-type'] || '-'} len:${r.body.length}${r.headers['content-range'] ? ' CR:' + r.headers['content-range'] : ''}`);
  }
})();
