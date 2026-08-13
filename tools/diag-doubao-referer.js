// 对最新直链做 Referer 场景测试
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

function apiCall(vid) {
  return new Promise((resolve) => {
    const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
    const u = new URL('https://www.doubao.com/samantha/media/get_play_info?' + P);
    const r = https.request(u, { method: 'POST', rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', 'Content-Type': 'application/json', Origin: 'https://www.doubao.com' } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    r.on('error', () => resolve(null));
    r.write(JSON.stringify({ key: vid }));
    r.end();
  });
}

(async () => {
  const j = await apiCall('v0269cg10004d9v2uga7dld8dlfmap30');
  if (!j || j.code !== 0) { console.log('API 失败:', j && j.code); return; }
  const mainUrl = j.data.original_media_info.main_url;
  const poster = j.data.poster_url;
  console.log('main_url 前缀:', mainUrl.slice(0, 80));
  console.log('poster 前缀:', poster.slice(0, 80));

  console.log('\n=== main_url 场景测试 ===');
  const scenes = [
    ['无 Referer（浏览器 video 标签 no-referrer 状态）', {}],
    ['Referer: doubao.com', { Referer: 'https://www.doubao.com/' }],
    ['Referer: github.io 页面', { Referer: 'https://shuimo07.github.io/watermark-killer/' }],
    ['Referer: baidu.com', { Referer: 'https://www.baidu.com/' }],
    ['Referer: 空字符串', { Referer: '' }],
  ];
  for (const [name, hdrs] of scenes) {
    const r = await req('HEAD', mainUrl, { headers: hdrs });
    console.log(`${r.status === 200 ? '✅' : '❌'} ${name} => ${r.status} type:${r.headers['content-type'] || '-'} len:${r.headers['content-length'] || '-'}`);
  }

  console.log('\n=== poster_url 场景测试 ===');
  for (const [name, hdrs] of [['无 Referer', {}], ['Referer: doubao.com', { Referer: 'https://www.doubao.com/' }], ['Referer: github.io', { Referer: 'https://shuimo07.github.io/' }]]) {
    const r = await req('HEAD', poster, { headers: hdrs });
    console.log(`${r.status === 200 ? '✅' : '❌'} ${name} => ${r.status}`);
  }
})();
