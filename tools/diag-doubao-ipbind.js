// 终极测试：API 经 corsproxy.io 调用 → 验证 URL 是否 IP 绑定 + 代理中继是否可行
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(30000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 1. 模拟用户浏览器：API 经 corsproxy.io（Origin: github.io）
  const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
  const target = 'https://www.doubao.com/samantha/media/get_play_info?' + P;
  const api = await req('POST', 'https://corsproxy.io/?url=' + encodeURIComponent(target), {
    headers: { 'Content-Type': 'application/json', Origin: 'https://shuimo07.github.io' },
    body: JSON.stringify({ key: 'v0269cg10004d9v2uga7dld8dlfmap30' }),
  });
  let j;
  try { j = JSON.parse(api.body.toString('utf8')); } catch { console.log('API via proxy 失败:', api.status, api.body.toString().slice(0, 120)); return; }
  console.log('API via proxy code:', j.code);
  const mainUrl = j.data && j.data.original_media_info && j.data.original_media_info.main_url;
  if (!mainUrl) { console.log('无 main_url'); return; }
  console.log('main_url 前缀:', mainUrl.slice(0, 70));

  // 2. 该 URL 直连（本机 IP ≠ corsproxy.io IP，无 Referer）
  const direct = await req('HEAD', mainUrl, { headers: {} });
  console.log(`\n直连 HEAD（无 Referer，本机 IP）=> ${direct.status} ${direct.headers['content-type'] || '-'} len:${direct.headers['content-length'] || '-'}`);
  console.log(direct.status === 200 ? '  → 说明非 IP 绑定' : '  → ❌ IP 绑定确认（浏览器直连会 403）');

  // 3. 经 corsproxy.io 中继该 URL（模拟“播放/下载都走代理”方案）
  const viaProxy = await req('HEAD', 'https://corsproxy.io/?url=' + encodeURIComponent(mainUrl), { headers: {} });
  console.log(`经 corsproxy.io 中继 HEAD => ${viaProxy.status} ${viaProxy.headers['content-type'] || '-'} len:${viaProxy.headers['content-length'] || '-'} ACAO:${viaProxy.headers['access-control-allow-origin'] || '-'}`);
  console.log(viaProxy.status === 200 ? '  → ✅ 代理中继方案可行' : '  → ❌ 代理中继也不行');

  // 4. 中继取几个字节确认视频内容
  if (viaProxy.status === 200) {
    const got = await req('GET', 'https://corsproxy.io/?url=' + encodeURIComponent(mainUrl), { headers: { Range: 'bytes=0-1023' } });
    console.log(`中继 GET 前 1KB => ${got.status} 实际收到:${got.body.length}B 前 8 字节:${got.body.slice(0, 8).toString('hex')}（mp4 应为 00000018... 或 ftyp）`);
  }
})();
