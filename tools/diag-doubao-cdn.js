// 诊断：豆包视频直链的 Referer / 时效性 放行规则
const https = require('https');

function req(method, url, { headers = {} } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    r.end();
  });
}

(async () => {
  // 1. 用用户新链接的 video_id 调接口拿新直链
  const VID = 'v0269cg10004d9v2uga7dld8dlfmap30';
  const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
  const api = await req('POST', 'https://www.doubao.com/samantha/media/get_play_info?' + P, { headers: { 'Content-Type': 'application/json', Origin: 'https://www.doubao.com' }, body: JSON.stringify({ key: VID }) });
  let j;
  try { j = JSON.parse(api.body.toString('utf8')); } catch { console.log('API 非 JSON:', api.status, api.body.toString().slice(0, 120)); return; }
  console.log('API code:', j.code);
  const mainUrl = j.data && j.data.original_media_info && j.data.original_media_info.main_url;
  const poster = j.data && j.data.poster_url;
  if (!mainUrl) { console.log('无 main_url'); return; }
  console.log('main_url 前缀:', mainUrl.slice(0, 90));

  // 2. 不同 Referer 场景 HEAD
  console.log('\n=== main_url 各 Referer 场景 ===');
  const scenarios = [
    ['无 Referer', {}],
    ['Referer: doubao.com', { Referer: 'https://www.doubao.com/' }],
    ['Referer: github.io', { Referer: 'https://shuimo07.github.io/watermark-killer/' }],
    ['Referer: baidu', { Referer: 'https://www.baidu.com/' }],
  ];
  for (const [name, hdrs] of scenarios) {
    const r = await req('HEAD', mainUrl, { headers: hdrs });
    console.log(`${r.status === 200 ? '✅' : '❌'} ${name} => ${r.status} type:${r.headers['content-type'] || '-'} len:${r.headers['content-length'] || '-'}`);
  }

  // 3. 等等再测一次（时效性）
  console.log('\n=== 90 秒后同 URL 再测（无 Referer）===');
  await new Promise((r) => setTimeout(r, 90000));
  const r2 = await req('HEAD', mainUrl, { headers: {} });
  console.log(`无 Referer => ${r2.status} type:${r2.headers['content-type'] || '-'}`);
  const r3 = await req('HEAD', mainUrl, { headers: { Referer: 'https://www.doubao.com/' } });
  console.log(`doubao Referer => ${r3.status} type:${r3.headers['content-type'] || '-'}`);

  // 4. poster 也一样测
  console.log('\n=== poster_url 各场景 ===');
  for (const [name, hdrs] of [['无 Referer', {}], ['Referer: doubao', { Referer: 'https://www.doubao.com/' }]]) {
    const r = await req('HEAD', poster, { headers: hdrs });
    console.log(`${r.status === 200 ? '✅' : '❌'} ${name} => ${r.status}`);
  }
})();
